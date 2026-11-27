using System;
using System.Collections.Generic;
using HR.HolidayService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.HolidayService.Data;

public partial class HolidayDbContext : HR.Common.Data.HrDbContext
{
    public HolidayDbContext(DbContextOptions<HolidayDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<Holiday> Holidays { get; set; }

    public virtual DbSet<HolidayScope> HolidayScopes { get; set; }

    public virtual DbSet<HolidayYear> HolidayYears { get; set; }

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

        modelBuilder.Entity<Holiday>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("holidays");

            entity.HasIndex(e => e.HolidayDate, "idx_holiday_date");

            entity.HasIndex(e => e.HolidayYear, "idx_holiday_year");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
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
            entity.Property(e => e.HolidayDate).HasColumnName("holiday_date");
            entity.Property(e => e.HolidayYear).HasColumnName("holiday_year");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
            entity.Property(e => e.Type)
                .HasColumnType("enum('MANDATORY','OPTIONAL','RESTRICTED')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<HolidayScope>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("holiday_scopes");

            entity.HasIndex(e => e.HolidayId, "FK5mv2nwvw7620uivkbuh8yy125");

            entity.Property(e => e.HolidayId)
                .HasMaxLength(36)
                .HasColumnName("holiday_id");
            entity.Property(e => e.ScopeId)
                .HasMaxLength(36)
                .HasColumnName("scope_id");
            entity.Property(e => e.ScopeType)
                .HasColumnType("enum('DEPARTMENT','LOCATION')")
                .HasColumnName("scope_type");

            entity.HasOne(d => d.Holiday).WithMany()
                .HasForeignKey(d => d.HolidayId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK5mv2nwvw7620uivkbuh8yy125");
        });

        modelBuilder.Entity<HolidayYear>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("holiday_years");

            entity.HasIndex(e => e.YearNumber, "uk_holiday_year").IsUnique();

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
            entity.Property(e => e.Description)
                .HasMaxLength(200)
                .HasColumnName("description");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.YearNumber).HasColumnName("year_number");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
