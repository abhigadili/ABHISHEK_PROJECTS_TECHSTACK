package com.hrportal.performance.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.performance.dto.PerformanceDtos.FeedbackRequest;
import com.hrportal.performance.dto.PerformanceDtos.FeedbackResponse;
import com.hrportal.performance.dto.PerformanceDtos.GoalRequest;
import com.hrportal.performance.dto.PerformanceDtos.GoalResponse;
import com.hrportal.performance.dto.PerformanceDtos.KeyResultDto;
import com.hrportal.performance.dto.PerformanceDtos.ProgressRequest;
import com.hrportal.performance.entity.Enums.FeedbackType;
import com.hrportal.performance.entity.Enums.GoalStatus;
import com.hrportal.performance.entity.Feedback;
import com.hrportal.performance.entity.Goal;
import com.hrportal.performance.entity.KeyResult;
import com.hrportal.performance.entity.PerfEmployee;
import com.hrportal.performance.repository.PerformanceRepositories.FeedbackRepository;
import com.hrportal.performance.repository.PerformanceRepositories.GoalRepository;
import com.hrportal.performance.repository.PerformanceRepositories.KeyResultRepository;
import com.hrportal.performance.repository.PerformanceRepositories.PerfEmployeeRepository;

/** Goals / OKRs with key results, and manager / peer feedback. */
public final class GoalFeedbackService {
    private GoalFeedbackService() {
    }

    @Service
    @Transactional
    public static class GoalService {
        private final GoalRepository goals;
        private final KeyResultRepository keyResults;
        private final PerfEmployeeRepository employees;
        private final AuditService audit;

        public GoalService(GoalRepository goals, KeyResultRepository keyResults, PerfEmployeeRepository employees, AuditService audit) {
            this.goals = goals;
            this.keyResults = keyResults;
            this.employees = employees;
            this.audit = audit;
        }

        public GoalResponse create(GoalRequest req) {
            String me = requireEmployee();
            Goal g = BeanMapper.toEntity(req, Goal.class);
            g.setEmployeeId(me);
            g = goals.save(g);
            saveKeyResults(g, req.keyResults());
            audit.record("Goal", g.getId(), "CREATED", req.title());
            return toResponse(g);
        }

        public GoalResponse update(String id, GoalRequest req) {
            Goal g = ownGoal(id);
            BeanMapper.copyNonNull(req, g);
            goals.save(g);
            if (req.keyResults() != null) saveKeyResults(g, req.keyResults());
            audit.record("Goal", id, "UPDATED", req.title());
            return toResponse(g);
        }

        public GoalResponse progress(String id, ProgressRequest req) {
            Goal g = ownGoal(id);
            g.setProgress(req.progress());
            g.setStatus(req.status() != null ? GoalStatus.valueOf(req.status()) : req.progress() >= 100 ? GoalStatus.COMPLETED : req.progress() > 0 ? GoalStatus.IN_PROGRESS : g.getStatus());
            goals.save(g);
            audit.record("Goal", id, "PROGRESS", req.progress());
            return toResponse(g);
        }

        /** Key-result progress rolls up: the objective's progress becomes the average of its key results (capped at 100 % each). */
        public GoalResponse keyResultProgress(String goalId, String keyResultId, BigDecimal current) {
            Goal g = ownGoal(goalId);
            KeyResult kr = keyResults.findById(keyResultId).filter(k -> k.getGoalId().equals(goalId)).orElseThrow(() -> ResourceNotFoundException.of("Key result", keyResultId));
            kr.setCurrentValue(current);
            keyResults.save(kr);
            List<KeyResult> all = keyResults.findByGoalId(goalId);
            int avg = all.stream().map(k -> k.getCurrentValue().multiply(BigDecimal.valueOf(100)).divide(k.getTargetValue(), 0, RoundingMode.HALF_UP).min(BigDecimal.valueOf(100)))
                    .reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(Math.max(1, all.size())), 0, RoundingMode.HALF_UP).intValue();
            g.setProgress(avg);
            g.setStatus(avg >= 100 ? GoalStatus.COMPLETED : avg > 0 ? GoalStatus.IN_PROGRESS : g.getStatus());
            goals.save(g);
            return toResponse(g);
        }

        public void delete(String id) {
            Goal g = ownGoal(id);
            g.markDeleted();
            goals.save(g);
            audit.record("Goal", id, "DELETED", g.getTitle());
        }

        @Transactional(readOnly = true)
        public List<GoalResponse> mine(String cycleId) {
            String me = requireEmployee();
            return toResponses(cycleId == null ? goals.findByEmployeeIdOrderByCreatedAtDesc(me) : goals.findByEmployeeIdAndCycleIdOrderByCreatedAtDesc(me, cycleId));
        }

