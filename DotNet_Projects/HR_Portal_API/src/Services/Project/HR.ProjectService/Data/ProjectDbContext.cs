using System;
using System.Collections.Generic;
using HR.ProjectService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ProjectService.Data;

public partial class ProjectDbContext : HR.Common.Data.HrDbContext
{
    public ProjectDbContext(DbContextOptions<ProjectDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<Customer> Customers { get; set; }

    public virtual DbSet<CustomerContact> CustomerContacts { get; set; }

    public virtual DbSet<Project> Projects { get; set; }

    public virtual DbSet<ProjectAllocation> ProjectAllocations { get; set; }

    public virtual DbSet<ProjectHistory> ProjectHistories { get; set; }

    public virtual DbSet<VwProjectEmployeeAllocation> VwProjectEmployeeAllocations { get; set; }

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

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("customers");

            entity.HasIndex(e => e.Code, "uk_customer_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.BillingAddress)
                .HasMaxLength(300)
                .HasColumnName("billing_address");
            entity.Property(e => e.BillingEmail)
                .HasMaxLength(150)
                .HasColumnName("billing_email");
            entity.Property(e => e.Code)
                .HasMaxLength(30)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.CreditLimit)
                .HasPrecision(16, 2)
                .HasColumnName("credit_limit");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.Industry)
                .HasMaxLength(80)
                .HasColumnName("industry");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
            entity.Property(e => e.Notes)
                .HasMaxLength(500)
                .HasColumnName("notes");
            entity.Property(e => e.PaymentTermsDays).HasColumnName("payment_terms_days");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','INACTIVE')")
                .HasColumnName("status");
            entity.Property(e => e.TaxNumber)
                .HasMaxLength(200)
                .HasColumnName("tax_number");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Website)
                .HasMaxLength(200)
                .HasColumnName("website");
        });

        modelBuilder.Entity<CustomerContact>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("customer_contacts");

            entity.HasIndex(e => e.CustomerId, "idx_contact_customer");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(36)
                .HasColumnName("customer_id");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.Designation)
                .HasMaxLength(100)
                .HasColumnName("designation");
            entity.Property(e => e.Email)
                .HasMaxLength(150)
                .HasColumnName("email");
            entity.Property(e => e.IsPrimary)
                .HasColumnType("bit(1)")
                .HasColumnName("is_primary");
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.Phone)
                .HasMaxLength(25)
                .HasColumnName("phone");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Customer).WithMany(p => p.CustomerContacts)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_contact_customer");
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("projects");

            entity.HasIndex(e => e.CustomerId, "idx_project_customer");

            entity.HasIndex(e => e.ProjectManagerId, "idx_project_manager");

            entity.HasIndex(e => e.Status, "idx_project_status");

            entity.HasIndex(e => e.Code, "uk_project_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.BillingContactId)
                .HasMaxLength(36)
                .HasColumnName("billing_contact_id");
            entity.Property(e => e.BillingModel)
                .HasColumnType("enum('FIXED_PRICE','NON_BILLABLE','RETAINER','TIME_AND_MATERIAL')")
                .HasColumnName("billing_model");
            entity.Property(e => e.BillingNotes)
                .HasMaxLength(500)
                .HasColumnName("billing_notes");
            entity.Property(e => e.BillingRate)
                .HasPrecision(12, 2)
                .HasColumnName("billing_rate");
            entity.Property(e => e.Budget)
                .HasPrecision(16, 2)
                .HasColumnName("budget");
            entity.Property(e => e.Code)
                .HasMaxLength(30)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Currency)
                .HasMaxLength(3)
                .HasColumnName("currency");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(36)
                .HasColumnName("customer_id");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.Description)
                .HasMaxLength(1000)
                .HasColumnName("description");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
            entity.Property(e => e.ProjectManagerId)
                .HasMaxLength(36)
                .HasColumnName("project_manager_id");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','CANCELLED','COMPLETED','ON_HOLD','PLANNED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");

            entity.HasOne(d => d.Customer).WithMany(p => p.Projects)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_project_customer");
        });

        modelBuilder.Entity<ProjectAllocation>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("project_allocations");

            entity.HasIndex(e => new { e.EmployeeId, e.StartDate, e.EndDate }, "idx_alloc_employee");

            entity.HasIndex(e => new { e.ProjectId, e.Status }, "idx_alloc_project");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AllocationPercent)
                .HasPrecision(5, 2)
                .HasColumnName("allocation_percent");
            entity.Property(e => e.Billable)
                .HasColumnType("bit(1)")
                .HasColumnName("billable");
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
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.ProjectId)
                .HasMaxLength(36)
                .HasColumnName("project_id");
            entity.Property(e => e.Role)
                .HasMaxLength(80)
                .HasColumnName("role");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','ENDED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Project).WithMany(p => p.ProjectAllocations)
                .HasForeignKey(d => d.ProjectId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_alloc_project");
        });

        modelBuilder.Entity<ProjectHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("project_history");

            entity.HasIndex(e => new { e.ProjectId, e.CreatedAt }, "idx_project_history");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ChangeType)
                .HasMaxLength(40)
                .HasColumnName("change_type");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.NewValue)
                .HasMaxLength(500)
                .HasColumnName("new_value");
            entity.Property(e => e.OldValue)
                .HasMaxLength(500)
                .HasColumnName("old_value");
            entity.Property(e => e.ProjectId)
                .HasMaxLength(36)
                .HasColumnName("project_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Project).WithMany(p => p.ProjectHistories)
                .HasForeignKey(d => d.ProjectId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_history_project");
        });

        modelBuilder.Entity<VwProjectEmployeeAllocation>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_project_employee_allocation");

            entity.Property(e => e.AllocationId)
                .HasMaxLength(36)
                .HasColumnName("allocation_id");
            entity.Property(e => e.AllocationPercent)
                .HasPrecision(5, 2)
                .HasColumnName("allocation_percent");
            entity.Property(e => e.AllocationStatus)
                .HasColumnType("enum('ACTIVE','ENDED')")
                .HasColumnName("allocation_status");
            entity.Property(e => e.Billable)
                .HasColumnType("bit(1)")
                .HasColumnName("billable");
            entity.Property(e => e.CustomerName)
                .HasMaxLength(150)
                .HasColumnName("customer_name");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmployeeName)
                .HasMaxLength(200)
                .HasColumnName("employee_name");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.ProjectCode)
                .HasMaxLength(30)
                .HasColumnName("project_code");
            entity.Property(e => e.ProjectId)
                .HasMaxLength(36)
                .HasColumnName("project_id");
            entity.Property(e => e.ProjectName)
                .HasMaxLength(150)
                .HasColumnName("project_name");
            entity.Property(e => e.ProjectStatus)
                .HasColumnType("enum('ACTIVE','CANCELLED','COMPLETED','ON_HOLD','PLANNED')")
                .HasColumnName("project_status");
            entity.Property(e => e.Role)
                .HasMaxLength(80)
                .HasColumnName("role");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
