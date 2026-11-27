using System;
using System.Collections.Generic;
using HR.AttendanceService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.AttendanceService.Data;

public partial class AttendanceDbContext : HR.Common.Data.HrDbContext
{
    public AttendanceDbContext(DbContextOptions<AttendanceDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<ApprovedLeaveDay> ApprovedLeaveDays { get; set; }

    public virtual DbSet<AttendanceCorrection> AttendanceCorrections { get; set; }

    public virtual DbSet<AttendanceEmployee> AttendanceEmployees { get; set; }

    public virtual DbSet<AttendanceRecord> AttendanceRecords { get; set; }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<HolidaySnapshot> HolidaySnapshots { get; set; }

    public virtual DbSet<MonthlyAttendanceSummary> MonthlyAttendanceSummaries { get; set; }

    public virtual DbSet<Shift> Shifts { get; set; }

    public virtual DbSet<ShiftAssignment> ShiftAssignments { get; set; }

    public virtual DbSet<VwMonthlyAttendanceSummary> VwMonthlyAttendanceSummaries { get; set; }

    public virtual DbSet<WfhRequest> WfhRequests { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_0900_ai_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.Entity<ApprovedLeaveDay>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("approved_leave_days");

            entity.HasIndex(e => new { e.EmployeeId, e.LeaveDate }, "idx_leave_day_employee");

            entity.HasIndex(e => new { e.EmployeeId, e.LeaveDate, e.ApplicationId }, "uk_leave_day").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(36)
                .HasColumnName("application_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.LeaveDate).HasColumnName("leave_date");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<AttendanceCorrection>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("attendance_corrections");

            entity.HasIndex(e => new { e.EmployeeId, e.WorkDate }, "idx_correction_employee");

            entity.HasIndex(e => new { e.Status, e.ManagerId }, "idx_correction_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.Escalated)
                .HasColumnType("bit(1)")
                .HasColumnName("escalated");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.Reason)
                .HasMaxLength(500)
                .HasColumnName("reason");
            entity.Property(e => e.RequestedCheckIn)
                .HasMaxLength(6)
                .HasColumnName("requested_check_in");
            entity.Property(e => e.RequestedCheckOut)
                .HasMaxLength(6)
                .HasColumnName("requested_check_out");
            entity.Property(e => e.ReviewComment)
                .HasMaxLength(500)
                .HasColumnName("review_comment");
            entity.Property(e => e.ReviewedAt)
                .HasMaxLength(6)
                .HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(36)
                .HasColumnName("reviewer_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','CANCELLED','PENDING','REJECTED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WorkDate).HasColumnName("work_date");
        });

        modelBuilder.Entity<AttendanceEmployee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("attendance_employees");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.FullName)
                .HasMaxLength(200)
                .HasColumnName("full_name");
            entity.Property(e => e.JoiningDate).HasColumnName("joining_date");
            entity.Property(e => e.LocationId)
                .HasMaxLength(36)
                .HasColumnName("location_id");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.Status)
                .HasMaxLength(15)
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("attendance_records");

            entity.HasIndex(e => e.WorkDate, "idx_attendance_date");

