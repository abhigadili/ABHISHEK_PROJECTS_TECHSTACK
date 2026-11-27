package com.hrportal.performance.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.performance.dto.PerformanceDtos.ApprovalRequest;
import com.hrportal.performance.dto.PerformanceDtos.CycleRequest;
import com.hrportal.performance.dto.PerformanceDtos.CycleResponse;
import com.hrportal.performance.dto.PerformanceDtos.CycleSummary;
import com.hrportal.performance.dto.PerformanceDtos.FeedbackRequest;
import com.hrportal.performance.dto.PerformanceDtos.FeedbackResponse;
import com.hrportal.performance.dto.PerformanceDtos.FormRequest;
import com.hrportal.performance.dto.PerformanceDtos.FormResponse;
import com.hrportal.performance.dto.PerformanceDtos.GoalRequest;
import com.hrportal.performance.dto.PerformanceDtos.GoalResponse;
import com.hrportal.performance.dto.PerformanceDtos.HistoryResponse;
import com.hrportal.performance.dto.PerformanceDtos.KeyResultProgress;
import com.hrportal.performance.dto.PerformanceDtos.ManagerEvaluationRequest;
import com.hrportal.performance.dto.PerformanceDtos.ProgressRequest;
import com.hrportal.performance.dto.PerformanceDtos.ReturnRequest;
import com.hrportal.performance.dto.PerformanceDtos.ReviewResponse;
import com.hrportal.performance.dto.PerformanceDtos.SelfEvaluationRequest;
import com.hrportal.performance.scheduler.ReviewReminderScheduler;
import com.hrportal.performance.service.FormCycleService.CycleService;
import com.hrportal.performance.service.FormCycleService.FormService;
import com.hrportal.performance.service.GoalFeedbackService.FeedbackService;
import com.hrportal.performance.service.GoalFeedbackService.GoalService;
import com.hrportal.performance.service.PerformanceReportService;
import com.hrportal.performance.service.ReviewService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Performance")
@RestController
@RequestMapping("/api/v1/performance")
public class PerformanceController {
    private final FormService forms;
    private final CycleService cycles;
    private final ReviewService reviews;
    private final GoalService goals;
    private final FeedbackService feedback;
    private final PerformanceReportService reports;
    private final ReviewReminderScheduler reminders;

    public PerformanceController(FormService forms, CycleService cycles, ReviewService reviews, GoalService goals, FeedbackService feedback, PerformanceReportService reports,
                                 ReviewReminderScheduler reminders) {
        this.forms = forms;
        this.cycles = cycles;
        this.reviews = reviews;
        this.goals = goals;
        this.feedback = feedback;
        this.reports = reports;
        this.reminders = reminders;
    }

    // ---- forms
    @GetMapping("/forms")
    public List<FormResponse> forms() {
        return forms.list();
    }

    @GetMapping("/forms/{id}")
    public FormResponse form(@PathVariable String id) {
        return forms.get(id);
    }

    @PostMapping("/forms")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public FormResponse createForm(@Valid @RequestBody FormRequest req) {
        return forms.create(req);
    }

    @PutMapping("/forms/{id}")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    public FormResponse updateForm(@PathVariable String id, @Valid @RequestBody FormRequest req) {
        return forms.update(id, req);
    }

    // ---- cycles
    @GetMapping("/cycles")
    public List<CycleResponse> cycles() {
        return cycles.list();
    }

    @PostMapping("/cycles")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public CycleResponse createCycle(@Valid @RequestBody CycleRequest req) {
        return cycles.create(req);
    }

    @Operation(summary = "Activate a cycle: one review per active employee is created and employees are notified")
    @PostMapping("/cycles/{id}/activate")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    public CycleResponse activate(@PathVariable String id) {
        return cycles.activate(id);
    }

    @PostMapping("/cycles/{id}/close")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    public CycleResponse close(@PathVariable String id) {
        return cycles.close(id);
    }

    @Operation(summary = "Cycle report: status counts, average ratings, final-rating distribution")
    @GetMapping("/cycles/{id}/summary")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public CycleSummary summary(@PathVariable String id) {
        return reports.summary(id);
    }

