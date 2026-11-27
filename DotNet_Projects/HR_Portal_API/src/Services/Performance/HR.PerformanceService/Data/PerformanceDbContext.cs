using System;
using System.Collections.Generic;
using HR.PerformanceService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.PerformanceService.Data;

public partial class PerformanceDbContext : HR.Common.Data.HrDbContext
{
    public PerformanceDbContext(DbContextOptions<PerformanceDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<EvaluationForm> EvaluationForms { get; set; }

    public virtual DbSet<Feedback> Feedbacks { get; set; }

    public virtual DbSet<FormQuestion> FormQuestions { get; set; }

    public virtual DbSet<Goal> Goals { get; set; }

    public virtual DbSet<KeyResult> KeyResults { get; set; }

    public virtual DbSet<PerfEmployee> PerfEmployees { get; set; }

    public virtual DbSet<PerformanceReview> PerformanceReviews { get; set; }

    public virtual DbSet<ReviewAnswer> ReviewAnswers { get; set; }

    public virtual DbSet<ReviewCycle> ReviewCycles { get; set; }

    public virtual DbSet<ReviewHistory> ReviewHistories { get; set; }

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

        modelBuilder.Entity<EvaluationForm>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("evaluation_forms");

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
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<Feedback>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("feedback");

            entity.HasIndex(e => new { e.ToEmployeeId, e.CreatedAt }, "idx_feedback_to");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Comment)
                .HasMaxLength(2000)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.FromEmployeeId)
                .HasMaxLength(36)
                .HasColumnName("from_employee_id");
            entity.Property(e => e.Rating)
                .HasPrecision(3, 1)
                .HasColumnName("rating");
            entity.Property(e => e.ReviewId)
                .HasMaxLength(36)
                .HasColumnName("review_id");
            entity.Property(e => e.ToEmployeeId)
                .HasMaxLength(36)
                .HasColumnName("to_employee_id");
            entity.Property(e => e.Type)
                .HasColumnType("enum('MANAGER','PEER')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<FormQuestion>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("form_questions");

            entity.HasIndex(e => new { e.FormId, e.OrderNo }, "idx_question_form");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.FormId)
                .HasMaxLength(36)
                .HasColumnName("form_id");
            entity.Property(e => e.OrderNo).HasColumnName("order_no");
            entity.Property(e => e.Required)
                .HasColumnType("bit(1)")
                .HasColumnName("required");
            entity.Property(e => e.Section)
                .HasMaxLength(80)
                .HasColumnName("section");
            entity.Property(e => e.Text)
                .HasMaxLength(500)
                .HasColumnName("text");
            entity.Property(e => e.Type)
                .HasColumnType("enum('RATING','TEXT')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Weight)
                .HasPrecision(5, 2)
                .HasColumnName("weight");

            entity.HasOne(d => d.Form).WithMany(p => p.FormQuestions)
                .HasForeignKey(d => d.FormId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_question_form");
        });

        modelBuilder.Entity<Goal>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("goals");

            entity.HasIndex(e => new { e.EmployeeId, e.CycleId }, "idx_goal_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.CycleId)
                .HasMaxLength(36)
                .HasColumnName("cycle_id");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.Description)
                .HasMaxLength(1000)
                .HasColumnName("description");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.Progress).HasColumnName("progress");
            entity.Property(e => e.Status)
                .HasColumnType("enum('CANCELLED','COMPLETED','IN_PROGRESS','NOT_STARTED')")
                .HasColumnName("status");
            entity.Property(e => e.TargetDate).HasColumnName("target_date");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.Type)
                .HasColumnType("enum('GOAL','OKR')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Weight).HasColumnName("weight");
        });

        modelBuilder.Entity<KeyResult>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("key_results");

            entity.HasIndex(e => e.GoalId, "idx_kr_goal");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.CurrentValue)
                .HasPrecision(14, 2)
                .HasColumnName("current_value");
            entity.Property(e => e.Description)
                .HasMaxLength(300)
                .HasColumnName("description");
            entity.Property(e => e.GoalId)
                .HasMaxLength(36)
                .HasColumnName("goal_id");
            entity.Property(e => e.TargetValue)
                .HasPrecision(14, 2)
                .HasColumnName("target_value");
            entity.Property(e => e.Unit)
                .HasMaxLength(30)
                .HasColumnName("unit");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Goal).WithMany(p => p.KeyResults)
                .HasForeignKey(d => d.GoalId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_kr_goal");
        });

        modelBuilder.Entity<PerfEmployee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("perf_employees");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
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

        modelBuilder.Entity<PerformanceReview>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("performance_reviews");

            entity.HasIndex(e => new { e.ManagerId, e.Status }, "idx_review_manager");

            entity.HasIndex(e => e.Status, "idx_review_status");

            entity.HasIndex(e => new { e.CycleId, e.EmployeeId }, "uk_review_cycle_employee").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Achievements)
                .HasMaxLength(2000)
                .HasColumnName("achievements");
            entity.Property(e => e.ApprovedAt)
                .HasMaxLength(6)
                .HasColumnName("approved_at");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.CycleId)
                .HasMaxLength(36)
                .HasColumnName("cycle_id");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.FinalRating)
                .HasPrecision(3, 1)
                .HasColumnName("final_rating");
            entity.Property(e => e.FormId)
                .HasMaxLength(36)
                .HasColumnName("form_id");
            entity.Property(e => e.HrComment)
                .HasMaxLength(1000)
                .HasColumnName("hr_comment");
            entity.Property(e => e.ImprovementAreas)
                .HasMaxLength(2000)
                .HasColumnName("improvement_areas");
            entity.Property(e => e.ManagerFeedback)
                .HasMaxLength(2000)
                .HasColumnName("manager_feedback");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.ManagerRating)
                .HasPrecision(3, 1)
                .HasColumnName("manager_rating");
            entity.Property(e => e.ManagerSubmittedAt)
                .HasMaxLength(6)
                .HasColumnName("manager_submitted_at");
            entity.Property(e => e.SelfRating)
                .HasPrecision(3, 1)
                .HasColumnName("self_rating");
            entity.Property(e => e.SelfSubmittedAt)
                .HasMaxLength(6)
                .HasColumnName("self_submitted_at");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','MANAGER_SUBMITTED','SELF_PENDING','SELF_SUBMITTED')")
                .HasColumnName("status");
            entity.Property(e => e.Strengths)
                .HasMaxLength(2000)
                .HasColumnName("strengths");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");

            entity.HasOne(d => d.Cycle).WithMany(p => p.PerformanceReviews)
                .HasForeignKey(d => d.CycleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_review_cycle");
        });

        modelBuilder.Entity<ReviewAnswer>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("review_answers");

            entity.HasIndex(e => e.ReviewId, "idx_answer_review");

            entity.HasIndex(e => new { e.ReviewId, e.QuestionId, e.Respondent }, "uk_answer").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AnswerText)
                .HasMaxLength(2000)
                .HasColumnName("answer_text");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.QuestionId)
                .HasMaxLength(36)
                .HasColumnName("question_id");
            entity.Property(e => e.Rating)
                .HasPrecision(3, 1)
                .HasColumnName("rating");
            entity.Property(e => e.Respondent)
                .HasColumnType("enum('MANAGER','SELF')")
                .HasColumnName("respondent");
            entity.Property(e => e.ReviewId)
                .HasMaxLength(36)
                .HasColumnName("review_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Review).WithMany(p => p.ReviewAnswers)
                .HasForeignKey(d => d.ReviewId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_answer_review");
        });

        modelBuilder.Entity<ReviewCycle>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("review_cycles");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.FormId)
                .HasMaxLength(36)
                .HasColumnName("form_id");
            entity.Property(e => e.ManagerEvalDeadline).HasColumnName("manager_eval_deadline");
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.PeriodEnd).HasColumnName("period_end");
            entity.Property(e => e.PeriodStart).HasColumnName("period_start");
            entity.Property(e => e.SelfEvalDeadline).HasColumnName("self_eval_deadline");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','CLOSED','DRAFT')")
                .HasColumnName("status");
            entity.Property(e => e.Type)
                .HasColumnType("enum('ANNUAL','HALF_YEARLY','PROBATION','QUARTERLY')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<ReviewHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("review_history");

            entity.HasIndex(e => new { e.ReviewId, e.CreatedAt }, "idx_review_history");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(30)
                .HasColumnName("action");
            entity.Property(e => e.Comment)
                .HasMaxLength(1000)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.ReviewId)
                .HasMaxLength(36)
                .HasColumnName("review_id");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Review).WithMany(p => p.ReviewHistories)
                .HasForeignKey(d => d.ReviewId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_review_history");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
