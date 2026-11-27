package com.hrportal.reporting.consumer;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.function.Consumer;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.common.events.HrEvents.AttendanceCheckedIn;
import com.hrportal.common.events.HrEvents.AttendanceCheckedOut;
import com.hrportal.common.events.HrEvents.AttendanceCorrected;
import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.HrEvents.LeaveApplied;
import com.hrportal.common.events.HrEvents.LeaveApproved;
import com.hrportal.common.events.HrEvents.LeaveCancelled;
import com.hrportal.common.events.HrEvents.LeaveRejected;
import com.hrportal.common.events.HrEvents.PayrollLine;
import com.hrportal.common.events.HrEvents.PayrollProcessed;
import com.hrportal.common.events.HrEvents.PerformanceReviewApproved;
import com.hrportal.common.events.HrEvents.PerformanceReviewSubmitted;
import com.hrportal.common.events.HrEvents.ProjectAllocationChanged;
import com.hrportal.common.events.HrEvents.ResignationSubmitted;
import com.hrportal.common.events.HrEvents.TaxDeclarationReviewed;
import com.hrportal.common.events.HrEvents.TaxDeclarationSubmitted;
import com.hrportal.common.events.HrEvents.TimesheetApproved;
import com.hrportal.common.events.HrEvents.TimesheetSubmitted;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;
import com.hrportal.reporting.entity.ReportFact;
import com.hrportal.reporting.entity.RptEmployee;
import com.hrportal.reporting.repository.ReportingRepositories.EmployeeRepository;
import com.hrportal.reporting.repository.ReportingRepositories.FactRepository;

/** Keeps the reporting tables current from Kafka. Every handler is idempotent (IdempotentEventProcessor) AND an upsert, so replays are harmless. */
@Component
public class ReportingConsumers {
    private final IdempotentEventProcessor processor;
    private final EmployeeRepository employees;
    private final FactRepository facts;

    public ReportingConsumers(IdempotentEventProcessor processor, EmployeeRepository employees, FactRepository facts) {
        this.processor = processor;
        this.employees = employees;
        this.facts = facts;
    }

    private static final String G = "hr-reporting-service";

