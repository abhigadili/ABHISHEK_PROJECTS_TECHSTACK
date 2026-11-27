package com.hrportal.performance.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.performance.dto.PerformanceDtos.AnswerDto;
import com.hrportal.performance.dto.PerformanceDtos.AnswerResponse;
import com.hrportal.performance.dto.PerformanceDtos.ApprovalRequest;
import com.hrportal.performance.dto.PerformanceDtos.HistoryResponse;
import com.hrportal.performance.dto.PerformanceDtos.ManagerEvaluationRequest;
import com.hrportal.performance.dto.PerformanceDtos.ReviewResponse;
import com.hrportal.performance.dto.PerformanceDtos.SelfEvaluationRequest;
import com.hrportal.performance.entity.Enums.CycleStatus;
import com.hrportal.performance.entity.Enums.QuestionType;
import com.hrportal.performance.entity.Enums.Respondent;
import com.hrportal.performance.entity.Enums.ReviewStatus;
import com.hrportal.performance.entity.FormQuestion;
import com.hrportal.performance.entity.PerformanceReview;
import com.hrportal.performance.entity.ReviewAnswer;
import com.hrportal.performance.entity.ReviewCycle;
import com.hrportal.performance.entity.ReviewHistory;
import com.hrportal.performance.producer.PerformanceEventProducer;
import com.hrportal.performance.repository.PerformanceRepositories.AnswerRepository;
import com.hrportal.performance.repository.PerformanceRepositories.CycleRepository;
import com.hrportal.performance.repository.PerformanceRepositories.HistoryRepository;
import com.hrportal.performance.repository.PerformanceRepositories.QuestionRepository;
import com.hrportal.performance.repository.PerformanceRepositories.ReviewRepository;

/**
 * The multi-stage review: employee self-evaluation -> manager evaluation -> HR approval. Each stage has its own save (draft) and submit
 * action; a stage can be returned to the previous one with a comment. Configurable forms drive the answers: rating questions feed a
 * weighted score computed next to the manually entered overall rating.
 */
@Service
@Transactional
public class ReviewService {
    private final ReviewRepository reviews;
    private final AnswerRepository answers;
    private final QuestionRepository questions;
    private final CycleRepository cycles;
    private final HistoryRepository history;
    private final PerformanceEventProducer producer;
    private final AuditService audit;

