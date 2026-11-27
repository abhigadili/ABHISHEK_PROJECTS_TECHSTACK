package com.hrportal.performance.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.performance.dto.PerformanceDtos.CycleRequest;
import com.hrportal.performance.dto.PerformanceDtos.CycleResponse;
import com.hrportal.performance.dto.PerformanceDtos.FormRequest;
import com.hrportal.performance.dto.PerformanceDtos.FormResponse;
import com.hrportal.performance.dto.PerformanceDtos.QuestionDto;
import com.hrportal.performance.entity.Enums.CycleStatus;
import com.hrportal.performance.entity.EvaluationForm;
import com.hrportal.performance.entity.FormQuestion;
import com.hrportal.performance.entity.PerfEmployee;
import com.hrportal.performance.entity.PerformanceReview;
import com.hrportal.performance.entity.ReviewCycle;
import com.hrportal.performance.entity.ReviewHistory;
import com.hrportal.performance.producer.PerformanceEventProducer;
import com.hrportal.performance.repository.PerformanceRepositories.CycleRepository;
import com.hrportal.performance.repository.PerformanceRepositories.FormRepository;
import com.hrportal.performance.repository.PerformanceRepositories.HistoryRepository;
import com.hrportal.performance.repository.PerformanceRepositories.PerfEmployeeRepository;
import com.hrportal.performance.repository.PerformanceRepositories.QuestionRepository;
import com.hrportal.performance.repository.PerformanceRepositories.ReviewRepository;

/** Evaluation forms and review cycles (activation creates one review per active employee). */
public final class FormCycleService {
    private FormCycleService() {
    }

    @Service
    @Transactional
    public static class FormService {
        private final FormRepository forms;
        private final QuestionRepository questions;
        private final AuditService audit;

        public FormService(FormRepository forms, QuestionRepository questions, AuditService audit) {
            this.forms = forms;
            this.questions = questions;
            this.audit = audit;
        }

        public FormResponse create(FormRequest req) {
            EvaluationForm f = new EvaluationForm();
            f.setName(req.name());
            f.setDescription(req.description());
            if (req.active() != null) f.setActive(req.active());
            f = forms.save(f);
            replace(f.getId(), req.questions());
            audit.record("EvaluationForm", f.getId(), "CREATED", req.name());
            return get(f.getId());
        }

        public FormResponse update(String id, FormRequest req) {
            EvaluationForm f = forms.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Evaluation form", id));
            f.setName(req.name());
            f.setDescription(req.description());
            if (req.active() != null) f.setActive(req.active());
            forms.save(f);
            replace(id, req.questions());
            audit.record("EvaluationForm", id, "UPDATED", req.name());
            return get(id);
        }

        @Transactional(readOnly = true)
        public FormResponse get(String id) {
            EvaluationForm f = forms.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Evaluation form", id));
            List<QuestionDto> qs = questions.findByFormIdOrderByOrderNoAsc(id).stream().map(q -> BeanMapper.toRecord(q, QuestionDto.class)).toList();
            return new FormResponse(f.getId(), f.getName(), f.getDescription(), f.isActive(), qs);
        }

        @Transactional(readOnly = true)
        public List<FormResponse> list() {
            return forms.findAll().stream().map(f -> get(f.getId())).toList();
        }

        private void replace(String formId, List<QuestionDto> list) {
            questions.deleteByFormId(formId);
            questions.flush();
            int n = 1;
            for (QuestionDto d : list) {
                FormQuestion q = BeanMapper.toEntity(d, FormQuestion.class);
                q.setFormId(formId);
                q.setOrderNo(d.orderNo() == null ? n : d.orderNo());
                n++;
                questions.save(q);
            }
        }
    }

    @Service
    @Transactional
    public static class CycleService {
        private final CycleRepository cycles;
        private final FormRepository forms;
        private final ReviewRepository reviews;
        private final PerfEmployeeRepository employees;
        private final HistoryRepository history;
        private final PerformanceEventProducer producer;
        private final AuditService audit;

        public CycleService(CycleRepository cycles, FormRepository forms, ReviewRepository reviews, PerfEmployeeRepository employees, HistoryRepository history,
                            PerformanceEventProducer producer, AuditService audit) {
            this.cycles = cycles;
            this.forms = forms;
            this.reviews = reviews;
            this.employees = employees;
            this.history = history;
            this.producer = producer;
            this.audit = audit;
        }

        public CycleResponse create(CycleRequest req) {
            if (!forms.existsById(req.formId())) throw new BadRequestException("Unknown evaluation form: " + req.formId());
            if (req.managerEvalDeadline().isBefore(req.selfEvalDeadline())) throw new BadRequestException("The manager deadline cannot be before the self-evaluation deadline");
            ReviewCycle c = BeanMapper.toEntity(req, ReviewCycle.class);
            c = cycles.save(c);
            audit.record("ReviewCycle", c.getId(), "CREATED", req.name());
            return BeanMapper.toRecord(c, CycleResponse.class);
        }

        /** Activation creates one review for every active employee (idempotent: existing reviews are kept) and notifies them. */
        public CycleResponse activate(String id) {
            ReviewCycle c = find(id);
            if (c.getStatus() != CycleStatus.DRAFT) throw new BadRequestException("Only a DRAFT cycle can be activated");
            int created = 0;
            for (PerfEmployee e : employees.findByStatusIn(List.of("ACTIVE"))) {
                if (reviews.findByCycleIdAndEmployeeId(id, e.getEmployeeId()).isPresent()) continue;
                PerformanceReview r = new PerformanceReview();
                r.setCycleId(id);
                r.setEmployeeId(e.getEmployeeId());
                r.setEmployeeName(e.getFullName());
                r.setManagerId(e.getManagerId());
                r.setFormId(c.getFormId());
                r = reviews.save(r);
                ReviewHistory h = new ReviewHistory();
                h.setReviewId(r.getId());
                h.setAction("CREATED");
                h.setStatus(r.getStatus().name());
                history.save(h);
                producer.notify(e.getEmployeeId(), "REVIEW_STARTED", r, c.getName() + ", self evaluation due " + c.getSelfEvalDeadline(), "review-start:" + r.getId());
                created++;
            }
            c.setStatus(CycleStatus.ACTIVE);
            cycles.save(c);
            audit.record("ReviewCycle", id, "ACTIVATED", created + " reviews created");
            return BeanMapper.toRecord(c, CycleResponse.class);
        }

        public CycleResponse close(String id) {
            ReviewCycle c = find(id);
            if (c.getStatus() != CycleStatus.ACTIVE) throw new BadRequestException("Only an ACTIVE cycle can be closed");
            c.setStatus(CycleStatus.CLOSED);
            cycles.save(c);
            audit.record("ReviewCycle", id, "CLOSED", null);
            return BeanMapper.toRecord(c, CycleResponse.class);
        }

        @Transactional(readOnly = true)
        public List<CycleResponse> list() {
            return BeanMapper.toRecords(cycles.findAll(), CycleResponse.class);
        }

        @Transactional(readOnly = true)
        public CycleResponse get(String id) {
            return BeanMapper.toRecord(find(id), CycleResponse.class);
        }

        public ReviewCycle find(String id) {
            return cycles.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Review cycle", id));
        }
    }
}