    // ---------------------------------------------------------------- employees
    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = G)
    public void employeeCreated(String p) {
        processor.handle(p, EmployeeCreated.class, "reporting.employee-created", e -> {
            RptEmployee r = employees.findById(e.employeeId()).orElseGet(RptEmployee::new);
            r.setEmployeeId(e.employeeId());
            r.setEmployeeCode(e.employeeCode());
            r.setFullName((e.firstName() + " " + e.lastName()).trim());
            r.setDepartmentId(e.departmentId());
            r.setDesignationId(e.designationId());
            r.setLocationId(e.locationId());
            r.setManagerId(e.managerId());
            r.setStatus(e.status() == null ? "ACTIVE" : e.status());
            r.setJoiningDate(e.joiningDate());
            r.setUpdatedAt(Instant.now());
            employees.save(r);
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = G)
    public void employeeUpdated(String p) {
        processor.handle(p, EmployeeUpdated.class, "reporting.employee-updated", e -> employees.findById(e.employeeId()).ifPresent(r -> {
            r.setEmployeeCode(e.employeeCode());
            if (e.fullName() != null) r.setFullName(e.fullName());
            r.setDepartmentId(e.departmentId());
            r.setDesignationId(e.designationId());
            r.setLocationId(e.locationId());
            r.setManagerId(e.managerId());
            if (e.status() != null) r.setStatus(e.status());
            r.setUpdatedAt(Instant.now());
            employees.save(r);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = G)
    public void employeeTerminated(String p) {
        processor.handle(p, EmployeeTerminated.class, "reporting.employee-terminated", e -> employees.findById(e.employeeId()).ifPresent(r -> {
            r.setStatus("TERMINATED");
            r.setExitDate(e.effectiveDate());
            employees.save(r);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = G)
    public void employeeExited(String p) {
        processor.handle(p, EmployeeExited.class, "reporting.employee-exited", e -> {
            employees.findById(e.employeeId()).ifPresent(r -> {
                r.setStatus("TERMINATED".equals(e.exitType()) ? "TERMINATED" : "RESIGNED");
                r.setExitDate(e.lastWorkingDay());
                employees.save(r);
            });
            fact("EXIT", e.resignationId(), e.employeeId(), f -> {
                f.setStatus("EXITED");
                f.setDateA(e.lastWorkingDay());
                f.setPeriodKey(e.lastWorkingDay() == null ? null : YearMonth.from(e.lastWorkingDay()).toString());
            });
        });
    }

    // ---------------------------------------------------------------- leave
    @KafkaListener(topics = Topics.LEAVE_APPLIED, groupId = G)
    public void leaveApplied(String p) {
        processor.handle(p, LeaveApplied.class, "reporting.leave-applied", e -> leave(e.applicationId(), e.employeeId(), e.leaveType(), e.fromDate(), e.toDate(), e.days(), "APPLIED"));
    }

    @KafkaListener(topics = Topics.LEAVE_APPROVED, groupId = G)
    public void leaveApproved(String p) {
        processor.handle(p, LeaveApproved.class, "reporting.leave-approved", e -> leave(e.applicationId(), e.employeeId(), e.leaveType(), e.fromDate(), e.toDate(), e.days(), "APPROVED"));
    }

    @KafkaListener(topics = Topics.LEAVE_REJECTED, groupId = G)
    public void leaveRejected(String p) {
        processor.handle(p, LeaveRejected.class, "reporting.leave-rejected", e -> leave(e.applicationId(), e.employeeId(), e.leaveType(), e.fromDate(), e.toDate(), e.days(), "REJECTED"));
    }

    @KafkaListener(topics = Topics.LEAVE_CANCELLED, groupId = G)
    public void leaveCancelled(String p) {
        processor.handle(p, LeaveCancelled.class, "reporting.leave-cancelled", e -> leave(e.applicationId(), e.employeeId(), e.leaveType(), e.fromDate(), e.toDate(), e.days(), "CANCELLED"));
    }

    private void leave(String id, String employeeId, String type, LocalDate from, LocalDate to, BigDecimal days, String status) {
        fact("LEAVE", id, employeeId, f -> {
            f.setCategory(type);
            f.setStatus(status);
            f.setNumA(days);
            f.setDateA(from);
            f.setDateB(to);
            f.setPeriodKey(YearMonth.from(from).toString());
        });
    }

    // ---------------------------------------------------------------- attendance
    @KafkaListener(topics = Topics.ATTENDANCE_CHECKED_IN, groupId = G)
    public void checkedIn(String p) {
        processor.handle(p, AttendanceCheckedIn.class, "reporting.attendance-in", e -> fact("ATTENDANCE", e.employeeId() + ":" + e.date(), e.employeeId(), f -> {
            f.setStatus("CHECKED_IN");
            f.setCategory(e.workMode());
            f.setNumB(BigDecimal.valueOf(e.lateMinutes()));
            f.setDateA(e.date());
            f.setPeriodKey(YearMonth.from(e.date()).toString());
        }));
    }

    @KafkaListener(topics = Topics.ATTENDANCE_CHECKED_OUT, groupId = G)
    public void checkedOut(String p) {
        processor.handle(p, AttendanceCheckedOut.class, "reporting.attendance-out", e -> fact("ATTENDANCE", e.employeeId() + ":" + e.date(), e.employeeId(), f -> {
            f.setStatus("CHECKED_OUT");
            f.setNumA(BigDecimal.valueOf(e.workedMinutes()));
            f.setNumC(BigDecimal.valueOf(e.overtimeMinutes()));
            f.setDateA(e.date());
            f.setPeriodKey(YearMonth.from(e.date()).toString());
        }));
    }

    @KafkaListener(topics = Topics.ATTENDANCE_CORRECTED, groupId = G)
    public void corrected(String p) {
        processor.handle(p, AttendanceCorrected.class, "reporting.attendance-corrected", e -> fact("ATTENDANCE", e.employeeId() + ":" + e.date(), e.employeeId(), f -> {
            f.setStatus("CORRECTED");
            f.setDateA(e.date());
            f.setPeriodKey(YearMonth.from(e.date()).toString());
        }));
    }

    // ---------------------------------------------------------------- payroll (per employee, only totals - no component detail)
    @KafkaListener(topics = Topics.PAYROLL_PROCESSED, groupId = G)
    public void payroll(String p) {
        processor.handle(p, PayrollProcessed.class, "reporting.payroll-processed", e -> {
            for (PayrollLine l : e.lines()) {
                fact("PAYROLL", e.runId() + ":" + l.employeeId(), l.employeeId(), f -> {
                    f.setDepartmentId(l.departmentId());
                    f.setPeriodKey(e.month());
                    f.setStatus("FINALIZED");
                    f.setNumA(l.gross());
                    f.setNumB(l.deductions());
                    f.setNumC(l.net());
                });
            }
        });
    }

    // ---------------------------------------------------------------- tax
    @KafkaListener(topics = Topics.TAX_DECLARATION_SUBMITTED, groupId = G)
    public void taxSubmitted(String p) {
        processor.handle(p, TaxDeclarationSubmitted.class, "reporting.tax-submitted", e -> fact("TAX", e.declarationId(), e.employeeId(), f -> {
            f.setPeriodKey(e.financialYear());
            f.setCategory(e.regime());
            f.setStatus("SUBMITTED");
            f.setNumA(e.totalDeclared());
        }));
    }

    @KafkaListener(topics = Topics.TAX_DECLARATION_REVIEWED, groupId = G)
    public void taxReviewed(String p) {
        processor.handle(p, TaxDeclarationReviewed.class, "reporting.tax-reviewed", e -> fact("TAX", e.declarationId(), e.employeeId(), f -> {
            f.setPeriodKey(e.financialYear());
            f.setStatus(e.decision());
        }));
    }

    // ---------------------------------------------------------------- timesheets
    @KafkaListener(topics = Topics.TIMESHEET_SUBMITTED, groupId = G)
    public void timesheetSubmitted(String p) {
        processor.handle(p, TimesheetSubmitted.class, "reporting.timesheet-submitted", e -> timesheet(e.timesheetId(), e.employeeId(), e.weekStart(), e.totalHours(), e.billableHours(), "SUBMITTED"));
    }

    @KafkaListener(topics = Topics.TIMESHEET_APPROVED, groupId = G)
    public void timesheetApproved(String p) {
        processor.handle(p, TimesheetApproved.class, "reporting.timesheet-approved", e -> timesheet(e.timesheetId(), e.employeeId(), e.weekStart(), e.totalHours(), e.billableHours(), "APPROVED"));
    }

    private void timesheet(String id, String employeeId, LocalDate week, BigDecimal total, BigDecimal billable, String status) {
        fact("TIMESHEET", id, employeeId, f -> {
            f.setPeriodKey(YearMonth.from(week).toString());
            f.setDateA(week);
            f.setStatus(status);
            f.setNumA(total);
            f.setNumB(billable);
        });
    }

    // ---------------------------------------------------------------- performance
    @KafkaListener(topics = Topics.PERFORMANCE_REVIEW_SUBMITTED, groupId = G)
    public void reviewSubmitted(String p) {
        processor.handle(p, PerformanceReviewSubmitted.class, "reporting.review-submitted", e -> fact("REVIEW", e.reviewId(), e.employeeId(), f -> {
            f.setPeriodKey(e.cycleId());
            f.setCategory(e.stage());
            f.setStatus(e.stage() + "_SUBMITTED");
            if ("SELF".equals(e.stage())) f.setNumA(e.rating());
            else f.setNumB(e.rating());
        }));
    }

    @KafkaListener(topics = Topics.PERFORMANCE_REVIEW_APPROVED, groupId = G)
    public void reviewApproved(String p) {
        processor.handle(p, PerformanceReviewApproved.class, "reporting.review-approved", e -> fact("REVIEW", e.reviewId(), e.employeeId(), f -> {
            f.setPeriodKey(e.cycleId());
            f.setStatus("APPROVED");
            f.setNumC(e.finalRating());
        }));
    }

    // ---------------------------------------------------------------- exit / allocation
    @KafkaListener(topics = Topics.RESIGNATION_SUBMITTED, groupId = G)
    public void resignation(String p) {
        processor.handle(p, ResignationSubmitted.class, "reporting.resignation", e -> fact("EXIT", e.resignationId(), e.employeeId(), f -> {
            f.setStatus("RESIGNED");
            f.setNumA(BigDecimal.valueOf(e.noticePeriodDays()));
            f.setDateA(e.requestedLastWorkingDay());
            f.setPeriodKey(YearMonth.from(e.requestedLastWorkingDay()).toString());
            f.setCategory(e.reason() == null ? null : e.reason().substring(0, Math.min(60, e.reason().length())));
        }));
    }

    @KafkaListener(topics = Topics.PROJECT_ALLOCATION_CHANGED, groupId = G)
    public void allocation(String p) {
        processor.handle(p, ProjectAllocationChanged.class, "reporting.allocation", e -> fact("ALLOCATION", e.employeeId() + ":" + e.projectId(), e.employeeId(), f -> {
            f.setCategory(e.projectName());
            f.setStatus("ENDED".equals(e.action()) ? "ENDED" : "ACTIVE");
            f.setNumA(e.allocationPercent());
            f.setDateA(e.startDate());
            f.setDateB(e.endDate());
            f.setPeriodKey(e.projectId());
        }));
    }

    /**
     * Upsert with ORDER PROTECTION. Events of one fact arrive on different topics (leave.applied / leave.approved ...) and Kafka only orders
     * messages inside one partition, so "applied" can be consumed AFTER "approved". Every status has a rank; an event whose status ranks LOWER than
     * the stored one is stale: it may only fill fields that are still empty and never moves the status backwards.
     */
    private void fact(String type, String key, String employeeId, Consumer<ReportFact> fill) {
        ReportFact incoming = new ReportFact();
        fill.accept(incoming);
        ReportFact f = facts.findByFactTypeAndSubjectKey(type, key).orElse(null);
        if (f == null) {
            f = incoming;
            f.setFactType(type);
            f.setSubjectKey(key);
            f.setEmployeeId(employeeId);
            if (employeeId != null) employees.findById(employeeId).ifPresent(e -> incoming.setDepartmentId(incoming.getDepartmentId() != null ? incoming.getDepartmentId() : e.getDepartmentId()));
        } else if (rank(incoming.getStatus()) >= rank(f.getStatus())) {
            copy(incoming, f, true);
        } else {
            copy(incoming, f, false);       // stale event: only fill gaps
        }
        f.setOccurredAt(Instant.now());
        facts.save(f);
    }

    private static void copy(ReportFact from, ReportFact to, boolean overwrite) {
        if (overwrite || to.getStatus() == null) to.setStatus(from.getStatus() != null ? from.getStatus() : to.getStatus());
        if (from.getDepartmentId() != null && (overwrite || to.getDepartmentId() == null)) to.setDepartmentId(from.getDepartmentId());
        if (from.getPeriodKey() != null && (overwrite || to.getPeriodKey() == null)) to.setPeriodKey(from.getPeriodKey());
        if (from.getCategory() != null && (overwrite || to.getCategory() == null)) to.setCategory(from.getCategory());
        if (from.getNumA() != null && (overwrite || to.getNumA() == null)) to.setNumA(from.getNumA());
        if (from.getNumB() != null && (overwrite || to.getNumB() == null)) to.setNumB(from.getNumB());
        if (from.getNumC() != null && (overwrite || to.getNumC() == null)) to.setNumC(from.getNumC());
        if (from.getDateA() != null && (overwrite || to.getDateA() == null)) to.setDateA(from.getDateA());
        if (from.getDateB() != null && (overwrite || to.getDateB() == null)) to.setDateB(from.getDateB());
    }

    /** Lifecycle rank of a status (higher = later in the business lifecycle). */
    private static int rank(String status) {
        if (status == null) return 0;
        return switch (status) {
            case "APPLIED", "CHECKED_IN", "SUBMITTED", "SELF_SUBMITTED", "RESIGNED", "ACTIVE", "FINALIZED" -> 1;
            case "CHECKED_OUT", "REJECTED", "MANAGER_SUBMITTED", "UNDER_REVIEW" -> 2;
            case "APPROVED" -> 3;
            case "CORRECTED", "CANCELLED", "EXITED", "ENDED" -> 4;
            default -> 1;
        };
    }
}
