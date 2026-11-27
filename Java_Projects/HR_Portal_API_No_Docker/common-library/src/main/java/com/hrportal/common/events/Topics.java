package com.hrportal.common.events;

import java.util.List;

/** Kafka topic names: one constant per business event. */
public final class Topics {
    private Topics() {
    }

    public static final String EMPLOYEE_CREATED = "employee.created";
    public static final String EMPLOYEE_UPDATED = "employee.updated";
    public static final String EMPLOYEE_TERMINATED = "employee.terminated";
    public static final String LEAVE_APPLIED = "leave.applied";
    public static final String LEAVE_APPROVED = "leave.approved";
    public static final String LEAVE_REJECTED = "leave.rejected";
    public static final String LEAVE_CANCELLED = "leave.cancelled";
    public static final String ATTENDANCE_CHECKED_IN = "attendance.checked-in";
    public static final String ATTENDANCE_CHECKED_OUT = "attendance.checked-out";
    public static final String ATTENDANCE_CORRECTED = "attendance.corrected";
    public static final String PAYROLL_PROCESSED = "payroll.processed";
    public static final String PAYSLIP_GENERATED = "payslip.generated";
    public static final String TAX_DECLARATION_SUBMITTED = "tax.declaration.submitted";
    public static final String TAX_DECLARATION_REVIEWED = "tax.declaration.reviewed";
    public static final String PERFORMANCE_REVIEW_SUBMITTED = "performance.review.submitted";
    public static final String PERFORMANCE_REVIEW_APPROVED = "performance.review.approved";
    public static final String TIMESHEET_SUBMITTED = "timesheet.submitted";
    public static final String TIMESHEET_APPROVED = "timesheet.approved";
    public static final String RESIGNATION_SUBMITTED = "resignation.submitted";
    public static final String EMPLOYEE_EXITED = "employee.exited";
    public static final String SETTLEMENT_PROCESSED = "settlement.processed";
    public static final String HOLIDAY_CHANGED = "holiday.changed";
    public static final String PROJECT_ALLOCATION_CHANGED = "project.allocation.changed";
    public static final String NOTIFICATION_REQUESTED = "notification.requested";

    public static final String DLT_SUFFIX = ".DLT";

    public static final List<String> ALL = List.of(EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_TERMINATED,
            LEAVE_APPLIED, LEAVE_APPROVED, LEAVE_REJECTED, LEAVE_CANCELLED,
            ATTENDANCE_CHECKED_IN, ATTENDANCE_CHECKED_OUT, ATTENDANCE_CORRECTED,
            PAYROLL_PROCESSED, PAYSLIP_GENERATED, TAX_DECLARATION_SUBMITTED, TAX_DECLARATION_REVIEWED,
            PERFORMANCE_REVIEW_SUBMITTED, PERFORMANCE_REVIEW_APPROVED, TIMESHEET_SUBMITTED, TIMESHEET_APPROVED,
            RESIGNATION_SUBMITTED, EMPLOYEE_EXITED, SETTLEMENT_PROCESSED, HOLIDAY_CHANGED,
            PROJECT_ALLOCATION_CHANGED, NOTIFICATION_REQUESTED);
}
