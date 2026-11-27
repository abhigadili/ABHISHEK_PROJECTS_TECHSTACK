package com.hrportal.exit.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.exit.dto.ExitDtos.InterviewCompleteRequest;
import com.hrportal.exit.dto.ExitDtos.InterviewFormResponse;
import com.hrportal.exit.dto.ExitDtos.InterviewResponse;
import com.hrportal.exit.entity.Enums.InterviewStatus;
import com.hrportal.exit.entity.Enums.ResignationStatus;
import com.hrportal.exit.entity.ExitInterview;
import com.hrportal.exit.entity.InterviewForm;
import com.hrportal.exit.entity.Resignation;
import com.hrportal.exit.repository.ExitRepositories.FormRepository;
import com.hrportal.exit.repository.ExitRepositories.InterviewRepository;

/** Exit interview (workflow step 6): form, scheduling, completion with answers and feedback. Completing it moves the resignation to INTERVIEW_DONE. */
@Service
@Transactional
public class InterviewService {
    private final InterviewRepository interviews;
    private final FormRepository forms;
    private final ExitWorkflowService workflow;
    private final ObjectMapper mapper;
    private final AuditService audit;

    public InterviewService(InterviewRepository interviews, FormRepository forms, ExitWorkflowService workflow, ObjectMapper mapper, AuditService audit) {
        this.interviews = interviews;
        this.forms = forms;
        this.workflow = workflow;
        this.mapper = mapper;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public InterviewFormResponse form() {
        InterviewForm f = forms.findFirstByActiveTrueOrderByCreatedAtDesc().orElseThrow(() -> new BadRequestException("No exit interview form is configured"));
        return new InterviewFormResponse(f.getId(), f.getName(), questions(f));
    }

    public InterviewResponse schedule(String resignationId, Instant at) {
        Resignation r = workflow.find(resignationId);
        if (r.getStatus() != ResignationStatus.CLEARED && r.getStatus() != ResignationStatus.HR_CONFIRMED) throw new BadRequestException("The interview can be scheduled once HR confirmed the last working day");
        InterviewForm f = forms.findFirstByActiveTrueOrderByCreatedAtDesc().orElseThrow(() -> new BadRequestException("No exit interview form is configured"));
        ExitInterview i = interviews.findByResignationId(resignationId).orElseGet(ExitInterview::new);
        if (i.getStatus() == InterviewStatus.COMPLETED && i.getId() != null) throw new BadRequestException("The exit interview is already completed");
        i.setResignationId(resignationId);
        i.setFormId(f.getId());
        i.setScheduledAt(at);
        i.setStatus(InterviewStatus.SCHEDULED);
        i = interviews.save(i);
        audit.record("ExitInterview", i.getId(), "SCHEDULED", at);
        return toResponse(i);
    }

    public InterviewResponse complete(String resignationId, InterviewCompleteRequest req) {
        Resignation r = workflow.find(resignationId);
        if (r.getStatus() != ResignationStatus.CLEARED) throw new BadRequestException("The exit interview can be completed after all clearances (status CLEARED, current: " + r.getStatus() + ")");
        ExitInterview i = interviews.findByResignationId(resignationId).orElseGet(() -> {
            ExitInterview n = new ExitInterview();
            n.setResignationId(resignationId);
            n.setFormId(forms.findFirstByActiveTrueOrderByCreatedAtDesc().orElseThrow(() -> new BadRequestException("No exit interview form is configured")).getId());
            return n;
        });
        InterviewForm f = forms.findById(i.getFormId()).orElseThrow();
        for (Map<String, String> q : questions(f)) {
            if ("true".equals(q.get("required")) && (req.answers().get(q.get("id")) == null || req.answers().get(q.get("id")).isBlank())) {
                throw new BadRequestException("Question not answered: " + q.get("text"));
            }
        }
        try {
            i.setAnswers(mapper.writeValueAsString(req.answers()));
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Invalid answers");
        }
        i.setFeedbackSummary(req.feedbackSummary());
        i.setWouldRecommend(req.wouldRecommend());
        i.setConductedBy(CurrentUser.auditName());
        i.setStatus(InterviewStatus.COMPLETED);
        i.setCompletedAt(Instant.now());
        i = interviews.save(i);
        workflow.move(r, ResignationStatus.INTERVIEW_DONE, "Exit interview completed");
        audit.record("ExitInterview", i.getId(), "COMPLETED", req.wouldRecommend());
        return toResponse(i);
    }

    @Transactional(readOnly = true)
    public InterviewResponse get(String resignationId) {
        Resignation r = workflow.find(resignationId);
        workflow.requireView(r);
        // the answers are exit feedback: employee and manager see the form status, only HR sees the content
        InterviewResponse resp = toResponse(interviews.findByResignationId(resignationId).orElseThrow(() -> ResourceNotFoundException.of("Exit interview of", resignationId)));
        return CurrentUser.isHr() ? resp : new InterviewResponse(resp.id(), resp.resignationId(), resp.formId(), resp.scheduledAt(), null, resp.status(), null, null, null, resp.completedAt());
    }

    private List<Map<String, String>> questions(InterviewForm f) {
        try {
            return mapper.readValue(f.getQuestions(), new TypeReference<List<Map<String, String>>>() { });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt interview form " + f.getId(), e);
        }
    }

    private InterviewResponse toResponse(ExitInterview i) {
        Map<String, String> answers = null;
        try {
            if (i.getAnswers() != null) answers = mapper.readValue(i.getAnswers(), new TypeReference<Map<String, String>>() { });
        } catch (JsonProcessingException e) {
            answers = Map.of();
        }
        return new InterviewResponse(i.getId(), i.getResignationId(), i.getFormId(), i.getScheduledAt(), i.getConductedBy(), i.getStatus().name(), answers, i.getFeedbackSummary(),
                i.getWouldRecommend(), i.getCompletedAt());
    }
}
