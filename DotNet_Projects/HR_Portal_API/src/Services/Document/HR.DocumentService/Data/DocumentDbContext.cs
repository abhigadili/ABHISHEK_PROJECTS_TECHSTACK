using System;
using System.Collections.Generic;
using HR.DocumentService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.DocumentService.Data;

public partial class DocumentDbContext : HR.Common.Data.HrDbContext
{
    public DocumentDbContext(DbContextOptions<DocumentDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<Document> Documents { get; set; }

    public virtual DbSet<DocumentCategory> DocumentCategories { get; set; }

    public virtual DbSet<DocumentHistory> DocumentHistories { get; set; }

    public virtual DbSet<DocumentPermission> DocumentPermissions { get; set; }

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

        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("documents");

            entity.HasIndex(e => e.CategoryId, "fk_document_category");

            entity.HasIndex(e => e.ExpiryDate, "idx_document_expiry");

            entity.HasIndex(e => new { e.OwnerEmployeeId, e.CategoryId, e.CurrentVersion }, "idx_document_owner");

            entity.HasIndex(e => e.Status, "idx_document_status");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CategoryId)
                .HasMaxLength(36)
                .HasColumnName("category_id");
            entity.Property(e => e.ContentType)
                .HasMaxLength(100)
                .HasColumnName("content_type");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.CurrentVersion)
                .HasColumnType("bit(1)")
                .HasColumnName("current_version");
            entity.Property(e => e.DecidedAt)
                .HasMaxLength(6)
                .HasColumnName("decided_at");
            entity.Property(e => e.DecidedBy)
                .HasMaxLength(100)
                .HasColumnName("decided_by");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.ExpiryDate).HasColumnName("expiry_date");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.OptimisticVersion).HasColumnName("optimistic_version");
            entity.Property(e => e.OwnerEmployeeId)
                .HasMaxLength(36)
                .HasColumnName("owner_employee_id");
            entity.Property(e => e.PreviousVersionId)
                .HasMaxLength(36)
                .HasColumnName("previous_version_id");
            entity.Property(e => e.RejectionReason)
                .HasMaxLength(500)
                .HasColumnName("rejection_reason");
            entity.Property(e => e.Sha256)
                .HasMaxLength(64)
                .HasColumnName("sha256");
            entity.Property(e => e.SizeBytes).HasColumnName("size_bytes");
            entity.Property(e => e.Source)
                .HasColumnType("enum('EXIT','LEAVE','MANUAL','PAYSLIP','TAX')")
                .HasColumnName("source");
            entity.Property(e => e.Status)
                .HasColumnType("enum('APPROVED','REJECTED','UPLOADED','VERIFIED')")
                .HasColumnName("status");
            entity.Property(e => e.StoragePath)
                .HasMaxLength(300)
                .HasColumnName("storage_path");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.UploadedBy)
                .HasMaxLength(100)
                .HasColumnName("uploaded_by");
            entity.Property(e => e.VersionNumber).HasColumnName("version_number");

            entity.HasOne(d => d.Category).WithMany(p => p.Documents)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_document_category");
        });

        modelBuilder.Entity<DocumentCategory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("document_categories");

            entity.HasIndex(e => e.Code, "uk_doc_category_code").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Active)
                .HasColumnType("bit(1)")
                .HasColumnName("active");
            entity.Property(e => e.Code)
                .HasMaxLength(30)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DefaultExpiryMonths).HasColumnName("default_expiry_months");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.Description)
                .HasMaxLength(300)
                .HasColumnName("description");
            entity.Property(e => e.IsSensitive)
                .HasColumnType("bit(1)")
                .HasColumnName("is_sensitive");
            entity.Property(e => e.Name)
                .HasMaxLength(100)
                .HasColumnName("name");
            entity.Property(e => e.ReadRoles)
                .HasMaxLength(200)
                .HasColumnName("read_roles");
            entity.Property(e => e.RequiresVerification)
                .HasColumnType("bit(1)")
                .HasColumnName("requires_verification");
            entity.Property(e => e.SelfUploadAllowed)
                .HasColumnType("bit(1)")
                .HasColumnName("self_upload_allowed");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<DocumentHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("document_history");

            entity.HasIndex(e => new { e.DocumentId, e.CreatedAt }, "idx_doc_history");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Action)
                .HasMaxLength(30)
                .HasColumnName("action");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Detail)
                .HasMaxLength(500)
                .HasColumnName("detail");
            entity.Property(e => e.DocumentId)
                .HasMaxLength(36)
                .HasColumnName("document_id");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Document).WithMany(p => p.DocumentHistories)
                .HasForeignKey(d => d.DocumentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_doc_history_document");
        });

        modelBuilder.Entity<DocumentPermission>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("document_permissions");

            entity.HasIndex(e => e.DocumentId, "idx_permission_document");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AccessLevel)
                .HasColumnType("enum('DOWNLOAD','VIEW')")
                .HasColumnName("access_level");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DocumentId)
                .HasMaxLength(36)
                .HasColumnName("document_id");
            entity.Property(e => e.ExpiresAt)
                .HasMaxLength(6)
                .HasColumnName("expires_at");
            entity.Property(e => e.GranteeId)
                .HasMaxLength(60)
                .HasColumnName("grantee_id");
            entity.Property(e => e.GranteeType)
                .HasColumnType("enum('EMPLOYEE','ROLE')")
                .HasColumnName("grantee_type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Document).WithMany(p => p.DocumentPermissions)
                .HasForeignKey(d => d.DocumentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_permission_document");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