    @PostMapping("/reminders/run")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    public java.util.Map<String, Integer> runReminders() {
        return java.util.Map.of("queued", reminders.run());
    }

    // ---- reviews
    @GetMapping("/reviews/me")
    public List<ReviewResponse> myReviews() {
        return reviews.mine();
    }

    @GetMapping("/reviews/pending")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_REVIEW')")
    public List<ReviewResponse> pending() {
        return reviews.pendingForMe();
    }

    @GetMapping("/reviews/{id}")
    public ReviewResponse review(@PathVariable String id) {
        return reviews.get(id);
    }

    @GetMapping("/reviews/{id}/history")
    public List<HistoryResponse> trail(@PathVariable String id) {
        return reviews.trail(id);
    }

    @GetMapping("/reviews/employee/{employeeId}")
    public List<ReviewResponse> history(@PathVariable String employeeId) {
        return reviews.historyOf(employeeId);
    }

    @Operation(summary = "Self evaluation: save a draft")
    @PutMapping("/reviews/{id}/self")
    public ReviewResponse saveSelf(@PathVariable String id, @Valid @RequestBody SelfEvaluationRequest req) {
        return reviews.saveSelf(id, req);
    }

    @PostMapping("/reviews/{id}/self/submit")
    public ReviewResponse submitSelf(@PathVariable String id) {
        return reviews.submitSelf(id);
    }

    @Operation(summary = "Manager evaluation: save a draft")
    @PutMapping("/reviews/{id}/manager")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_REVIEW')")
    public ReviewResponse saveManager(@PathVariable String id, @Valid @RequestBody ManagerEvaluationRequest req) {
        return reviews.saveManager(id, req);
    }

    @PostMapping("/reviews/{id}/manager/submit")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_REVIEW')")
    public ReviewResponse submitManager(@PathVariable String id) {
        return reviews.submitManager(id);
    }

    @PostMapping("/reviews/{id}/return")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_REVIEW')")
    public ReviewResponse returnReview(@PathVariable String id, @Valid @RequestBody ReturnRequest req) {
        return reviews.returnReview(id, req.comment());
    }

    @PostMapping("/reviews/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_PERFORMANCE_MANAGE')")
    public ReviewResponse approve(@PathVariable String id, @Valid @RequestBody ApprovalRequest req) {
        return reviews.approve(id, req);
    }

    // ---- goals
    @PostMapping("/goals")
    @ResponseStatus(HttpStatus.CREATED)
    public GoalResponse createGoal(@Valid @RequestBody GoalRequest req) {
        return goals.create(req);
    }

    @GetMapping("/goals/me")
    public List<GoalResponse> myGoals(@RequestParam(required = false) String cycleId) {
        return goals.mine(cycleId);
    }

    @GetMapping("/goals/employee/{employeeId}")
    public List<GoalResponse> goalsOf(@PathVariable String employeeId) {
        return goals.of(employeeId);
    }

    @PutMapping("/goals/{id}")
    public GoalResponse updateGoal(@PathVariable String id, @Valid @RequestBody GoalRequest req) {
        return goals.update(id, req);
    }

    @PatchMapping("/goals/{id}/progress")
    public GoalResponse progress(@PathVariable String id, @Valid @RequestBody ProgressRequest req) {
        return goals.progress(id, req);
    }

    @PatchMapping("/goals/{id}/key-results/{keyResultId}")
    public GoalResponse keyResult(@PathVariable String id, @PathVariable String keyResultId, @Valid @RequestBody KeyResultProgress req) {
        return goals.keyResultProgress(id, keyResultId, req.currentValue());
    }

    @DeleteMapping("/goals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGoal(@PathVariable String id) {
        goals.delete(id);
    }

    // ---- feedback
    @PostMapping("/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public FeedbackResponse give(@Valid @RequestBody FeedbackRequest req) {
        return feedback.give(req);
    }

    @GetMapping("/feedback/me")
    public List<FeedbackResponse> aboutMe() {
        return feedback.aboutMe();
    }

    @GetMapping("/feedback/employee/{employeeId}")
    public List<FeedbackResponse> about(@PathVariable String employeeId) {
        return feedback.about(employeeId);
    }
}
