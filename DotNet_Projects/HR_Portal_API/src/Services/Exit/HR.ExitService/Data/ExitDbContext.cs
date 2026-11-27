using System;
using System.Collections.Generic;
using HR.ExitService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ExitService.Data;

public partial class ExitDbContext : HR.Common.Data.HrDbContext
{
    public ExitDbContext(DbContextOptions<ExitDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<ExitHistory> ExitHistories { get; set; }

    public virtual DbSet<ExitInterview> ExitInterviews { get; set; }

    public virtual DbSet<ExitInterviewForm> ExitInterviewForms { get; set; }

    public virtual DbSet<ExitPolicy> ExitPolicies { get; set; }

    public virtual DbSet<ExitTask> ExitTasks { get; set; }

    public virtual DbSet<Resignation> Resignations { get; set; }

    public virtual DbSet<Settlement> Settlements { get; set; }

    public virtual DbSet<SettlementLine> SettlementLines { get; set; }

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

        modelBuilder.Entity<ExitHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("exit_history");

            entity.HasIndex(e => new { e.ResignationId, e.CreatedAt }, "idx_exit_history");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Comment)
                .HasMaxLength(500)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.FromStatus)
                .HasMaxLength(20)
                .HasColumnName("from_status");
            entity.Property(e => e.ResignationId)
                .HasMaxLength(36)
                .HasColumnName("resignation_id");
            entity.Property(e => e.ToStatus)
                .HasMaxLength(20)
                .HasColumnName("to_status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Resignation).WithMany(p => p.ExitHistories)
                .HasForeignKey(d => d.ResignationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_exit_history_resignation");
        });

        modelBuilder.Entity<ExitInterview>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("exit_interviews");

            entity.HasIndex(e => e.ResignationId, "uk_interview_resignation").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Answers)
                .HasColumnType("json")
                .HasColumnName("answers");
            entity.Property(e => e.CompletedAt)
                .HasMaxLength(6)
                .HasColumnName("completed_at");
            entity.Property(e => e.ConductedBy)
                .HasMaxLength(100)
                .HasColumnName("conducted_by");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.FeedbackSummary)
                .HasMaxLength(2000)
                .HasColumnName("feedback_summary");
            entity.Property(e => e.FormId)
                .HasMaxLength(36)
                .HasColumnName("form_id");
            entity.Property(e => e.ResignationId)
                .HasMaxLength(36)
                .HasColumnName("resignation_id");
            entity.Property(e => e.ScheduledAt)
                .HasMaxLength(6)
                .HasColumnName("scheduled_at");
            entity.Property(e => e.Status)
                .HasColumnType("enum('COMPLETED','SCHEDULED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WouldRecommend)
                .HasColumnType("bit(1)")
                .HasColumnName("would_recommend");

            entity.HasOne(d => d.Resignation).WithOne(p => p.ExitInterview)
                .HasForeignKey<ExitInterview>(d => d.ResignationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_interview_resignation");
        });

        modelBuilder.Entity<ExitInterviewForm>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("exit_interview_forms");

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
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.Questions)
                .HasColumnType("json")
                .HasColumnName("questions");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<ExitPolicy>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("exit_policy");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DefaultNoticeDays).HasColumnName("default_notice_days");
            entity.Property(e => e.MaxWaiverDays).HasColumnName("max_waiver_days");
            entity.Property(e => e.SalaryDaysPerMonth).HasColumnName("salary_days_per_month");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WithdrawalAfterConfirmation)
                .HasColumnType("bit(1)")
                .HasColumnName("withdrawal_after_confirmation");
        });

        modelBuilder.Entity<ExitTask>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("exit_tasks");

            entity.HasIndex(e => new { e.ResignationId, e.Status }, "idx_task_resignation");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AssetCondition)
                .HasMaxLength(40)
                .HasColumnName("asset_condition");
            entity.Property(e => e.AssetTag)
                .HasMaxLength(60)
                .HasColumnName("asset_tag");
            entity.Property(e => e.CompletedAt)
                .HasMaxLength(6)
                .HasColumnName("completed_at");
            entity.Property(e => e.CompletedBy)
                .HasMaxLength(100)
                .HasColumnName("completed_by");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Department)
                .HasMaxLength(20)
                .HasColumnName("department");
            entity.Property(e => e.DueDate).HasColumnName("due_date");
            entity.Property(e => e.KtTopic)
                .HasMaxLength(200)
                .HasColumnName("kt_topic");
            entity.Property(e => e.KtTransfereeId)
                .HasMaxLength(36)
                .HasColumnName("kt_transferee_id");
            entity.Property(e => e.Remarks)
                .HasMaxLength(500)
                .HasColumnName("remarks");
            entity.Property(e => e.ResignationId)
                .HasMaxLength(36)
                .HasColumnName("resignation_id");
            entity.Property(e => e.ReturnedOn).HasColumnName("returned_on");
            entity.Property(e => e.RevokedOn).HasColumnName("revoked_on");
            entity.Property(e => e.Status)
                .HasColumnType("enum('DONE','PENDING')")
                .HasColumnName("status");
            entity.Property(e => e.SystemName)
                .HasMaxLength(80)
                .HasColumnName("system_name");
            entity.Property(e => e.TaskType)
                .HasMaxLength(12)
                .HasColumnName("task_type");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Resignation).WithMany(p => p.ExitTasks)
                .HasForeignKey(d => d.ResignationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_task_resignation");
        });

        modelBuilder.Entity<Resignation>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("resignations");

            entity.HasIndex(e => new { e.EmployeeId, e.Status }, "idx_resignation_employee");

            entity.HasIndex(e => new { e.ManagerId, e.Status }, "idx_resignation_manager");

            entity.HasIndex(e => e.Status, "idx_resignation_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CompletedAt)
                .HasMaxLength(6)
                .HasColumnName("completed_at");
            entity.Property(e => e.ConfirmedLastWorkingDay).HasColumnName("confirmed_last_working_day");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.HrComment)
                .HasMaxLength(500)
                .HasColumnName("hr_comment");
            entity.Property(e => e.JoiningDate).HasColumnName("joining_date");
            entity.Property(e => e.ManagerComment)
                .HasMaxLength(500)
                .HasColumnName("manager_comment");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.NoticePeriodDays).HasColumnName("notice_period_days");
            entity.Property(e => e.Reason)
                .HasMaxLength(1000)
                .HasColumnName("reason");
            entity.Property(e => e.RequestedLastWorkingDay).HasColumnName("requested_last_working_day");
            entity.Property(e => e.Status)
                .HasColumnType("enum('CLEARED','COMPLETED','HR_CONFIRMED','INTERVIEW_DONE','MANAGER_APPROVED','MANAGER_REJECTED','SETTLEMENT_PENDING','SUBMITTED','WITHDRAWN')")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedOn).HasColumnName("submitted_on");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
            entity.Property(e => e.WaiverDays).HasColumnName("waiver_days");
        });

        modelBuilder.Entity<Settlement>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("settlements");

            entity.HasIndex(e => e.ResignationId, "uk_settlement_resignation").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CalculatedBy)
                .HasMaxLength(100)
                .HasColumnName("calculated_by");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.GrossPayable)
                .HasPrecision(14, 2)
                .HasColumnName("gross_payable");
            entity.Property(e => e.NetPayable)
                .HasPrecision(14, 2)
                .HasColumnName("net_payable");
            entity.Property(e => e.PaidAt)
                .HasMaxLength(6)
                .HasColumnName("paid_at");
            entity.Property(e => e.PaymentReference)
                .HasMaxLength(80)
                .HasColumnName("payment_reference");
            entity.Property(e => e.ProcessedBy)
                .HasMaxLength(100)
                .HasColumnName("processed_by");
            entity.Property(e => e.Recoveries)
                .HasPrecision(14, 2)
                .HasColumnName("recoveries");
            entity.Property(e => e.ResignationId)
                .HasMaxLength(36)
                .HasColumnName("resignation_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('CALCULATED','PAID')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Resignation).WithOne(p => p.Settlement)
                .HasForeignKey<Settlement>(d => d.ResignationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_settlement_resignation");
        });

        modelBuilder.Entity<SettlementLine>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("settlement_lines");

            entity.HasIndex(e => e.SettlementId, "idx_sline_settlement");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(14, 2)
                .HasColumnName("amount");
            entity.Property(e => e.Code)
                .HasMaxLength(40)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasMaxLength(200)
                .HasColumnName("description");
            entity.Property(e => e.SettlementId)
                .HasMaxLength(36)
                .HasColumnName("settlement_id");
            entity.Property(e => e.Type)
                .HasColumnType("enum('DEDUCTION','EARNING')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Settlement).WithMany(p => p.SettlementLines)
                .HasForeignKey(d => d.SettlementId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_sline_settlement");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