        @Transactional(readOnly = true)
        public List<GoalResponse> of(String employeeId) {
            String me = CurrentUser.employeeId();
            boolean manager = employees.findById(employeeId).map(e -> me != null && me.equals(e.getManagerId())).orElse(false);
            if (!employeeId.equals(me) && !manager && !CurrentUser.isHr()) throw new ForbiddenOperationException("You can only view your own or your team's goals");
            return toResponses(goals.findByEmployeeIdOrderByCreatedAtDesc(employeeId));
        }

        private void saveKeyResults(Goal g, List<KeyResultDto> list) {
            if (list == null) return;
            keyResults.findByGoalId(g.getId()).forEach(keyResults::delete);
            keyResults.flush();
            for (KeyResultDto d : list) {
                KeyResult k = new KeyResult();
                k.setGoalId(g.getId());
                k.setDescription(d.description());
                k.setTargetValue(d.targetValue());
                k.setCurrentValue(d.currentValue() == null ? BigDecimal.ZERO : d.currentValue());
                k.setUnit(d.unit());
                keyResults.save(k);
            }
        }

        private Goal ownGoal(String id) {
            Goal g = goals.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Goal", id));
            if (!g.getEmployeeId().equals(CurrentUser.employeeId())) throw new ForbiddenOperationException("Only the goal owner can change it");
            return g;
        }

        private List<GoalResponse> toResponses(List<Goal> list) {
            Map<String, List<KeyResultDto>> krs = keyResults.findByGoalIdIn(list.stream().map(Goal::getId).toList()).stream()
                    .collect(Collectors.groupingBy(KeyResult::getGoalId, Collectors.mapping(k -> BeanMapper.toRecord(k, KeyResultDto.class), Collectors.toList())));
            return list.stream().map(g -> new GoalResponse(g.getId(), g.getEmployeeId(), g.getCycleId(), g.getTitle(), g.getDescription(), g.getType().name(), g.getTargetDate(),
                    g.getProgress(), g.getWeight(), g.getStatus().name(), krs.getOrDefault(g.getId(), List.of()))).toList();
        }

        private GoalResponse toResponse(Goal g) {
            return toResponses(List.of(g)).get(0);
        }
    }

    @Service
    @Transactional
    public static class FeedbackService {
        private final FeedbackRepository feedback;
        private final PerfEmployeeRepository employees;
        private final AuditService audit;

        public FeedbackService(FeedbackRepository feedback, PerfEmployeeRepository employees, AuditService audit) {
            this.feedback = feedback;
            this.employees = employees;
            this.audit = audit;
        }

        public FeedbackResponse give(FeedbackRequest req) {
            String me = requireEmployee();
            if (me.equals(req.toEmployeeId())) throw new BadRequestException("You cannot give feedback to yourself");
            PerfEmployee target = employees.findById(req.toEmployeeId()).orElseThrow(() -> new BadRequestException("Unknown employee: " + req.toEmployeeId()));
            if ("MANAGER".equals(req.type()) && !me.equals(target.getManagerId()) && !CurrentUser.isHr()) throw new ForbiddenOperationException("Only the manager of the employee can give manager feedback");
            Feedback f = new Feedback();
            f.setToEmployeeId(req.toEmployeeId());
            f.setFromEmployeeId(me);
            f.setType(FeedbackType.valueOf(req.type()));
            f.setComment(req.comment());
            f.setRating(req.rating());
            f.setReviewId(req.reviewId());
            f = feedback.save(f);
            audit.record("Feedback", f.getId(), "GIVEN", req.type() + " to " + req.toEmployeeId());
            return toResponse(f, true);
        }

        /** Feedback about me: the author of PEER feedback is hidden. */
        @Transactional(readOnly = true)
        public List<FeedbackResponse> aboutMe() {
            return feedback.findByToEmployeeIdOrderByCreatedAtDesc(requireEmployee()).stream().map(f -> toResponse(f, f.getType() == FeedbackType.MANAGER)).toList();
        }

        /** Manager / HR see everything including authors. */
        @Transactional(readOnly = true)
        public List<FeedbackResponse> about(String employeeId) {
            String me = CurrentUser.employeeId();
            boolean manager = employees.findById(employeeId).map(e -> me != null && me.equals(e.getManagerId())).orElse(false);
            if (!manager && !CurrentUser.isHr()) throw new ForbiddenOperationException("Only the manager or HR can read all feedback of an employee");
            return feedback.findByToEmployeeIdOrderByCreatedAtDesc(employeeId).stream().map(f -> toResponse(f, true)).toList();
        }

        private FeedbackResponse toResponse(Feedback f, boolean showAuthor) {
            return new FeedbackResponse(f.getId(), f.getToEmployeeId(), showAuthor ? f.getFromEmployeeId() : null, f.getType().name(), f.getComment(), f.getRating(), f.getCreatedAt());
        }
    }

    private static String requireEmployee() {
        String me = CurrentUser.employeeId();
        if (me == null) throw new ForbiddenOperationException("Your account is not linked to an employee record");
        return me;
    }
}