    public ReviewService(ReviewRepository reviews, AnswerRepository answers, QuestionRepository questions, CycleRepository cycles, HistoryRepository history,
                         PerformanceEventProducer producer, AuditService audit) {
        this.reviews = reviews;
        this.answers = answers;
        this.questions = questions;
        this.cycles = cycles;
        this.history = history;
        this.producer = producer;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ self evaluation
    public ReviewResponse saveSelf(String id, SelfEvaluationRequest req) {
        PerformanceReview r = find(id);
        requireOwner(r);
        if (r.getStatus() != ReviewStatus.SELF_PENDING) throw new BadRequestException("The self evaluation is already " + r.getStatus());
        requireActiveCycle(r);
        if (req.selfRating() != null) r.setSelfRating(req.selfRating());
        if (req.achievements() != null) r.setAchievements(req.achievements());
        if (req.strengths() != null) r.setStrengths(req.strengths());
        if (req.improvementAreas() != null) r.setImprovementAreas(req.improvementAreas());
        saveAnswers(r, Respondent.SELF, req.answers());
        reviews.save(r);
        log(r, "SELF_SAVED", null);
        return toResponse(r);
    }

    public ReviewResponse submitSelf(String id) {
        PerformanceReview r = find(id);
        requireOwner(r);
        if (r.getStatus() != ReviewStatus.SELF_PENDING) throw new BadRequestException("The self evaluation is already " + r.getStatus());
        requireActiveCycle(r);
        if (r.getSelfRating() == null) throw new BadRequestException("Provide an overall self rating before submitting");
        requireRequiredAnswers(r, Respondent.SELF);
        r.setStatus(ReviewStatus.SELF_SUBMITTED);
        r.setSelfSubmittedAt(Instant.now());
        reviews.save(r);
        log(r, "SELF_SUBMITTED", null);
        producer.submitted(r, "SELF", r.getSelfRating());
        if (r.getManagerId() != null) producer.notify(r.getManagerId(), "REVIEW_MANAGER_TURN", r, null, "review-mgr:" + r.getId());
        audit.record("PerformanceReview", id, "SELF_SUBMITTED", r.getSelfRating());
        return toResponse(r);
    }

    // ------------------------------------------------------------------ manager evaluation
    public ReviewResponse saveManager(String id, ManagerEvaluationRequest req) {
        PerformanceReview r = find(id);
        requireManagerOf(r);
        if (r.getStatus() != ReviewStatus.SELF_SUBMITTED) throw new BadRequestException("The manager evaluation can be edited only after the self evaluation is submitted (status " + r.getStatus() + ")");
        if (req.managerRating() != null) r.setManagerRating(req.managerRating());
        if (req.managerFeedback() != null) r.setManagerFeedback(req.managerFeedback());
        if (req.strengths() != null) r.setStrengths(req.strengths());
        if (req.improvementAreas() != null) r.setImprovementAreas(req.improvementAreas());
        saveAnswers(r, Respondent.MANAGER, req.answers());
        reviews.save(r);
        log(r, "MANAGER_SAVED", null);
        return toResponse(r);
    }

    public ReviewResponse submitManager(String id) {
        PerformanceReview r = find(id);
        requireManagerOf(r);
        if (r.getStatus() != ReviewStatus.SELF_SUBMITTED) throw new BadRequestException("The review is " + r.getStatus());
        if (r.getManagerRating() == null) throw new BadRequestException("Provide the manager rating before submitting");
        if (r.getManagerFeedback() == null || r.getManagerFeedback().isBlank()) throw new BadRequestException("Manager feedback is required");
        requireRequiredAnswers(r, Respondent.MANAGER);
        r.setStatus(ReviewStatus.MANAGER_SUBMITTED);
        r.setManagerSubmittedAt(Instant.now());
        reviews.save(r);
        log(r, "MANAGER_SUBMITTED", null);
        producer.submitted(r, "MANAGER", r.getManagerRating());
        audit.record("PerformanceReview", id, "MANAGER_SUBMITTED", r.getManagerRating());
        return toResponse(r);
    }

    /** The manager sends a SELF_SUBMITTED review back to the employee; HR sends a MANAGER_SUBMITTED one back to the manager. */
    public ReviewResponse returnReview(String id, String comment) {
        PerformanceReview r = find(id);
        ReviewStatus before = r.getStatus();
        if (before == ReviewStatus.SELF_SUBMITTED) {
            requireManagerOf(r);
            r.setStatus(ReviewStatus.SELF_PENDING);
            producer.notify(r.getEmployeeId(), "REVIEW_RETURNED", r, comment, "review-ret:" + r.getId() + ":" + Instant.now().getEpochSecond());
        } else if (before == ReviewStatus.MANAGER_SUBMITTED) {
            if (!CurrentUser.isHr()) throw new ForbiddenOperationException("Only HR can return a manager-submitted review");
            r.setStatus(ReviewStatus.SELF_SUBMITTED);
            if (r.getManagerId() != null) producer.notify(r.getManagerId(), "REVIEW_RETURNED", r, comment, "review-ret:" + r.getId() + ":" + Instant.now().getEpochSecond());
        } else {
            throw new BadRequestException("A " + before + " review cannot be returned");
        }
        reviews.save(r);
        log(r, "RETURNED", comment);
        audit.record("PerformanceReview", id, "RETURNED", before + " -> " + r.getStatus() + ": " + comment);
        return toResponse(r);
    }

    // ------------------------------------------------------------------ approval
    public ReviewResponse approve(String id, ApprovalRequest req) {
        PerformanceReview r = find(id);
        if (!CurrentUser.isHr()) throw new ForbiddenOperationException("Only HR can approve a review");
        if (r.getStatus() != ReviewStatus.MANAGER_SUBMITTED) throw new BadRequestException("Only a MANAGER_SUBMITTED review can be approved (current: " + r.getStatus() + ")");
        if (r.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("You cannot approve your own review");
        r.setFinalRating(req.finalRating());
        r.setHrComment(req.comment());
        r.setStatus(ReviewStatus.APPROVED);
        r.setApprovedAt(Instant.now());
        reviews.save(r);
        log(r, "APPROVED", req.comment());
        producer.approved(r);
        producer.notify(r.getEmployeeId(), "REVIEW_COMPLETED", r, req.comment(), "review-done:" + r.getId());
        audit.record("PerformanceReview", id, "APPROVED", "final " + req.finalRating());
        return toResponse(r);
    }

    // ------------------------------------------------------------------ queries
    @Transactional(readOnly = true)
    public ReviewResponse get(String id) {
        PerformanceReview r = find(id);
        requireCanView(r);
        return toResponse(r);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> mine() {
        String me = requireEmployee();
        return reviews.findByEmployeeIdOrderByCreatedAtDesc(me).stream().map(this::toResponse).toList();
    }

    /** Reviews waiting for my action: manager -> SELF_SUBMITTED reports; HR -> MANAGER_SUBMITTED reviews. */
    @Transactional(readOnly = true)
    public List<ReviewResponse> pendingForMe() {
        Map<String, PerformanceReview> out = new java.util.LinkedHashMap<>();
        String me = CurrentUser.employeeId();
        if (me != null) reviews.findByManagerIdAndStatusIn(me, EnumSet.of(ReviewStatus.SELF_SUBMITTED)).forEach(r -> out.put(r.getId(), r));
        if (CurrentUser.isHr()) reviews.findByStatusOrderByManagerSubmittedAtAsc(ReviewStatus.MANAGER_SUBMITTED).forEach(r -> out.put(r.getId(), r));
        return out.values().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> historyOf(String employeeId) {
        if (!CurrentUser.isHr() && !employeeId.equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("You can only view your own review history");
        return reviews.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> trail(String id) {
        requireCanView(find(id));
        return history.findByReviewIdOrderByCreatedAtAsc(id).stream().map(h -> new HistoryResponse(h.getId(), h.getReviewId(), h.getAction(), h.getStatus(), h.getComment(), h.getCreatedBy(), h.getCreatedAt())).toList();
    }

    // ------------------------------------------------------------------ helpers
    private void saveAnswers(PerformanceReview r, Respondent who, List<AnswerDto> list) {
        if (list == null) return;
        Map<String, FormQuestion> valid = questions.findByFormIdOrderByOrderNoAsc(r.getFormId()).stream().collect(Collectors.toMap(FormQuestion::getId, q -> q));
        for (AnswerDto a : list) {
            FormQuestion q = valid.get(a.questionId());
            if (q == null) throw new BadRequestException("Question does not belong to this form: " + a.questionId());
            if (q.getType() == QuestionType.RATING && a.rating() == null) throw new BadRequestException("A rating is required for question '" + q.getText() + "'");
            ReviewAnswer x = answers.findByReviewIdAndQuestionIdAndRespondent(r.getId(), q.getId(), who).orElseGet(ReviewAnswer::new);
            x.setReviewId(r.getId());
            x.setQuestionId(q.getId());
            x.setRespondent(who);
            x.setRating(q.getType() == QuestionType.RATING ? a.rating() : null);
            x.setAnswerText(a.answerText());
            answers.save(x);
        }
    }

    private void requireRequiredAnswers(PerformanceReview r, Respondent who) {
        Map<String, ReviewAnswer> given = answers.findByReviewId(r.getId()).stream().filter(a -> a.getRespondent() == who).collect(Collectors.toMap(ReviewAnswer::getQuestionId, a -> a));
        for (FormQuestion q : questions.findByFormIdOrderByOrderNoAsc(r.getFormId())) {
            if (!q.isRequired()) continue;
            ReviewAnswer a = given.get(q.getId());
            boolean missing = a == null || (q.getType() == QuestionType.RATING ? a.getRating() == null : a.getAnswerText() == null || a.getAnswerText().isBlank());
            if (missing) throw new BadRequestException("Required question not answered: " + q.getText());
        }
    }

    /** Weighted average of the rating answers of one respondent (null when there are none). */
    private BigDecimal score(PerformanceReview r, Respondent who, Map<String, FormQuestion> qs, List<ReviewAnswer> all) {
        BigDecimal sum = BigDecimal.ZERO;
        BigDecimal weights = BigDecimal.ZERO;
        for (ReviewAnswer a : all) {
            if (a.getRespondent() != who || a.getRating() == null) continue;
            FormQuestion q = qs.get(a.getQuestionId());
            if (q == null) continue;
            sum = sum.add(a.getRating().multiply(q.getWeight()));
            weights = weights.add(q.getWeight());
        }
        return weights.signum() == 0 ? null : sum.divide(weights, 1, RoundingMode.HALF_UP);
    }

    private void requireActiveCycle(PerformanceReview r) {
        ReviewCycle c = cycles.findById(r.getCycleId()).orElseThrow(() -> ResourceNotFoundException.of("Review cycle", r.getCycleId()));
        if (c.getStatus() != CycleStatus.ACTIVE) throw new BadRequestException("The review cycle is " + c.getStatus());
    }

    private void requireOwner(PerformanceReview r) {
        if (!r.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the reviewed employee can do this");
    }

    private void requireManagerOf(PerformanceReview r) {
        String me = CurrentUser.employeeId();
        if (r.getEmployeeId().equals(me)) throw new ForbiddenOperationException("You cannot evaluate yourself as a manager");
        if (me == null || !me.equals(r.getManagerId())) {
            if (!CurrentUser.isHr()) throw new ForbiddenOperationException("Only the employee's manager can do this");
        }
    }

    private void requireCanView(PerformanceReview r) {
        String me = CurrentUser.employeeId();
        if (CurrentUser.isHr() || (me != null && (me.equals(r.getEmployeeId()) || me.equals(r.getManagerId())))) return;
        throw new ForbiddenOperationException("You cannot view this review");
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }

    private void log(PerformanceReview r, String action, String comment) {
        ReviewHistory h = new ReviewHistory();
        h.setReviewId(r.getId());
        h.setAction(action);
        h.setStatus(r.getStatus().name());
        h.setComment(comment);
        history.save(h);
    }

    PerformanceReview find(String id) {
        return reviews.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Performance review", id));
    }

    ReviewResponse toResponse(PerformanceReview r) {
        List<ReviewAnswer> all = answers.findByReviewId(r.getId());
        Map<String, FormQuestion> qs = questions.findByFormIdOrderByOrderNoAsc(r.getFormId()).stream().collect(Collectors.toMap(FormQuestion::getId, q -> q));
        boolean isEmployee = r.getEmployeeId().equals(CurrentUser.employeeId());
        // the employee does not see the manager's draft before the manager submits
        boolean hideManagerDraft = isEmployee && r.getStatus() == ReviewStatus.SELF_SUBMITTED;
        List<AnswerResponse> ans = new ArrayList<>();
        for (ReviewAnswer a : all) {
            if (hideManagerDraft && a.getRespondent() == Respondent.MANAGER) continue;
            ans.add(new AnswerResponse(a.getQuestionId(), a.getRespondent().name(), a.getRating(), a.getAnswerText()));
        }
        return new ReviewResponse(r.getId(), r.getCycleId(), r.getEmployeeId(), r.getEmployeeName(), r.getManagerId(), r.getFormId(), r.getStatus().name(), r.getSelfRating(),
                hideManagerDraft ? null : r.getManagerRating(), r.getFinalRating(), score(r, Respondent.SELF, qs, all), hideManagerDraft ? null : score(r, Respondent.MANAGER, qs, all),
                r.getAchievements(), r.getStrengths(), r.getImprovementAreas(), hideManagerDraft ? null : r.getManagerFeedback(), r.getHrComment(), r.getSelfSubmittedAt(),
                r.getManagerSubmittedAt(), r.getApprovedAt(), ans);
    }
}
