package com.hrportal.exit.controller;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;
import com.hrportal.exit.dto.ExitDtos.CompleteTaskRequest;
import com.hrportal.exit.dto.ExitDtos.ConfirmRequest;
import com.hrportal.exit.dto.ExitDtos.HistoryResponse;
import com.hrportal.exit.dto.ExitDtos.InterviewCompleteRequest;
import com.hrportal.exit.dto.ExitDtos.InterviewFormResponse;
import com.hrportal.exit.dto.ExitDtos.InterviewResponse;
import com.hrportal.exit.dto.ExitDtos.ManagerDecision;
import com.hrportal.exit.dto.ExitDtos.PolicyRequest;
import com.hrportal.exit.dto.ExitDtos.PolicyResponse;
import com.hrportal.exit.dto.ExitDtos.ProcessSettlementRequest;
import com.hrportal.exit.dto.ExitDtos.ResignationRequest;
import com.hrportal.exit.dto.ExitDtos.ResignationResponse;
import com.hrportal.exit.dto.ExitDtos.ScheduleRequest;
import com.hrportal.exit.dto.ExitDtos.SettlementResponse;
import com.hrportal.exit.dto.ExitDtos.StatusSummary;
import com.hrportal.exit.dto.ExitDtos.TaskRequest;
import com.hrportal.exit.dto.ExitDtos.TaskResponse;
import com.hrportal.exit.service.ExitTaskService;
import com.hrportal.exit.service.ExitWorkflowService;
import com.hrportal.exit.service.InterviewService;
import com.hrportal.exit.service.SettlementService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Exit Management")
@RestController
@RequestMapping("/api/v1/exit")
public class ExitController {
    private static final Set<String> SORT = Set.of("submittedOn", "status", "employeeName", "requestedLastWorkingDay");
    private final ExitWorkflowService workflow;
    private final ExitTaskService tasks;
    private final InterviewService interviews;
    private final SettlementService settlement;

    public ExitController(ExitWorkflowService workflow, ExitTaskService tasks, InterviewService interviews, SettlementService settlement) {
        this.workflow = workflow;
        this.tasks = tasks;
        this.interviews = interviews;
        this.settlement = settlement;
    }

    // ---- 1-3: resignation, manager review, HR confirmation
    @Operation(summary = "Step 1: employee submits a resignation (notice period is calculated from the employee record)")
    @PostMapping("/resignations")
    @ResponseStatus(HttpStatus.CREATED)
    public ResignationResponse submit(@Valid @RequestBody ResignationRequest req) {
        return workflow.submit(req);
    }

    @GetMapping("/resignations/me")
    public List<ResignationResponse> mine() {
        return workflow.mine();
    }

    @GetMapping("/resignations/pending")
    @PreAuthorize("hasAuthority('PERM_EXIT_APPROVE')")
    public List<ResignationResponse> pending() {
        return workflow.pending();
    }

    @GetMapping("/resignations")
    @PreAuthorize("hasAuthority('PERM_EXIT_MANAGE')")
    public PageResponse<ResignationResponse> list(@RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                                  @RequestParam(defaultValue = "submittedOn,desc") String sort) {
        return PageResponse.of(workflow.list(status, PageRequests.of(page, size, sort, SORT, "submittedOn")));
    }

    @GetMapping("/resignations/{id}")
    public ResignationResponse get(@PathVariable String id) {
        return workflow.get(id);
    }

    @GetMapping("/resignations/{id}/history")
    public List<HistoryResponse> history(@PathVariable String id) {
        return workflow.historyOf(id);
    }

    @PostMapping("/resignations/{id}/withdraw")
    public ResignationResponse withdraw(@PathVariable String id) {
        return workflow.withdraw(id);
    }

    @Operation(summary = "Step 2: manager approves or rejects")
    @PostMapping("/resignations/{id}/manager-decision")
    @PreAuthorize("hasAuthority('PERM_EXIT_APPROVE')")
    public ResignationResponse managerDecision(@PathVariable String id, @Valid @RequestBody ManagerDecision req) {
        return workflow.managerDecision(id, req);
    }

