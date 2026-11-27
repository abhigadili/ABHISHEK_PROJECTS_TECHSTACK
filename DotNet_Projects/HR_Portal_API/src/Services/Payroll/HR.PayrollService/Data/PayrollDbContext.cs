using System;
using System.Collections.Generic;
using HR.PayrollService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.PayrollService.Data;

public partial class PayrollDbContext : HR.Common.Data.HrDbContext
{
    public PayrollDbContext(DbContextOptions<PayrollDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<EmployeeSalary> EmployeeSalaries { get; set; }

    public virtual DbSet<Loan> Loans { get; set; }

    public virtual DbSet<LoanDeduction> LoanDeductions { get; set; }

    public virtual DbSet<PayrollAdjustment> PayrollAdjustments { get; set; }

    public virtual DbSet<PayrollConfig> PayrollConfigs { get; set; }

    public virtual DbSet<PayrollEntry> PayrollEntries { get; set; }

    public virtual DbSet<PayrollEntryLine> PayrollEntryLines { get; set; }

    public virtual DbSet<PayrollRun> PayrollRuns { get; set; }

    public virtual DbSet<Payslip> Payslips { get; set; }

    public virtual DbSet<SalaryComponent> SalaryComponents { get; set; }

    public virtual DbSet<SalaryRevision> SalaryRevisions { get; set; }

    public virtual DbSet<SalaryRevisionHistory> SalaryRevisionHistories { get; set; }

    public virtual DbSet<SalaryStructure> SalaryStructures { get; set; }

    public virtual DbSet<SalaryStructureComponent> SalaryStructureComponents { get; set; }

    public virtual DbSet<VwEmployeeSalarySummary> VwEmployeeSalarySummaries { get; set; }

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

        modelBuilder.Entity<EmployeeSalary>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_salaries");

            entity.HasIndex(e => e.StructureId, "fk_salary_structure");

            entity.HasIndex(e => new { e.EmployeeId, e.Status, e.EffectiveFrom }, "idx_salary_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AnnualCtc)
                .HasPrecision(14, 2)
                .HasColumnName("annual_ctc");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Currency)
                .HasMaxLength(3)
                .HasColumnName("currency");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','SUPERSEDED')")
                .HasColumnName("status");
            entity.Property(e => e.StructureId)
                .HasMaxLength(36)
                .HasColumnName("structure_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");

            entity.HasOne(d => d.Structure).WithMany(p => p.EmployeeSalaries)
                .HasForeignKey(d => d.StructureId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_salary_structure");
        });

        modelBuilder.Entity<Loan>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("loans");