            entity.HasIndex(e => new { e.EmployeeId, e.WorkDate }, "uk_attendance_employee_date").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CheckIn)
                .HasMaxLength(6)
                .HasColumnName("check_in");
            entity.Property(e => e.CheckOut)
                .HasMaxLength(6)
                .HasColumnName("check_out");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EarlyDepartureMinutes).HasColumnName("early_departure_minutes");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.LateMinutes).HasColumnName("late_minutes");
            entity.Property(e => e.OvertimeMinutes).HasColumnName("overtime_minutes");
            entity.Property(e => e.Remarks)
                .HasMaxLength(300)
                .HasColumnName("remarks");
            entity.Property(e => e.ShiftId)
                .HasMaxLength(36)
                .HasColumnName("shift_id");
            entity.Property(e => e.Source)
                .HasColumnType("enum('CORRECTION','IMPORT','SYSTEM','WEB')")
                .HasColumnName("source");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ABSENT','HALF_DAY','MISSING_PUNCH','PRESENT')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
            entity.Property(e => e.WorkDate).HasColumnName("work_date");
            entity.Property(e => e.WorkMode)
                .HasColumnType("enum('OFFICE','WFH')")
                .HasColumnName("work_mode");
            entity.Property(e => e.WorkedMinutes).HasColumnName("worked_minutes");
        });

        modelBuilder.Entity<AuditHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("audit_history");

            entity.HasIndex(e => e.CreatedAt, "idx_audit_created");

            entity.HasIndex(e => new { e.EntityType, e.EntityId }, "idx_audit_entity");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(60)
                .HasColumnName("action");
            entity.Property(e => e.CorrelationId)
                .HasMaxLength(64)
                .HasColumnName("correlation_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.EntityId)
                .HasMaxLength(64)
                .HasColumnName("entity_id");
            entity.Property(e => e.EntityType)
                .HasMaxLength(80)
                .HasColumnName("entity_type");
            entity.Property(e => e.NewValue)
                .HasColumnType("mediumtext")
                .HasColumnName("new_value");
            entity.Property(e => e.PreviousValue)
                .HasColumnType("mediumtext")
                .HasColumnName("previous_value");
            entity.Property(e => e.UserId)
                .HasMaxLength(100)
                .HasColumnName("user_id");
        });

        modelBuilder.Entity<HolidaySnapshot>(entity =>
        {
            entity.HasKey(e => e.HolidayId).HasName("PRIMARY");

            entity.ToTable("holiday_snapshots");

            entity.HasIndex(e => e.HolidayDate, "idx_holiday_snapshot_date");

            entity.Property(e => e.HolidayId)
                .HasMaxLength(36)
                .HasColumnName("holiday_id");
            entity.Property(e => e.HolidayDate).HasColumnName("holiday_date");
            entity.Property(e => e.LocationId)
                .HasMaxLength(36)
                .HasColumnName("location_id");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
        });

        modelBuilder.Entity<MonthlyAttendanceSummary>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("monthly_attendance_summary");

            entity.HasIndex(e => new { e.EmployeeId, e.SummaryYear, e.SummaryMonth }, "uk_summary_employee_month").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AbsentDays).HasColumnName("absent_days");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EarlyCount).HasColumnName("early_count");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.GeneratedAt)
                .HasMaxLength(6)
                .HasColumnName("generated_at");
            entity.Property(e => e.HalfDays).HasColumnName("half_days");
            entity.Property(e => e.Holidays).HasColumnName("holidays");
            entity.Property(e => e.LateCount).HasColumnName("late_count");
            entity.Property(e => e.LateMinutes).HasColumnName("late_minutes");
            entity.Property(e => e.LeaveDays).HasColumnName("leave_days");
            entity.Property(e => e.MissingPunches).HasColumnName("missing_punches");
            entity.Property(e => e.OvertimeMinutes).HasColumnName("overtime_minutes");
            entity.Property(e => e.PresentDays).HasColumnName("present_days");
            entity.Property(e => e.SummaryMonth).HasColumnName("summary_month");
            entity.Property(e => e.SummaryYear).HasColumnName("summary_year");
            entity.Property(e => e.TotalDays).HasColumnName("total_days");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WeeklyOffs).HasColumnName("weekly_offs");
            entity.Property(e => e.WfhDays).HasColumnName("wfh_days");
            entity.Property(e => e.WorkedMinutes).HasColumnName("worked_minutes");
            entity.Property(e => e.WorkingDays).HasColumnName("working_days");
        });

        modelBuilder.Entity<Shift>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("shifts");

            entity.HasIndex(e => e.Code, "uk_shift_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.Code)
                .HasMaxLength(20)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.EndTime)
                .HasMaxLength(6)
                .HasColumnName("end_time");
            entity.Property(e => e.FullDayMinutes).HasColumnName("full_day_minutes");
            entity.Property(e => e.GraceMinutes).HasColumnName("grace_minutes");
            entity.Property(e => e.HalfDayMinutes).HasColumnName("half_day_minutes");
            entity.Property(e => e.IsDefault)
                .HasColumnType("bit(1)")
                .HasColumnName("is_default");
            entity.Property(e => e.Name)
                .HasMaxLength(80)
                .HasColumnName("name");
            entity.Property(e => e.OvertimeThresholdMinutes).HasColumnName("overtime_threshold_minutes");
            entity.Property(e => e.StandardMinutes).HasColumnName("standard_minutes");
            entity.Property(e => e.StartTime)
                .HasMaxLength(6)
                .HasColumnName("start_time");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WeeklyOffs)
                .HasMaxLength(40)
                .HasColumnName("weekly_offs");
        });

        modelBuilder.Entity<ShiftAssignment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("shift_assignments");

            entity.HasIndex(e => new { e.EmployeeId, e.EffectiveFrom }, "idx_assignment_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.ShiftId)
                .HasMaxLength(36)
                .HasColumnName("shift_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<VwMonthlyAttendanceSummary>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_monthly_attendance_summary");

            entity.Property(e => e.AbsentDays).HasColumnName("absent_days");
            entity.Property(e => e.AttendancePercent)
                .HasPrecision(18, 1)
                .HasColumnName("attendance_percent");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.GeneratedAt)
                .HasMaxLength(6)
                .HasColumnName("generated_at");
            entity.Property(e => e.HalfDays).HasColumnName("half_days");
            entity.Property(e => e.Holidays).HasColumnName("holidays");
            entity.Property(e => e.LateCount).HasColumnName("late_count");
            entity.Property(e => e.LeaveDays).HasColumnName("leave_days");
            entity.Property(e => e.MissingPunches).HasColumnName("missing_punches");
            entity.Property(e => e.OvertimeMinutes).HasColumnName("overtime_minutes");
            entity.Property(e => e.PresentDays).HasColumnName("present_days");
            entity.Property(e => e.SummaryMonth).HasColumnName("summary_month");
            entity.Property(e => e.SummaryYear).HasColumnName("summary_year");
            entity.Property(e => e.WeekdaysInMonth).HasColumnName("weekdays_in_month");
            entity.Property(e => e.WeeklyOffs).HasColumnName("weekly_offs");
            entity.Property(e => e.WfhDays).HasColumnName("wfh_days");
            entity.Property(e => e.WorkingDays).HasColumnName("working_days");
        });

        modelBuilder.Entity<WfhRequest>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("wfh_requests");

            entity.HasIndex(e => new { e.EmployeeId, e.FromDate }, "idx_wfh_employee");

            entity.HasIndex(e => new { e.Status, e.ManagerId }, "idx_wfh_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.FromDate).HasColumnName("from_date");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.Reason)
                .HasMaxLength(500)
                .HasColumnName("reason");
            entity.Property(e => e.ReviewComment)
                .HasMaxLength(500)
                .HasColumnName("review_comment");
            entity.Property(e => e.ReviewedAt)
                .HasMaxLength(6)
                .HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(36)
                .HasColumnName("reviewer_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','CANCELLED','PENDING','REJECTED')")
                .HasColumnName("status");
            entity.Property(e => e.ToDate).HasColumnName("to_date");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
