package com.hrportal.timesheet.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.timesheet.entity.Enums.TimesheetStatus;
import com.hrportal.timesheet.entity.Timesheet;
import com.hrportal.timesheet.entity.TimesheetEmployee;
import com.hrportal.timesheet.entity.TimesheetEntry;
import com.hrportal.timesheet.entity.TimesheetHistory;
import com.hrportal.timesheet.entity.TimesheetTask;

public final class TimesheetRepositories {
    private TimesheetRepositories() {
    }

    public interface TimesheetRepository extends JpaRepository<Timesheet, String> {
        Optional<Timesheet> findByEmployeeIdAndWeekStart(String employeeId, LocalDate weekStart);

        Page<Timesheet> findByEmployeeIdAndWeekStartBetween(String employeeId, LocalDate from, LocalDate to, Pageable pageable);

        List<Timesheet> findByStatusOrderBySubmittedAtAsc(TimesheetStatus status);

        List<Timesheet> findByStatusAndApproverIdOrderBySubmittedAtAsc(TimesheetStatus status, String approverId);

        List<Timesheet> findByEmployeeIdInAndWeekStartBetween(Collection<String> employeeIds, LocalDate from, LocalDate to);

        /** Submitted timesheets that contain hours on a project of this project manager. */
        @Query("select distinct t from Timesheet t where t.status = com.hrportal.timesheet.entity.Enums$TimesheetStatus.SUBMITTED and t.id in "
                + "(select e.timesheetId from TimesheetEntry e where e.projectManagerId = :pmId) order by t.submittedAt")
        List<Timesheet> findSubmittedForProjectManager(@Param("pmId") String pmId);
    }

    public interface EntryRepository extends JpaRepository<TimesheetEntry, String> {
        List<TimesheetEntry> findByTimesheetIdOrderByWorkDateAscProjectIdAsc(String timesheetId);

        List<TimesheetEntry> findByTimesheetIdIn(Collection<String> timesheetIds);

        @Modifying
        @Query("delete from TimesheetEntry e where e.timesheetId = :timesheetId")
        int deleteByTimesheetId(@Param("timesheetId") String timesheetId);

        /** Hours per employee on a project in a date range - JPQL aggregate with a DTO-style projection. */
        @Query("select e.employeeId as employeeId, sum(e.hours) as hours, sum(case when e.billable = true then e.hours else 0 end) as billableHours "
                + "from TimesheetEntry e join Timesheet t on t.id = e.timesheetId where e.projectId = :projectId and e.workDate between :from and :to "
                + "and t.status = com.hrportal.timesheet.entity.Enums$TimesheetStatus.APPROVED group by e.employeeId order by sum(e.hours) desc")
        List<HoursByEmployee> approvedHoursByEmployee(@Param("projectId") String projectId, @Param("from") LocalDate from, @Param("to") LocalDate to);

        interface HoursByEmployee {
            String getEmployeeId();

            BigDecimal getHours();

            BigDecimal getBillableHours();
        }
    }

    public interface HistoryRepository extends JpaRepository<TimesheetHistory, String> {
        List<TimesheetHistory> findByTimesheetIdOrderByCreatedAtAsc(String timesheetId);
    }

    public interface TaskRepository extends JpaRepository<TimesheetTask, String> {
        List<TimesheetTask> findByProjectIdAndActiveTrueOrderByName(String projectId);

        boolean existsByProjectIdAndCodeIgnoreCase(String projectId, String code);
    }

    public interface TimesheetEmployeeRepository extends JpaRepository<TimesheetEmployee, String> {
        List<TimesheetEmployee> findByManagerId(String managerId);
    }
}
