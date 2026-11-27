using System;
using System.Collections.Generic;
using HR.LeaveService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.LeaveService.Data;

public partial class LeaveDbContext : HR.Common.Data.HrDbContext
{
    public LeaveDbContext(DbContextOptions<LeaveDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<LeaveApplication> LeaveApplications { get; set; }

    public virtual DbSet<LeaveApproval> LeaveApprovals { get; set; }

    public virtual DbSet<LeaveAttachment> LeaveAttachments { get; set; }

    public virtual DbSet<LeaveBalance> LeaveBalances { get; set; }

    public virtual DbSet<LeaveBalanceHistory> LeaveBalanceHistories { get; set; }

    public virtual DbSet<LeaveComment> LeaveComments { get; set; }

    public virtual DbSet<LeaveEmployee> LeaveEmployees { get; set; }

    public virtual DbSet<LeavePolicy> LeavePolicies { get; set; }

    public virtual DbSet<LeavePolicyEntitlement> LeavePolicyEntitlements { get; set; }

    public virtual DbSet<LeaveRunLog> LeaveRunLogs { get; set; }

    public virtual DbSet<LeaveType> LeaveTypes { get; set; }

    public virtual DbSet<VwEmployeeLeaveSummary> VwEmployeeLeaveSummaries { get; set; }

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

        modelBuilder.Entity<LeaveApplication>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_applications");

            entity.HasIndex(e => new { e.EmployeeId, e.FromDate, e.ToDate }, "idx_leave_employee_dates");

            entity.HasIndex(e => new { e.ManagerId, e.Status, e.Stage }, "idx_leave_manager_status");

            entity.HasIndex(e => new { e.Status, e.Stage }, "idx_leave_status_stage");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AppliedAt)
                .HasMaxLength(6)
                .HasColumnName("applied_at");
            entity.Property(e => e.CancelReason)
                .HasMaxLength(300)
                .HasColumnName("cancel_reason");
            entity.Property(e => e.CancelRequested)
                .HasColumnType("bit(1)")
                .HasColumnName("cancel_requested");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Days)
                .HasPrecision(5, 1)
                .HasColumnName("days");
            entity.Property(e => e.DecidedAt)
                .HasMaxLength(6)
                .HasColumnName("decided_at");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.FromDate).HasColumnName("from_date");
            entity.Property(e => e.HalfDayEnd)
                .HasColumnType("bit(1)")
                .HasColumnName("half_day_end");
            entity.Property(e => e.HalfDayStart)
                .HasColumnType("bit(1)")
                .HasColumnName("half_day_start");
            entity.Property(e => e.LeaveTypeId)
                .HasMaxLength(36)
                .HasColumnName("leave_type_id");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.Reason)
                .HasMaxLength(500)
                .HasColumnName("reason");
            entity.Property(e => e.Stage)
                .HasColumnType("enum('COMPLETE','HR','MANAGER')")
                .HasColumnName("stage");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','CANCELLED','PENDING','REJECTED','WITHDRAWN')")
                .HasColumnName("status");
            entity.Property(e => e.ToDate).HasColumnName("to_date");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
        });

        modelBuilder.Entity<LeaveApproval>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_approvals");

            entity.HasIndex(e => e.ApplicationId, "idx_approval_application");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasColumnType("enum('CANCEL_APPROVED','CANCEL_REJECTED','CANCEL_REQUESTED','HR_APPROVED','MANAGER_APPROVED','REJECTED','SUBMITTED','UPDATED','WITHDRAWN')")
                .HasColumnName("action");
            entity.Property(e => e.ActorId)
                .HasMaxLength(36)
                .HasColumnName("actor_id");
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(36)
                .HasColumnName("application_id");
            entity.Property(e => e.Comment)
                .HasMaxLength(500)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Stage)
                .HasColumnType("enum('COMPLETE','HR','MANAGER')")
                .HasColumnName("stage");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<LeaveAttachment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_attachments");

            entity.HasIndex(e => e.ApplicationId, "idx_attachment_application");

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
            entity.Property(e => e.DocumentId)
                .HasMaxLength(36)
                .HasColumnName("document_id");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<LeaveBalance>(entity =>
        {
            entity.HasKey(e => new { e.EmployeeId, e.LeaveTypeId, e.BalanceYear })
                .HasName("PRIMARY")
                .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0, 0 });

            entity.ToTable("leave_balances");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.LeaveTypeId)
                .HasMaxLength(36)
                .HasColumnName("leave_type_id");
            entity.Property(e => e.BalanceYear).HasColumnName("balance_year");
            entity.Property(e => e.Accrued)
                .HasPrecision(6, 2)
                .HasColumnName("accrued");
            entity.Property(e => e.Adjusted)
                .HasPrecision(6, 2)
                .HasColumnName("adjusted");
            entity.Property(e => e.CarriedForward)
                .HasPrecision(6, 2)
                .HasColumnName("carried_forward");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.Encashed)
                .HasPrecision(6, 2)
                .HasColumnName("encashed");
            entity.Property(e => e.Opening)
                .HasPrecision(6, 2)
                .HasColumnName("opening");
            entity.Property(e => e.Pending)
                .HasPrecision(6, 2)
                .HasColumnName("pending");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Used)
                .HasPrecision(6, 2)
                .HasColumnName("used");
            entity.Property(e => e.Version).HasColumnName("version");
        });

        modelBuilder.Entity<LeaveBalanceHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_balance_history");

            entity.HasIndex(e => new { e.EmployeeId, e.BalanceYear, e.ChangedAt }, "idx_balance_hist_emp");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BalanceYear).HasColumnName("balance_year");
            entity.Property(e => e.ChangedAt)
                .HasMaxLength(6)
                .HasColumnName("changed_at");
            entity.Property(e => e.ChangedBy)
                .HasMaxLength(100)
                .HasColumnName("changed_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.LeaveTypeId)
                .HasMaxLength(36)
                .HasColumnName("leave_type_id");
            entity.Property(e => e.NewAccrued)
                .HasPrecision(6, 2)
                .HasColumnName("new_accrued");
            entity.Property(e => e.NewCarried)
                .HasPrecision(6, 2)
                .HasColumnName("new_carried");
            entity.Property(e => e.NewEncashed)
                .HasPrecision(6, 2)
                .HasColumnName("new_encashed");
            entity.Property(e => e.NewPending)
                .HasPrecision(6, 2)
                .HasColumnName("new_pending");
            entity.Property(e => e.NewUsed)
                .HasPrecision(6, 2)
                .HasColumnName("new_used");
            entity.Property(e => e.OldAccrued)
                .HasPrecision(6, 2)
                .HasColumnName("old_accrued");
            entity.Property(e => e.OldCarried)
                .HasPrecision(6, 2)
                .HasColumnName("old_carried");
            entity.Property(e => e.OldEncashed)
                .HasPrecision(6, 2)
                .HasColumnName("old_encashed");
            entity.Property(e => e.OldPending)
                .HasPrecision(6, 2)
                .HasColumnName("old_pending");
            entity.Property(e => e.OldUsed)
                .HasPrecision(6, 2)
                .HasColumnName("old_used");
        });

        modelBuilder.Entity<LeaveComment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_comments");

            entity.HasIndex(e => e.ApplicationId, "idx_comment_application");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(36)
                .HasColumnName("application_id");
            entity.Property(e => e.AuthorId)
                .HasMaxLength(36)
                .HasColumnName("author_id");
            entity.Property(e => e.Comment)
                .HasMaxLength(1000)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<LeaveEmployee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("leave_employees");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.FullName)
                .HasMaxLength(200)
                .HasColumnName("full_name");
            entity.Property(e => e.Gender)
                .HasMaxLength(15)
                .HasColumnName("gender");
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

        modelBuilder.Entity<LeavePolicy>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_policies");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
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
            entity.Property(e => e.Description)
                .HasMaxLength(300)
                .HasColumnName("description");
            entity.Property(e => e.HrApprovalThresholdDays).HasColumnName("hr_approval_threshold_days");
            entity.Property(e => e.IsDefault)
                .HasColumnType("bit(1)")
                .HasColumnName("is_default");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<LeavePolicyEntitlement>(entity =>
        {
            entity.HasKey(e => new { e.LeaveTypeId, e.PolicyId })
                .HasName("PRIMARY")
                .HasAnnotation("MySql:IndexPrefixLength", new[] { 0, 0 });

            entity.ToTable("leave_policy_entitlements");

            entity.Property(e => e.LeaveTypeId)
                .HasMaxLength(36)
                .HasColumnName("leave_type_id");
            entity.Property(e => e.PolicyId)
                .HasMaxLength(36)
                .HasColumnName("policy_id");
            entity.Property(e => e.AccrualPerMonth)
                .HasPrecision(4, 2)
                .HasColumnName("accrual_per_month");
            entity.Property(e => e.AnnualDays)
                .HasPrecision(5, 1)
                .HasColumnName("annual_days");
            entity.Property(e => e.CarryForwardMax)
                .HasPrecision(5, 1)
                .HasColumnName("carry_forward_max");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.Encashable)
                .HasColumnType("bit(1)")
                .HasColumnName("encashable");
            entity.Property(e => e.EncashmentMaxDays)
                .HasPrecision(5, 1)
                .HasColumnName("encashment_max_days");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<LeaveRunLog>(entity =>
        {
            entity.HasKey(e => e.RunKey).HasName("PRIMARY");

            entity.ToTable("leave_run_log");

            entity.Property(e => e.RunKey)
                .HasMaxLength(60)
                .HasColumnName("run_key");
            entity.Property(e => e.ExecutedAt)
                .HasMaxLength(6)
                .HasColumnName("executed_at");
            entity.Property(e => e.ExecutedBy)
                .HasMaxLength(100)
                .HasColumnName("executed_by");
            entity.Property(e => e.RecordsProcessed).HasColumnName("records_processed");
        });

        modelBuilder.Entity<LeaveType>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("leave_types");

            entity.HasIndex(e => e.Code, "uk_leave_type_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.AttachmentRequiredFromDays).HasColumnName("attachment_required_from_days");
            entity.Property(e => e.BalanceTracked)
                .HasColumnType("bit(1)")
                .HasColumnName("balance_tracked");
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
            entity.Property(e => e.Description)
                .HasMaxLength(300)
                .HasColumnName("description");
            entity.Property(e => e.GenderRestriction)
                .HasMaxLength(10)
                .HasColumnName("gender_restriction");
            entity.Property(e => e.HalfDayAllowed)
                .HasColumnType("bit(1)")
                .HasColumnName("half_day_allowed");
            entity.Property(e => e.Name)
                .HasMaxLength(80)
                .HasColumnName("name");
            entity.Property(e => e.Paid)
                .HasColumnType("bit(1)")
                .HasColumnName("paid");
            entity.Property(e => e.RequiresHrApproval)
                .HasColumnType("bit(1)")
                .HasColumnName("requires_hr_approval");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<VwEmployeeLeaveSummary>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_employee_leave_summary");

            entity.Property(e => e.Available)
                .HasPrecision(12, 2)
                .HasColumnName("available");
            entity.Property(e => e.BalanceYear).HasColumnName("balance_year");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.Encashed)
                .HasPrecision(6, 2)
                .HasColumnName("encashed");
            entity.Property(e => e.Entitled)
                .HasPrecision(9, 2)
                .HasColumnName("entitled");
            entity.Property(e => e.LeaveTypeCode)
                .HasMaxLength(20)
                .HasColumnName("leave_type_code");
            entity.Property(e => e.LeaveTypeName)
                .HasMaxLength(80)
                .HasColumnName("leave_type_name");
            entity.Property(e => e.Pending)
                .HasPrecision(6, 2)
                .HasColumnName("pending");
            entity.Property(e => e.Used)
                .HasPrecision(6, 2)
                .HasColumnName("used");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
