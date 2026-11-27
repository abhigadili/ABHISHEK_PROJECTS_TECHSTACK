package com.hrportal.exit.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.security.CurrentUser;
import com.hrportal.common.security.Role;
import com.hrportal.exit.dto.ExitDtos.CompleteTaskRequest;
import com.hrportal.exit.dto.ExitDtos.TaskRequest;
import com.hrportal.exit.dto.ExitDtos.TaskResponse;
import com.hrportal.exit.entity.AccessRevocationTask;
import com.hrportal.exit.entity.AssetReturnTask;
import com.hrportal.exit.entity.ChecklistTask;
import com.hrportal.exit.entity.ClearanceTask;
import com.hrportal.exit.entity.Enums.ResignationStatus;
import com.hrportal.exit.entity.Enums.TaskStatus;
import com.hrportal.exit.entity.ExitTask;
import com.hrportal.exit.entity.KnowledgeTransferTask;
import com.hrportal.exit.entity.Resignation;
import com.hrportal.exit.producer.ExitEventProducer;
import com.hrportal.exit.repository.ExitRepositories.TaskRepository;

/**
 * Exit checklist, department clearances, knowledge transfer, asset return and access revocation - all {@link ExitTask} subclasses stored in one
 * table. Who may complete what: the employee their checklist and knowledge transfer, the manager the MANAGER clearance and knowledge transfer,
 * FINANCE the finance clearance, HR everything. When the last task is done the resignation becomes CLEARED.
 */
@Service
@Transactional
public class ExitTaskService {
    private final TaskRepository tasks;
    private final ExitWorkflowService workflow;
    private final ExitEventProducer producer;
    private final AuditService audit;

    public ExitTaskService(TaskRepository tasks, ExitWorkflowService workflow, ExitEventProducer producer, AuditService audit) {
        this.tasks = tasks;
        this.workflow = workflow;
        this.producer = producer;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> list(String resignationId) {
        workflow.requireView(workflow.find(resignationId));
        return tasks.findByResignationIdOrderByCreatedAtAsc(resignationId).stream().map(ExitTaskService::toResponse).toList();
    }

    public TaskResponse add(String resignationId, TaskRequest req) {
        Resignation r = workflow.find(resignationId);
        if (r.getStatus() != ResignationStatus.HR_CONFIRMED && r.getStatus() != ResignationStatus.CLEARED) throw new BadRequestException("Tasks can be added after HR confirmed the last working day");
        ExitTask t = switch (req.kind()) {
            case "CLEARANCE" -> {
                ClearanceTask c = new ClearanceTask();
                c.setDepartment(req.department() == null ? "HR" : req.department());
                yield c;
            }
            case "KT" -> {
                KnowledgeTransferTask k = new KnowledgeTransferTask();
                k.setTopic(req.topic());
                k.setTransfereeEmployeeId(req.transfereeEmployeeId());
                yield k;
            }
            case "ASSET" -> {
                AssetReturnTask a = new AssetReturnTask();
                a.setAssetTag(req.assetTag());
                yield a;
            }
            case "ACCESS" -> {
                AccessRevocationTask a = new AccessRevocationTask();
                a.setSystemName(req.systemName());
                yield a;
            }
            default -> new ChecklistTask();
        };
        t.setResignationId(resignationId);
        t.setTitle(req.title());
        t.setDueDate(req.dueDate() == null ? r.getConfirmedLastWorkingDay() : req.dueDate());
        t = tasks.save(t);
        if (r.getStatus() == ResignationStatus.CLEARED) workflow.move(r, ResignationStatus.HR_CONFIRMED, "New task added: " + req.title());
        audit.record("ExitTask", t.getId(), "ADDED", req.kind() + " " + req.title());
        return toResponse(t);
    }

    public TaskResponse complete(String taskId, CompleteTaskRequest req) {
        ExitTask t = tasks.findById(taskId).orElseThrow(() -> ResourceNotFoundException.of("Exit task", taskId));
        Resignation r = workflow.find(t.getResignationId());
        if (r.getStatus() != ResignationStatus.HR_CONFIRMED) throw new BadRequestException("Tasks can be completed while the resignation is HR_CONFIRMED (current: " + r.getStatus() + ")");
        if (t.getStatus() == TaskStatus.DONE) throw new BadRequestException("The task is already done");
        requireMayComplete(t, r);
        t.setStatus(TaskStatus.DONE);
        t.setCompletedAt(Instant.now());
        t.setCompletedBy(CurrentUser.auditName());
        t.setRemarks(req == null ? null : req.remarks());
        if (t instanceof AssetReturnTask a) {
            a.setReturnedOn(LocalDate.now());
            if (req != null) a.setAssetCondition(req.assetCondition());
        } else if (t instanceof AccessRevocationTask a) {
            a.setRevokedOn(LocalDate.now());
        }
        tasks.save(t);
        audit.record("ExitTask", taskId, "COMPLETED", t.kind() + " " + t.getTitle());
        if (tasks.countByResignationIdAndStatus(r.getId(), TaskStatus.PENDING) == 0) {
            workflow.move(r, ResignationStatus.CLEARED, "All exit tasks and clearances are complete");
            producer.notify(r.getEmployeeId(), "EXIT_CLEARANCE_REQUESTED", r, java.util.Map.of("department", "all"), "cleared");
        }
        return toResponse(t);
    }

    private void requireMayComplete(ExitTask t, Resignation r) {
        String me = CurrentUser.employeeId();
        boolean hr = CurrentUser.hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN);
        if (hr) return;
        boolean employee = r.getEmployeeId().equals(me);
        boolean manager = me != null && me.equals(r.getManagerId());
        boolean ok = switch (t.kind()) {
            case "CHECKLIST" -> employee;
            case "KT" -> employee || manager;
            case "CLEARANCE" -> {
                String dept = ((ClearanceTask) t).getDepartment();
                yield ("MANAGER".equals(dept) && manager) || ("FINANCE".equals(dept) && CurrentUser.hasRole(Role.FINANCE_ADMIN));
            }
            default -> false;      // ASSET / ACCESS: HR (admin / IT desk work) only
        };
        if (!ok) throw new ForbiddenOperationException("You are not allowed to complete this task");
    }

    static TaskResponse toResponse(ExitTask t) {
        String department = null, topic = null, transferee = null, tag = null, condition = null, system = null;
        LocalDate returned = null, revoked = null;
        if (t instanceof ClearanceTask c) department = c.getDepartment();
        else if (t instanceof KnowledgeTransferTask k) {
            topic = k.getTopic();
            transferee = k.getTransfereeEmployeeId();
        } else if (t instanceof AssetReturnTask a) {
            tag = a.getAssetTag();
            condition = a.getAssetCondition();
            returned = a.getReturnedOn();
        } else if (t instanceof AccessRevocationTask a) {
            system = a.getSystemName();
            revoked = a.getRevokedOn();
        }
        return new TaskResponse(t.getId(), t.getResignationId(), t.kind(), t.getTitle(), t.getDueDate(), t.getStatus().name(), t.getCompletedAt(), t.getCompletedBy(), t.getRemarks(),
                department, topic, transferee, tag, condition, returned, system, revoked);
    }
}
