using System;
using System.Collections.Generic;
using HR.ReportingService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ReportingService.Data;

public partial class ReportingDbContext : HR.Common.Data.HrDbContext
{
    public ReportingDbContext(DbContextOptions<ReportingDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<RptEmployee> RptEmployees { get; set; }

    public virtual DbSet<RptFact> RptFacts { get; set; }

    public virtual DbSet<VwHeadcountByDepartment> VwHeadcountByDepartments { get; set; }

    public virtual DbSet<VwLeaveUtilization> VwLeaveUtilizations { get; set; }

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

        modelBuilder.Entity<RptEmployee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("rpt_employees");

            entity.HasIndex(e => new { e.DepartmentId, e.Status }, "idx_rpt_emp_dept");

            entity.HasIndex(e => e.JoiningDate, "idx_rpt_emp_joining");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.DesignationId)
                .HasMaxLength(36)
                .HasColumnName("designation_id");
            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(30)
                .HasColumnName("employee_code");
            entity.Property(e => e.ExitDate).HasColumnName("exit_date");
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

        modelBuilder.Entity<RptFact>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("rpt_facts");

            entity.HasIndex(e => new { e.EmployeeId, e.FactType }, "idx_fact_employee");

            entity.HasIndex(e => new { e.FactType, e.PeriodKey }, "idx_fact_type_period");

            entity.HasIndex(e => new { e.FactType, e.SubjectKey }, "uk_fact").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Category)
                .HasMaxLength(80)
                .HasColumnName("category");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DateA).HasColumnName("date_a");
            entity.Property(e => e.DateB).HasColumnName("date_b");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FactType)
                .HasMaxLength(20)
                .HasColumnName("fact_type");
            entity.Property(e => e.NumA)
                .HasPrecision(16, 2)
                .HasColumnName("num_a");
            entity.Property(e => e.NumB)
                .HasPrecision(16, 2)
                .HasColumnName("num_b");
            entity.Property(e => e.NumC)
                .HasPrecision(16, 2)
                .HasColumnName("num_c");
            entity.Property(e => e.OccurredAt)
                .HasMaxLength(6)
                .HasColumnName("occurred_at");
            entity.Property(e => e.PeriodKey)
                .HasMaxLength(40)
                .HasColumnName("period_key");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasColumnName("status");
            entity.Property(e => e.SubjectKey)
                .HasMaxLength(100)
                .HasColumnName("subject_key");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<VwHeadcountByDepartment>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_headcount_by_department");

            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.Employees).HasColumnName("employees");
            entity.Property(e => e.Status)
                .HasMaxLength(15)
                .HasColumnName("status");
        });

        modelBuilder.Entity<VwLeaveUtilization>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_leave_utilization");

            entity.Property(e => e.Applications).HasColumnName("applications");
            entity.Property(e => e.Days)
                .HasPrecision(38, 2)
                .HasColumnName("days");
            entity.Property(e => e.LeaveType)
                .HasMaxLength(80)
                .HasColumnName("leave_type");
            entity.Property(e => e.Month)
                .HasMaxLength(40)
                .HasColumnName("month");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasColumnName("status");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
