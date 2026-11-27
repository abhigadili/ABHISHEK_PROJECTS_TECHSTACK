using System;
using System.Collections.Generic;
using HR.TaxService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.TaxService.Data;

public partial class TaxDbContext : HR.Common.Data.HrDbContext
{
    public TaxDbContext(DbContextOptions<TaxDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<InvestmentDeclaration> InvestmentDeclarations { get; set; }

    public virtual DbSet<MonthlyTd> MonthlyTds { get; set; }

    public virtual DbSet<TaxComputation> TaxComputations { get; set; }

    public virtual DbSet<TaxDeclaration> TaxDeclarations { get; set; }

    public virtual DbSet<TaxDeclarationHistory> TaxDeclarationHistories { get; set; }

    public virtual DbSet<TaxDocument> TaxDocuments { get; set; }

    public virtual DbSet<TaxEmployee> TaxEmployees { get; set; }

    public virtual DbSet<TaxProof> TaxProofs { get; set; }

    public virtual DbSet<TaxRule> TaxRules { get; set; }

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

        modelBuilder.Entity<InvestmentDeclaration>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("investment_declarations");

            entity.HasIndex(e => e.DeclarationId, "idx_investment_declaration");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ApprovedAmount)
                .HasPrecision(14, 2)
                .HasColumnName("approved_amount");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DeclarationId)
                .HasMaxLength(36)
                .HasColumnName("declaration_id");
            entity.Property(e => e.DeclaredAmount)
                .HasPrecision(14, 2)
                .HasColumnName("declared_amount");
            entity.Property(e => e.Description)
                .HasMaxLength(200)
                .HasColumnName("description");
            entity.Property(e => e.Section)
                .HasMaxLength(20)
                .HasColumnName("section");
            entity.Property(e => e.Status)
                .HasColumnType("enum('DECLARED','PROOF_SUBMITTED','REJECTED','VERIFIED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Declaration).WithMany(p => p.InvestmentDeclarations)
                .HasForeignKey(d => d.DeclarationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_investment_declaration");
        });

        modelBuilder.Entity<MonthlyTd>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("monthly_tds");

            entity.HasIndex(e => new { e.EmployeeId, e.FinancialYear }, "idx_tds_fy");

            entity.HasIndex(e => new { e.EmployeeId, e.TdsMonth }, "uk_tds_employee_month").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ComputedAt)
                .HasMaxLength(6)
                .HasColumnName("computed_at");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DeclarationApproved)
                .HasColumnType("bit(1)")
                .HasColumnName("declaration_approved");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FinancialYear)
                .HasMaxLength(7)
                .HasColumnName("financial_year");
            entity.Property(e => e.Regime)
                .HasMaxLength(3)
                .HasColumnName("regime");
            entity.Property(e => e.Tds)
                .HasPrecision(14, 2)
                .HasColumnName("tds");
            entity.Property(e => e.TdsMonth)
                .HasMaxLength(7)
                .HasColumnName("tds_month");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<TaxComputation>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("tax_computations");

            entity.HasIndex(e => new { e.EmployeeId, e.FinancialYear }, "uk_computation_employee_fy").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Cess)
                .HasPrecision(14, 2)
                .HasColumnName("cess");
            entity.Property(e => e.ComputedAt)
                .HasMaxLength(6)
                .HasColumnName("computed_at");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DeclarationApproved)
                .HasColumnType("bit(1)")
                .HasColumnName("declaration_approved");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FinancialYear)
                .HasMaxLength(7)
                .HasColumnName("financial_year");
            entity.Property(e => e.GrossIncome)
                .HasPrecision(14, 2)
                .HasColumnName("gross_income");
            entity.Property(e => e.Rebate)
                .HasPrecision(14, 2)
                .HasColumnName("rebate");
            entity.Property(e => e.Regime)
                .HasColumnType("enum('NEW','OLD')")
                .HasColumnName("regime");
            entity.Property(e => e.SlabTax)
                .HasPrecision(14, 2)
                .HasColumnName("slab_tax");
            entity.Property(e => e.StandardDeduction)
                .HasPrecision(14, 2)
                .HasColumnName("standard_deduction");
            entity.Property(e => e.TaxableIncome)
                .HasPrecision(14, 2)
                .HasColumnName("taxable_income");
            entity.Property(e => e.TotalDeductions)
                .HasPrecision(14, 2)
                .HasColumnName("total_deductions");
            entity.Property(e => e.TotalTax)
                .HasPrecision(14, 2)
                .HasColumnName("total_tax");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<TaxDeclaration>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("tax_declarations");

            entity.HasIndex(e => e.Status, "idx_declaration_status");

            entity.HasIndex(e => new { e.EmployeeId, e.FinancialYear }, "uk_declaration_employee_fy").IsUnique();

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
            entity.Property(e => e.FinancialYear)
                .HasMaxLength(7)
                .HasColumnName("financial_year");
            entity.Property(e => e.Regime)
                .HasColumnType("enum('NEW','OLD')")
                .HasColumnName("regime");
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
                .HasColumnType("enum('APPROVED','DRAFT','REJECTED','SUBMITTED','UNDER_REVIEW')")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedAt)
                .HasMaxLength(6)
                .HasColumnName("submitted_at");
            entity.Property(e => e.TotalApproved)
                .HasPrecision(14, 2)
                .HasColumnName("total_approved");
            entity.Property(e => e.TotalDeclared)
                .HasPrecision(14, 2)
                .HasColumnName("total_declared");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
        });

        modelBuilder.Entity<TaxDeclarationHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("tax_declaration_history");

            entity.HasIndex(e => new { e.DeclarationId, e.CreatedAt }, "idx_declaration_history");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(30)
                .HasColumnName("action");
            entity.Property(e => e.Comment)
                .HasMaxLength(500)
                .HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DeclarationId)
                .HasMaxLength(36)
                .HasColumnName("declaration_id");
            entity.Property(e => e.Status)
                .HasMaxLength(12)
                .HasColumnName("status");
            entity.Property(e => e.TotalDeclared)
                .HasPrecision(14, 2)
                .HasColumnName("total_declared");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Declaration).WithMany(p => p.TaxDeclarationHistories)
                .HasForeignKey(d => d.DeclarationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_tax_history_declaration");
        });

        modelBuilder.Entity<TaxDocument>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("tax_documents");

            entity.HasIndex(e => new { e.EmployeeId, e.FinancialYear }, "idx_taxdoc_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DocType)
                .HasColumnType("enum('FORM16_PART_A','FORM16_PART_B','OTHER','TAX_STATEMENT')")
                .HasColumnName("doc_type");
            entity.Property(e => e.DocumentId)
                .HasMaxLength(36)
                .HasColumnName("document_id");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.FinancialYear)
                .HasMaxLength(7)
                .HasColumnName("financial_year");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<TaxEmployee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId).HasName("PRIMARY");

            entity.ToTable("tax_employees");

            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FullName)
                .HasMaxLength(200)
                .HasColumnName("full_name");
            entity.Property(e => e.Status)
                .HasMaxLength(15)
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<TaxProof>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("tax_proofs");

            entity.HasIndex(e => e.DeclarationId, "fk_proof_declaration");

            entity.HasIndex(e => e.InvestmentId, "idx_proof_investment");

            entity.HasIndex(e => e.Status, "idx_proof_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AttemptNumber).HasColumnName("attempt_number");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DeclarationId)
                .HasMaxLength(36)
                .HasColumnName("declaration_id");
            entity.Property(e => e.DocumentId)
                .HasMaxLength(36)
                .HasColumnName("document_id");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.InvestmentId)
                .HasMaxLength(36)
                .HasColumnName("investment_id");
            entity.Property(e => e.ReviewedAt)
                .HasMaxLength(6)
                .HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewerComment)
                .HasMaxLength(500)
                .HasColumnName("reviewer_comment");
            entity.Property(e => e.ReviewerId)
                .HasMaxLength(36)
                .HasColumnName("reviewer_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('REJECTED','SUBMITTED','VERIFIED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Declaration).WithMany(p => p.TaxProofs)
                .HasForeignKey(d => d.DeclarationId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_proof_declaration");

            entity.HasOne(d => d.Investment).WithMany(p => p.TaxProofs)
                .HasForeignKey(d => d.InvestmentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_proof_investment");
        });

        modelBuilder.Entity<TaxRule>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("tax_rules");

            entity.HasIndex(e => new { e.FinancialYear, e.Regime }, "uk_tax_rule_fy_regime").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.CessPercent)
                .HasPrecision(5, 2)
                .HasColumnName("cess_percent");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.FinancialYear)
                .HasMaxLength(7)
                .HasColumnName("financial_year");
            entity.Property(e => e.RebateAmount)
                .HasPrecision(14, 2)
                .HasColumnName("rebate_amount");
            entity.Property(e => e.RebateLimit)
                .HasPrecision(14, 2)
                .HasColumnName("rebate_limit");
            entity.Property(e => e.Regime)
                .HasColumnType("enum('NEW','OLD')")
                .HasColumnName("regime");
            entity.Property(e => e.SectionLimits)
                .HasColumnType("json")
                .HasColumnName("section_limits");
            entity.Property(e => e.Slabs)
                .HasColumnType("json")
                .HasColumnName("slabs");
            entity.Property(e => e.StandardDeduction)
                .HasPrecision(14, 2)
                .HasColumnName("standard_deduction");
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
