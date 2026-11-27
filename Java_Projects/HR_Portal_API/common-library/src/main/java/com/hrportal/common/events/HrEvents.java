package com.hrportal.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Event DTOs (one record per topic). All carry {@link EventMetadata} (id, type, version, timestamp, correlation id)
 * and the subject employee id. They are immutable records, so they serialise to / from JSON without extra code.
 */
public final class HrEvents {
    private HrEvents() {
    }

    // ---- employee lifecycle
    public record EmployeeCreated(EventMetadata metadata, String employeeId, String employeeCode, String firstName,
                                  String lastName, String workEmail, String departmentId, String designationId,
                                  String locationId, String managerId, String jobGradeId, LocalDate joiningDate,
                                  String status) implements HrEvent { }

    public record EmployeeUpdated(EventMetadata metadata, String employeeId, String employeeCode, String fullName,
                                  String workEmail, String departmentId, String designationId, String locationId,
                                  String managerId, String status, List<String> changedFields) implements HrEvent { }

    public record EmployeeTerminated(EventMetadata metadata, String employeeId, String employeeCode, String status,
                                     String reason, LocalDate effectiveDate) implements HrEvent { }

    // ---- leave
    public record LeaveApplied(EventMetadata metadata, String employeeId, String applicationId, String leaveType,
                               LocalDate fromDate, LocalDate toDate, BigDecimal days, String managerId,
                               String reason) implements HrEvent { }

    public record LeaveApproved(EventMetadata metadata, String employeeId, String applicationId, String leaveType,
                                LocalDate fromDate, LocalDate toDate, BigDecimal days, String decidedBy,
                                String comment) implements HrEvent { }

    public record LeaveRejected(EventMetadata metadata, String employeeId, String applicationId, String leaveType,
                                LocalDate fromDate, LocalDate toDate, BigDecimal days, String decidedBy,
                                String comment) implements HrEvent { }

    public record LeaveCancelled(EventMetadata metadata, String employeeId, String applicationId, String leaveType,
                                 LocalDate fromDate, LocalDate toDate, BigDecimal days, String decidedBy,
                                 String comment) implements HrEvent { }

    // ---- attendance
    public record AttendanceCheckedIn(EventMetadata metadata, String employeeId, String attendanceId, LocalDate date,
                                      Instant checkInTime, String workMode, int lateMinutes) implements HrEvent { }

    public record AttendanceCheckedOut(EventMetadata metadata, String employeeId, String attendanceId, LocalDate date,
                                       Instant checkOutTime, int workedMinutes, int overtimeMinutes,
                                       int earlyDepartureMinutes) implements HrEvent { }

    public record AttendanceCorrected(EventMetadata metadata, String employeeId, String attendanceId, LocalDate date,
                                      String correctedBy, String reason) implements HrEvent { }

    // ---- payroll
    public record PayrollLine(String employeeId, String departmentId, BigDecimal gross, BigDecimal deductions,
                              BigDecimal net) { }

    public record PayrollProcessed(EventMetadata metadata, String employeeId, String runId, String month,
                                   int employeeCount, BigDecimal totalGross, BigDecimal totalNet,
                                   List<PayrollLine> lines) implements HrEvent { }

    public record PayslipGenerated(EventMetadata metadata, String employeeId, String payslipId, String month,
                                   String filePath, String fileName) implements HrEvent { }

    // ---- tax
    public record TaxDeclarationSubmitted(EventMetadata metadata, String employeeId, String declarationId,
                                          String financialYear, String regime, BigDecimal totalDeclared) implements HrEvent { }

    public record TaxDeclarationReviewed(EventMetadata metadata, String employeeId, String declarationId,
                                         String financialYear, String decision, String reviewerId,
                                         String comment) implements HrEvent { }

    // ---- performance
    public record PerformanceReviewSubmitted(EventMetadata metadata, String employeeId, String reviewId, String cycleId,
                                             String stage, String managerId, BigDecimal rating) implements HrEvent { }

    public record PerformanceReviewApproved(EventMetadata metadata, String employeeId, String reviewId, String cycleId,
                                            BigDecimal finalRating) implements HrEvent { }

    // ---- timesheet
    public record TimesheetSubmitted(EventMetadata metadata, String employeeId, String timesheetId, LocalDate weekStart,
                                     BigDecimal totalHours, BigDecimal billableHours, String approverId) implements HrEvent { }

    public record TimesheetApproved(EventMetadata metadata, String employeeId, String timesheetId, LocalDate weekStart,
                                    BigDecimal totalHours, BigDecimal billableHours, String approverId) implements HrEvent { }

    // ---- exit
    public record ResignationSubmitted(EventMetadata metadata, String employeeId, String resignationId, String managerId,
                                       LocalDate requestedLastWorkingDay, int noticePeriodDays, String reason) implements HrEvent { }

    public record EmployeeExited(EventMetadata metadata, String employeeId, String resignationId, LocalDate lastWorkingDay,
                                 String exitType) implements HrEvent { }

    public record SettlementProcessed(EventMetadata metadata, String employeeId, String resignationId,
                                      BigDecimal netPayable, String paymentReference) implements HrEvent { }

    // ---- reference data / allocation
    public record HolidayChanged(EventMetadata metadata, String employeeId, String holidayId, String name, LocalDate date,
                                 String action, String locationId) implements HrEvent { }

    public record ProjectAllocationChanged(EventMetadata metadata, String employeeId, String projectId, String projectName,
                                           BigDecimal allocationPercent, String action, LocalDate startDate,
                                           LocalDate endDate) implements HrEvent { }

    // ---- notification command (any service -> notification-service)
    public record NotificationRequested(EventMetadata metadata, String employeeId, String recipientEmail, String type,
                                        String templateCode, Map<String, String> params, List<String> channels,
                                        String referenceType, String referenceId, String dedupKey) implements HrEvent {
        /** Convenience factory used by every service that wants to notify somebody (IN_APP + EMAIL). */
        public static NotificationRequested of(String employeeId, String recipientEmail, String type, String templateCode,
                                               Map<String, String> params, String referenceType, String referenceId,
                                               String dedupKey) {
            return new NotificationRequested(EventMetadata.of(Topics.NOTIFICATION_REQUESTED), employeeId, recipientEmail, type,
                    templateCode, params, List.of("IN_APP", "EMAIL"), referenceType, referenceId, dedupKey);
        }
    }
}
