package com.hrportal.attendance.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.attendance.entity.ApprovedLeaveDay;
import com.hrportal.attendance.entity.AttendanceCorrection;
import com.hrportal.attendance.entity.AttendanceEmployee;
import com.hrportal.attendance.entity.AttendanceRecord;
import com.hrportal.attendance.entity.Enums.RequestStatus;
import com.hrportal.attendance.entity.HolidaySnapshot;
import com.hrportal.attendance.entity.MonthlySummary;
import com.hrportal.attendance.entity.Shift;
import com.hrportal.attendance.entity.ShiftAssignment;
import com.hrportal.attendance.entity.WfhRequest;

public final class AttendanceRepositories {
    private AttendanceRepositories() {
    }

    public interface ShiftRepository extends JpaRepository<Shift, String> {
        Optional<Shift> findFirstByDefaultShiftTrueAndActiveTrue();

        Optional<Shift> findByCodeIgnoreCase(String code);
    }

    public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, String> {
        /** Latest assignment in force on a date. */
        @Query("select a from ShiftAssignment a where a.employeeId = :employeeId and a.effectiveFrom <= :date and (a.effectiveTo is null or a.effectiveTo >= :date) order by a.effectiveFrom desc")
        List<ShiftAssignment> findInForce(@Param("employeeId") String employeeId, @Param("date") LocalDate date);

        List<ShiftAssignment> findByEmployeeIdOrderByEffectiveFromDesc(String employeeId);

        @Query("select count(a) > 0 from ShiftAssignment a where a.employeeId = :employeeId and a.effectiveFrom <= :to and (a.effectiveTo is null or a.effectiveTo >= :from)")
        boolean existsOverlap(@Param("employeeId") String employeeId, @Param("from") LocalDate from, @Param("to") LocalDate to);
    }

    public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, String> {
        Optional<AttendanceRecord> findByEmployeeIdAndWorkDate(String employeeId, LocalDate workDate);

        List<AttendanceRecord> findByEmployeeIdAndWorkDateBetweenOrderByWorkDate(String employeeId, LocalDate from, LocalDate to);

        List<AttendanceRecord> findByWorkDateOrderByEmployeeId(LocalDate workDate);

        List<AttendanceRecord> findByWorkDateAndEmployeeIdIn(LocalDate workDate, Collection<String> employeeIds);

        /** Open punches from earlier days: checked in, never checked out. */
        @Query("select r from AttendanceRecord r where r.workDate < :before and r.checkIn is not null and r.checkOut is null and r.status <> com.hrportal.attendance.entity.Enums$AttendanceStatus.MISSING_PUNCH")
        List<AttendanceRecord> findOpenBefore(@Param("before") LocalDate before);
    }

    public interface CorrectionRepository extends JpaRepository<AttendanceCorrection, String> {
        List<AttendanceCorrection> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        List<AttendanceCorrection> findByStatusOrderByCreatedAtAsc(RequestStatus status);

        List<AttendanceCorrection> findByStatusAndManagerIdOrderByCreatedAtAsc(RequestStatus status, String managerId);

        boolean existsByEmployeeIdAndWorkDateAndStatus(String employeeId, LocalDate workDate, RequestStatus status);
    }

    public interface WfhRepository extends JpaRepository<WfhRequest, String> {
        List<WfhRequest> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        List<WfhRequest> findByStatusAndManagerIdOrderByCreatedAtAsc(RequestStatus status, String managerId);

        List<WfhRequest> findByStatusOrderByCreatedAtAsc(RequestStatus status);

        @Query("select count(w) > 0 from WfhRequest w where w.employeeId = :employeeId and w.status = com.hrportal.attendance.entity.Enums$RequestStatus.APPROVED and w.fromDate <= :date and w.toDate >= :date")
        boolean isApprovedOn(@Param("employeeId") String employeeId, @Param("date") LocalDate date);

        @Query("select count(w) > 0 from WfhRequest w where w.employeeId = :employeeId and w.status in (com.hrportal.attendance.entity.Enums$RequestStatus.PENDING, com.hrportal.attendance.entity.Enums$RequestStatus.APPROVED) and w.fromDate <= :to and w.toDate >= :from")
        boolean existsOverlap(@Param("employeeId") String employeeId, @Param("from") LocalDate from, @Param("to") LocalDate to);
    }

    public interface HolidaySnapshotRepository extends JpaRepository<HolidaySnapshot, String> {
        @Query("select h from HolidaySnapshot h where h.holidayDate between :from and :to and (h.locationId is null or h.locationId = :locationId)")
        List<HolidaySnapshot> findForLocation(@Param("from") LocalDate from, @Param("to") LocalDate to, @Param("locationId") String locationId);
    }

    public interface ApprovedLeaveDayRepository extends JpaRepository<ApprovedLeaveDay, String> {
        @Modifying
        @Query("delete from ApprovedLeaveDay d where d.applicationId = :applicationId")
        int deleteByApplicationId(@Param("applicationId") String applicationId);

        List<ApprovedLeaveDay> findByEmployeeIdAndLeaveDateBetween(String employeeId, LocalDate from, LocalDate to);
    }

    public interface AttendanceEmployeeRepository extends JpaRepository<AttendanceEmployee, String> {
        List<AttendanceEmployee> findByManagerIdAndStatusIn(String managerId, Collection<String> statuses);

        List<AttendanceEmployee> findByStatusIn(Collection<String> statuses);
    }

    public interface MonthlySummaryRepository extends JpaRepository<MonthlySummary, String> {
        Optional<MonthlySummary> findByEmployeeIdAndSummaryYearAndSummaryMonth(String employeeId, int year, int month);

        @Query("select s from MonthlySummary s where s.generatedAt < :before")
        List<MonthlySummary> findStale(@Param("before") Instant before);
    }
}
