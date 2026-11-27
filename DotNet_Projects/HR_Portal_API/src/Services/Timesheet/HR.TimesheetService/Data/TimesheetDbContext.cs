using System;
using System.Collections.Generic;
using HR.TimesheetService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.TimesheetService.Data;

public partial class TimesheetDbContext : HR.Common.Data.HrDbContext
{
    public TimesheetDbContext(DbContextOptions<TimesheetDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<Timesheet> Timesheets { get; set; }

    public virtual DbSet<TimesheetEmployee> TimesheetEmployees { get; set; }

    public virtual DbSet<TimesheetEntry> TimesheetEntries { get; set; }

    public virtual DbSet<TimesheetHistory> TimesheetHistories { get; set; }

    public virtual DbSet<TimesheetTask> TimesheetTasks { get; set; }

    public virtual DbSet<VwTimesheetSummary> VwTimesheetSummaries { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_0900_ai_ci")
            .HasCharSet("utf8mb4");

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

        modelBuilder.Entity<Timesheet>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("timesheets");

            entity.HasIndex(e => new { e.Status, e.ApproverId }, "idx_timesheet_status");

            entity.HasIndex(e => e.WeekStart, "idx_timesheet_week");

            entity.HasIndex(e => new { e.EmployeeId, e.WeekStart }, "uk_timesheet_employee_week").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ApproverId)
                .HasMaxLength(36)
                .HasColumnName("approver_id");
            entity.Property(e => e.BillableHours)
                .HasPrecision(6, 2)
                .HasColumnName("billable_hours");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DecidedAt)
                .HasMaxLength(6)
                .HasColumnName("decided_at");
            entity.Property(e => e.DecisionComment)
                .HasMaxLength(500)
                .HasColumnName("decision_comment");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.ResubmissionCount).HasColumnName("resubmission_count");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','DRAFT','REJECTED','SUBMITTED')")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedAt)
                .HasMaxLength(6)
                .HasColumnName("submitted_at");
            entity.Property(e => e.TotalHours)
                .HasPrecision(6, 2)
                .HasColumnName("total_hours");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
            entity.Property(e => e.WeekStart).HasColumnName("week_start");
        });

        modelBuilder.Entity<TimesheetEmployee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("timesheet_employees");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FullName)
                .HasMaxLength(200)
                .HasColumnName("full_name");
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

        modelBuilder.Entity<TimesheetEntry>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("timesheet_entries");

            entity.HasIndex(e => new { e.ProjectId, e.WorkDate }, "idx_entry_project_date");

            entity.HasIndex(e => e.TimesheetId, "idx_entry_timesheet");

            entity.HasIndex(e => new { e.TimesheetId, e.ProjectId, e.TaskKey, e.WorkDate }, "uk_entry_unique").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Billable)
                .HasColumnType("bit(1)")
                .HasColumnName("billable");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasMaxLength(300)
                .HasColumnName("description");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.Hours)
                .HasPrecision(4, 2)
                .HasColumnName("hours");
            entity.Property(e => e.ProjectId)
                .HasMaxLength(36)
                .HasColumnName("project_id");
            entity.Property(e => e.ProjectManagerId)
                .HasMaxLength(36)
                .HasColumnName("project_manager_id");
            entity.Property(e => e.TaskId)
                .HasMaxLength(36)
                .HasColumnName("task_id");
            entity.Property(e => e.TaskKey)
                .HasMaxLength(36)
                .HasColumnName("task_key");
            entity.Property(e => e.TimesheetId)
                .HasMaxLength(36)
                .HasColumnName("timesheet_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WorkDate).HasColumnName("work_date");

            entity.HasOne(d => d.Timesheet).WithMany(p => p.TimesheetEntries)
                .HasForeignKey(d => d.TimesheetId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_entry_timesheet");
        });

        modelBuilder.Entity<TimesheetHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("timesheet_history");

            entity.HasIndex(e => new { e.TimesheetId, e.CreatedAt }, "idx_ts_history");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasColumnType("enum('APPROVED','CREATED','ENTRIES_SAVED','REJECTED','REOPENED','RESUBMITTED','SUBMITTED')")
                .HasColumnName("action");
            entity.Property(e => e.ActorId)
                .HasMaxLength(36)
                .HasColumnName("actor_id");
            entity.Property(e => e.Comment)
                .HasMaxLength(500)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.TimesheetId)
                .HasMaxLength(36)
                .HasColumnName("timesheet_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Timesheet).WithMany(p => p.TimesheetHistories)
                .HasForeignKey(d => d.TimesheetId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_ts_history_timesheet");
        });

        modelBuilder.Entity<TimesheetTask>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("timesheet_tasks");

            entity.HasIndex(e => e.ProjectId, "idx_task_project");

            entity.HasIndex(e => new { e.ProjectId, e.Code }, "uk_task_project_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.Billable)
                .HasColumnType("bit(1)")
                .HasColumnName("billable");
            entity.Property(e => e.Code)
                .HasMaxLength(30)
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
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
            entity.Property(e => e.ProjectId)
                .HasMaxLength(36)
                .HasColumnName("project_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<VwTimesheetSummary>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_timesheet_summary");

            entity.Property(e => e.BillableHours)
                .HasPrecision(6, 2)
                .HasColumnName("billable_hours");
            entity.Property(e => e.DecidedAt)
                .HasMaxLength(6)
                .HasColumnName("decided_at");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.NonBillableHours)
                .HasPrecision(7, 2)
                .HasColumnName("non_billable_hours");
            entity.Property(e => e.ProjectCount).HasColumnName("project_count");
            entity.Property(e => e.ResubmissionCount).HasColumnName("resubmission_count");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','DRAFT','REJECTED','SUBMITTED')")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedAt)
                .HasMaxLength(6)
                .HasColumnName("submitted_at");
            entity.Property(e => e.TimesheetId)
                .HasMaxLength(36)
                .HasColumnName("timesheet_id");
            entity.Property(e => e.TotalHours)
                .HasPrecision(6, 2)
                .HasColumnName("total_hours");
            entity.Property(e => e.WeekEnd).HasColumnName("week_end");
            entity.Property(e => e.WeekStart).HasColumnName("week_start");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