            entity.HasIndex(e => new { e.EmployeeId, e.Status }, "idx_loan_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasMaxLength(120)
                .HasColumnName("description");
            entity.Property(e => e.Emi)
                .HasPrecision(14, 2)
                .HasColumnName("emi");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.Outstanding)
                .HasPrecision(14, 2)
                .HasColumnName("outstanding");
            entity.Property(e => e.Principal)
                .HasPrecision(14, 2)
                .HasColumnName("principal");
            entity.Property(e => e.StartMonth)
                .HasMaxLength(7)
                .HasColumnName("start_month");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','CLOSED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
        });

        modelBuilder.Entity<LoanDeduction>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("loan_deductions");

            entity.HasIndex(e => e.LoanId, "idx_loan_ded_loan");

            entity.HasIndex(e => e.RunId, "idx_loan_ded_run");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(14, 2)
                .HasColumnName("amount");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.LoanId)
                .HasMaxLength(36)
                .HasColumnName("loan_id");
            entity.Property(e => e.RunId)
                .HasMaxLength(36)
                .HasColumnName("run_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Loan).WithMany(p => p.LoanDeductions)
                .HasForeignKey(d => d.LoanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_loan_ded_loan");

            entity.HasOne(d => d.Run).WithMany(p => p.LoanDeductions)
                .HasForeignKey(d => d.RunId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_loan_ded_run");
        });

        modelBuilder.Entity<PayrollAdjustment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payroll_adjustments");

            entity.HasIndex(e => new { e.EmployeeId, e.PayrollMonth, e.Status }, "idx_adjustment_employee_month");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(14, 2)
                .HasColumnName("amount");
            entity.Property(e => e.AppliedRunId)
                .HasMaxLength(36)
                .HasColumnName("applied_run_id");
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
            entity.Property(e => e.PayrollMonth)
                .HasMaxLength(7)
                .HasColumnName("payroll_month");
            entity.Property(e => e.ReferenceId)
                .HasMaxLength(36)
                .HasColumnName("reference_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPLIED','CANCELLED','PENDING')")
                .HasColumnName("status");
            entity.Property(e => e.Type)
                .HasColumnType("enum('ALLOWANCE','ARREARS','BONUS','FINAL_SETTLEMENT','OTHER_DEDUCTION','REIMBURSEMENT')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<PayrollConfig>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payroll_config");

            entity.HasIndex(e => e.ConfigKey, "uk_payroll_config_key").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ConfigKey)
                .HasMaxLength(80)
                .HasColumnName("config_key");
            entity.Property(e => e.ConfigValue)
                .HasMaxLength(2000)
                .HasColumnName("config_value");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasMaxLength(300)
                .HasColumnName("description");
            entity.Property(e => e.EffectiveFrom)
                .HasMaxLength(6)
                .HasColumnName("effective_from");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<PayrollEntry>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payroll_entries");

            entity.HasIndex(e => e.EmployeeId, "idx_entry_employee");

            entity.HasIndex(e => e.RunId, "idx_entry_run");

            entity.HasIndex(e => new { e.RunId, e.EmployeeId }, "uk_entry_run_employee").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Deductions)
                .HasPrecision(14, 2)
                .HasColumnName("deductions");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(30)
                .HasColumnName("employee_code");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.Gross)
                .HasPrecision(14, 2)
                .HasColumnName("gross");
            entity.Property(e => e.LopDays)
                .HasPrecision(5, 1)
                .HasColumnName("lop_days");
            entity.Property(e => e.Net)
                .HasPrecision(14, 2)
                .HasColumnName("net");
            entity.Property(e => e.OvertimeMinutes).HasColumnName("overtime_minutes");
            entity.Property(e => e.PaidDays)
                .HasPrecision(5, 1)
                .HasColumnName("paid_days");
            entity.Property(e => e.PayrollMonth)
                .HasMaxLength(7)
                .HasColumnName("payroll_month");
            entity.Property(e => e.RunId)
                .HasMaxLength(36)
                .HasColumnName("run_id");
            entity.Property(e => e.SalaryId)
                .HasMaxLength(36)
                .HasColumnName("salary_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.WorkingDays)
                .HasPrecision(5, 1)
                .HasColumnName("working_days");

            entity.HasOne(d => d.Run).WithMany(p => p.PayrollEntries)
                .HasForeignKey(d => d.RunId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_entry_run");
        });

        modelBuilder.Entity<PayrollEntryLine>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payroll_entry_lines");

            entity.HasIndex(e => e.ComponentCode, "idx_line_component");

            entity.HasIndex(e => e.EntryId, "idx_line_entry");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(14, 2)
                .HasColumnName("amount");
            entity.Property(e => e.ComponentCode)
                .HasMaxLength(40)
                .HasColumnName("component_code");
            entity.Property(e => e.ComponentName)
                .HasMaxLength(100)
                .HasColumnName("component_name");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EntryId)
                .HasMaxLength(36)
                .HasColumnName("entry_id");
            entity.Property(e => e.Note)
                .HasMaxLength(200)
                .HasColumnName("note");
            entity.Property(e => e.Type)
                .HasColumnType("enum('DEDUCTION','EARNING')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Entry).WithMany(p => p.PayrollEntryLines)
                .HasForeignKey(d => d.EntryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_line_entry");
        });

        modelBuilder.Entity<PayrollRun>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payroll_runs");

            entity.HasIndex(e => e.PayrollMonth, "uk_payroll_run_month").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ApprovedAt)
                .HasMaxLength(6)
                .HasColumnName("approved_at");
            entity.Property(e => e.ApprovedBy)
                .HasMaxLength(100)
                .HasColumnName("approved_by");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeCount).HasColumnName("employee_count");
            entity.Property(e => e.FinalizedAt)
                .HasMaxLength(6)
                .HasColumnName("finalized_at");
            entity.Property(e => e.FinalizedBy)
                .HasMaxLength(100)
                .HasColumnName("finalized_by");
            entity.Property(e => e.Note)
                .HasMaxLength(300)
                .HasColumnName("note");
            entity.Property(e => e.PayrollMonth)
                .HasMaxLength(7)
                .HasColumnName("payroll_month");
            entity.Property(e => e.ProcessedAt)
                .HasMaxLength(6)
                .HasColumnName("processed_at");
            entity.Property(e => e.ProcessedBy)
                .HasMaxLength(100)
                .HasColumnName("processed_by");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','DRAFT','FINALIZED','PROCESSED')")
                .HasColumnName("status");
            entity.Property(e => e.TotalDeductions)
                .HasPrecision(16, 2)
                .HasColumnName("total_deductions");
            entity.Property(e => e.TotalGross)
                .HasPrecision(16, 2)
                .HasColumnName("total_gross");
            entity.Property(e => e.TotalNet)
                .HasPrecision(16, 2)
                .HasColumnName("total_net");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
        });

        modelBuilder.Entity<Payslip>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("payslips");

            entity.HasIndex(e => new { e.EmployeeId, e.PayrollMonth }, "idx_payslip_employee");

            entity.HasIndex(e => e.EntryId, "uk_payslip_entry").IsUnique();

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
            entity.Property(e => e.EntryId)
                .HasMaxLength(36)
                .HasColumnName("entry_id");
            entity.Property(e => e.FileName)
                .HasMaxLength(150)
                .HasColumnName("file_name");
            entity.Property(e => e.GeneratedAt)
                .HasMaxLength(6)
                .HasColumnName("generated_at");
            entity.Property(e => e.PayrollMonth)
                .HasMaxLength(7)
                .HasColumnName("payroll_month");
            entity.Property(e => e.RunId)
                .HasMaxLength(36)
                .HasColumnName("run_id");
            entity.Property(e => e.Sha256)
                .HasMaxLength(64)
                .HasColumnName("sha256");
            entity.Property(e => e.SizeBytes).HasColumnName("size_bytes");
            entity.Property(e => e.StoragePath)
                .HasMaxLength(300)
                .HasColumnName("storage_path");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Entry).WithOne(p => p.Payslip)
                .HasForeignKey<Payslip>(d => d.EntryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_payslip_entry");
        });

        modelBuilder.Entity<SalaryComponent>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("salary_components");

            entity.HasIndex(e => e.Code, "uk_component_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.CalcType)
                .HasColumnType("enum('BALANCE','FIXED','PERCENT_OF_BASIC','PERCENT_OF_CTC','SLAB_PT','STATUTORY_PF','TAX_TDS','VARIABLE')")
                .HasColumnName("calc_type");
            entity.Property(e => e.Code)
                .HasMaxLength(40)
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
            entity.Property(e => e.DisplayOrder).HasColumnName("display_order");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.Taxable)
                .HasColumnType("bit(1)")
                .HasColumnName("taxable");
            entity.Property(e => e.Type)
                .HasColumnType("enum('DEDUCTION','EARNING')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<SalaryRevision>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("salary_revisions");

            entity.HasIndex(e => new { e.Status, e.EmployeeId }, "idx_revision_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DecidedAt)
                .HasMaxLength(6)
                .HasColumnName("decided_at");
            entity.Property(e => e.DecidedBy)
                .HasMaxLength(100)
                .HasColumnName("decided_by");
            entity.Property(e => e.DecisionComment)
                .HasMaxLength(300)
                .HasColumnName("decision_comment");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.NewCtc)
                .HasPrecision(14, 2)
                .HasColumnName("new_ctc");
            entity.Property(e => e.NewStructureId)
                .HasMaxLength(36)
                .HasColumnName("new_structure_id");
            entity.Property(e => e.OldCtc)
                .HasPrecision(14, 2)
                .HasColumnName("old_ctc");
            entity.Property(e => e.Reason)
                .HasMaxLength(300)
                .HasColumnName("reason");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','PENDING','REJECTED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<SalaryRevisionHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("salary_revision_history");

            entity.HasIndex(e => new { e.EmployeeId, e.ChangedAt }, "idx_salary_hist_employee");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(10)
                .HasColumnName("action");
            entity.Property(e => e.ChangedAt)
                .HasMaxLength(6)
                .HasColumnName("changed_at");
            entity.Property(e => e.ChangedBy)
                .HasMaxLength(100)
                .HasColumnName("changed_by");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.NewCtc)
                .HasPrecision(14, 2)
                .HasColumnName("new_ctc");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(12)
                .HasColumnName("new_status");
            entity.Property(e => e.OldCtc)
                .HasPrecision(14, 2)
                .HasColumnName("old_ctc");
            entity.Property(e => e.OldStatus)
                .HasMaxLength(12)
                .HasColumnName("old_status");
            entity.Property(e => e.SalaryId)
                .HasMaxLength(36)
                .HasColumnName("salary_id");
        });

        modelBuilder.Entity<SalaryStructure>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("salary_structures");

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
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<SalaryStructureComponent>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("salary_structure_components");

            entity.HasIndex(e => e.ComponentId, "fk_ssc_component");

            entity.HasIndex(e => e.StructureId, "idx_ssc_structure");

            entity.HasIndex(e => new { e.StructureId, e.ComponentId }, "uk_structure_component").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ComponentId)
                .HasMaxLength(36)
                .HasColumnName("component_id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.StructureId)
                .HasMaxLength(36)
                .HasColumnName("structure_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Value)
                .HasPrecision(14, 3)
                .HasColumnName("value");

            entity.HasOne(d => d.Component).WithMany(p => p.SalaryStructureComponents)
                .HasForeignKey(d => d.ComponentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_ssc_component");

            entity.HasOne(d => d.Structure).WithMany(p => p.SalaryStructureComponents)
                .HasForeignKey(d => d.StructureId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_ssc_structure");
        });

        modelBuilder.Entity<VwEmployeeSalarySummary>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_employee_salary_summary");

            entity.Property(e => e.AnnualCtc)
                .HasPrecision(14, 2)
                .HasColumnName("annual_ctc");
            entity.Property(e => e.Currency)
                .HasMaxLength(3)
                .HasColumnName("currency");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.MonthlyBasic)
                .HasPrecision(14, 2)
                .HasColumnName("monthly_basic");
            entity.Property(e => e.MonthlyCtc)
                .HasPrecision(15, 2)
                .HasColumnName("monthly_ctc");
            entity.Property(e => e.StructureName)
                .HasMaxLength(100)
                .HasColumnName("structure_name");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
