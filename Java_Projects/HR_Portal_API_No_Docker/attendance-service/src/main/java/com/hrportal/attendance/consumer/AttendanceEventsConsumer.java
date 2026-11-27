package com.hrportal.attendance.consumer;

import java.time.Instant;
import java.time.LocalDate;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hrportal.attendance.entity.ApprovedLeaveDay;
import com.hrportal.attendance.entity.AttendanceEmployee;
import com.hrportal.attendance.entity.HolidaySnapshot;
import com.hrportal.attendance.repository.AttendanceRepositories.ApprovedLeaveDayRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.AttendanceEmployeeRepository;
import com.hrportal.attendance.repository.AttendanceRepositories.HolidaySnapshotRepository;
import com.hrportal.common.events.HrEvents.EmployeeCreated;
import com.hrportal.common.events.HrEvents.EmployeeExited;
import com.hrportal.common.events.HrEvents.EmployeeTerminated;
import com.hrportal.common.events.HrEvents.EmployeeUpdated;
import com.hrportal.common.events.HrEvents.HolidayChanged;
import com.hrportal.common.events.HrEvents.LeaveApproved;
import com.hrportal.common.events.HrEvents.LeaveCancelled;
import com.hrportal.common.events.Topics;
import com.hrportal.common.kafka.IdempotentEventProcessor;

/** Maintains the local projections attendance needs: employees, approved leave days, holidays. All handlers are idempotent. */
@Component
public class AttendanceEventsConsumer {
    private final IdempotentEventProcessor processor;
    private final AttendanceEmployeeRepository employees;
    private final ApprovedLeaveDayRepository leaveDays;
    private final HolidaySnapshotRepository holidays;

    public AttendanceEventsConsumer(IdempotentEventProcessor processor, AttendanceEmployeeRepository employees, ApprovedLeaveDayRepository leaveDays, HolidaySnapshotRepository holidays) {
        this.processor = processor;
        this.employees = employees;
        this.leaveDays = leaveDays;
        this.holidays = holidays;
    }

    @KafkaListener(topics = Topics.EMPLOYEE_CREATED, groupId = "hr-attendance-service")
    public void onCreated(String payload) {
        processor.handle(payload, EmployeeCreated.class, "attendance.employee-created", e -> {
            AttendanceEmployee a = employees.findById(e.employeeId()).orElseGet(AttendanceEmployee::new);
            a.setEmployeeId(e.employeeId());
            a.setFullName((e.firstName() + " " + e.lastName()).trim());
            a.setManagerId(e.managerId());
            a.setDepartmentId(e.departmentId());
            a.setLocationId(e.locationId());
            a.setJoiningDate(e.joiningDate());
            a.setStatus(e.status() == null ? "ACTIVE" : e.status());
            a.setUpdatedAt(Instant.now());
            employees.save(a);
        });
    }

    @KafkaListener(topics = Topics.EMPLOYEE_UPDATED, groupId = "hr-attendance-service")
    public void onUpdated(String payload) {
        processor.handle(payload, EmployeeUpdated.class, "attendance.employee-updated", e -> employees.findById(e.employeeId()).ifPresent(a -> {
            if (e.fullName() != null) a.setFullName(e.fullName());
            a.setManagerId(e.managerId());
            a.setDepartmentId(e.departmentId());
            a.setLocationId(e.locationId());
            if (e.status() != null) a.setStatus(e.status());
            a.setUpdatedAt(Instant.now());
            employees.save(a);
        }));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_TERMINATED, groupId = "hr-attendance-service")
    public void onTerminated(String payload) {
        processor.handle(payload, EmployeeTerminated.class, "attendance.employee-terminated", e -> mark(e.employeeId(), "TERMINATED"));
    }

    @KafkaListener(topics = Topics.EMPLOYEE_EXITED, groupId = "hr-attendance-service")
    public void onExited(String payload) {
        processor.handle(payload, EmployeeExited.class, "attendance.employee-exited", e -> mark(e.employeeId(), "TERMINATED".equals(e.exitType()) ? "TERMINATED" : "RESIGNED"));
    }

    private void mark(String employeeId, String status) {
        employees.findById(employeeId).ifPresent(a -> {
            a.setStatus(status);
            a.setUpdatedAt(Instant.now());
            employees.save(a);
        });
    }

    @KafkaListener(topics = Topics.LEAVE_APPROVED, groupId = "hr-attendance-service")
    public void onLeaveApproved(String payload) {
        processor.handle(payload, LeaveApproved.class, "attendance.leave-approved", e -> {
            leaveDays.deleteByApplicationId(e.applicationId());
            for (LocalDate d = e.fromDate(); !d.isAfter(e.toDate()); d = d.plusDays(1)) {
                ApprovedLeaveDay day = new ApprovedLeaveDay();
                day.setEmployeeId(e.employeeId());
                day.setLeaveDate(d);
                day.setApplicationId(e.applicationId());
                leaveDays.save(day);
            }
        });
    }

    @KafkaListener(topics = Topics.LEAVE_CANCELLED, groupId = "hr-attendance-service")
    public void onLeaveCancelled(String payload) {
        processor.handle(payload, LeaveCancelled.class, "attendance.leave-cancelled", e -> leaveDays.deleteByApplicationId(e.applicationId()));
    }

    @KafkaListener(topics = Topics.HOLIDAY_CHANGED, groupId = "hr-attendance-service")
    public void onHoliday(String payload) {
        processor.handle(payload, HolidayChanged.class, "attendance.holiday-changed", e -> {
            if ("DELETED".equals(e.action())) {
                holidays.deleteById(e.holidayId());
                return;
            }
            HolidaySnapshot s = holidays.findById(e.holidayId()).orElseGet(HolidaySnapshot::new);
            s.setHolidayId(e.holidayId());
            s.setHolidayDate(e.date());
            s.setName(e.name());
            s.setLocationId(e.locationId());
            holidays.save(s);
        });
    }
}