    @Operation(summary = "Step 3: HR confirms the last working day (notice waiver allowed) and the exit checklist is generated")
    @PostMapping("/resignations/{id}/confirm")
    @PreAuthorize("hasAuthority('PERM_EXIT_MANAGE')")
    public ResignationResponse confirm(@PathVariable String id, @Valid @RequestBody ConfirmRequest req) {
        return workflow.confirm(id, req);
    }

    // ---- 4-5: checklist and clearances
    @GetMapping("/resignations/{id}/tasks")
    public List<TaskResponse> tasks(@PathVariable String id) {
        return tasks.list(id);
    }

    @PostMapping("/resignations/{id}/tasks")
    @PreAuthorize("hasAuthority('PERM_EXIT_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse addTask(@PathVariable String id, @Valid @RequestBody TaskRequest req) {
        return tasks.add(id, req);
    }

    @Operation(summary = "Steps 4-5: complete a checklist item / clearance / knowledge transfer / asset return / access revocation")
    @PostMapping("/tasks/{taskId}/complete")
    public TaskResponse complete(@PathVariable String taskId, @Valid @RequestBody(required = false) CompleteTaskRequest req) {
        return tasks.complete(taskId, req);
    }

    // ---- 6: exit interview
    @GetMapping("/interview-form")
    public InterviewFormResponse form() {
        return interviews.form();
    }

    @PutMapping("/resignations/{id}/interview/schedule")
    @PreAuthorize("hasAuthority('PERM_EXIT_MANAGE')")
    public InterviewResponse schedule(@PathVariable String id, @Valid @RequestBody ScheduleRequest req) {
        return interviews.schedule(id, req.scheduledAt());
    }

    @Operation(summary = "Step 6: HR records the exit interview (answers + feedback)")
    @PostMapping("/resignations/{id}/interview/complete")
    @PreAuthorize("hasAuthority('PERM_EXIT_MANAGE')")
    public InterviewResponse completeInterview(@PathVariable String id, @Valid @RequestBody InterviewCompleteRequest req) {
        return interviews.complete(id, req);
    }

    @GetMapping("/resignations/{id}/interview")
    public InterviewResponse interview(@PathVariable String id) {
        return interviews.get(id);
    }

    // ---- 7-8: settlement and completion
    @Operation(summary = "Step 7a: payroll calculates the full and final settlement (salary, leave encashment, notice and loan recovery)")
    @PostMapping("/resignations/{id}/settlement/calculate")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','SUPER_ADMIN')")
    public SettlementResponse calculate(@PathVariable String id) {
        return settlement.calculate(id);
    }

    @GetMapping("/resignations/{id}/settlement")
    public SettlementResponse settlement(@PathVariable String id) {
        return settlement.get(id);
    }

    @Operation(summary = "Step 7b: payroll processes (pays) the settlement - publishes settlement.processed")
    @PostMapping("/resignations/{id}/settlement/process")
    @PreAuthorize("hasAnyRole('PAYROLL_ADMIN','SUPER_ADMIN')")
    public SettlementResponse process(@PathVariable String id, @Valid @RequestBody ProcessSettlementRequest req) {
        return settlement.process(id, req.paymentReference());
    }

    @Operation(summary = "Step 8: HR completes the exit - publishes employee.exited (employee status, account, org chart ... are updated by their services)")
    @PostMapping("/resignations/{id}/complete")
    @PreAuthorize("hasAuthority('PERM_EXIT_MANAGE')")
    public Object completeExit(@PathVariable String id) {
        return settlement.complete(id);
    }

    // ---- policy / reports
    @GetMapping("/policy")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public PolicyResponse policy() {
        return workflow.getPolicy();
    }

    @PutMapping("/policy")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public PolicyResponse updatePolicy(@Valid @RequestBody PolicyRequest req) {
        return workflow.updatePolicy(req);
    }

    @GetMapping("/reports/summary")
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN')")
    public StatusSummary summary() {
        return workflow.summary();
    }
}
