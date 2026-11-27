using System;
using System.Collections.Generic;
using HR.EmployeeService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.EmployeeService.Data;

public partial class EmployeeDbContext : HR.Common.Data.HrDbContext
{
    public EmployeeDbContext(DbContextOptions<EmployeeDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditHistory> AuditHistories { get; set; }

    public virtual DbSet<EmergencyContact> EmergencyContacts { get; set; }

    public virtual DbSet<Employee> Employees { get; set; }

    public virtual DbSet<EmployeeAddress> EmployeeAddresses { get; set; }

    public virtual DbSet<EmployeeBankDetail> EmployeeBankDetails { get; set; }

    public virtual DbSet<EmployeeEducation> EmployeeEducations { get; set; }

    public virtual DbSet<EmployeeExperience> EmployeeExperiences { get; set; }

    public virtual DbSet<EmployeeSequence> EmployeeSequences { get; set; }

    public virtual DbSet<EmployeeStatusHistory> EmployeeStatusHistories { get; set; }

    public virtual DbSet<EmploymentHistory> EmploymentHistories { get; set; }

    public virtual DbSet<ProfileChangeLog> ProfileChangeLogs { get; set; }

    public virtual DbSet<VwEmployeeDirectory> VwEmployeeDirectories { get; set; }

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

        modelBuilder.Entity<EmergencyContact>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("emergency_contacts");

            entity.HasIndex(e => e.EmployeeId, "FKdllve8ih07ir0a3ng8o5ubj4w");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AlternatePhone)
                .HasMaxLength(20)
                .HasColumnName("alternate_phone");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Email)
                .HasMaxLength(150)
                .HasColumnName("email");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.IsPrimary)
                .HasColumnType("bit(1)")
                .HasColumnName("is_primary");
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.Phone)
                .HasMaxLength(20)
                .HasColumnName("phone");
            entity.Property(e => e.Relationship)
                .HasMaxLength(50)
                .HasColumnName("relationship");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Employee).WithMany(p => p.EmergencyContacts)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FKdllve8ih07ir0a3ng8o5ubj4w");
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employees");

            entity.HasIndex(e => e.DepartmentId, "idx_employee_department");

            entity.HasIndex(e => e.ManagerId, "idx_employee_manager");

            entity.HasIndex(e => new { e.LastName, e.FirstName }, "idx_employee_name");

            entity.HasIndex(e => e.Status, "idx_employee_status");

            entity.HasIndex(e => e.EmployeeCode, "uk_employee_code").IsUnique();

            entity.HasIndex(e => e.WorkEmail, "uk_employee_work_email").IsUnique();

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AlternatePhone)
                .HasMaxLength(20)
                .HasColumnName("alternate_phone");
            entity.Property(e => e.BloodGroup)
                .HasMaxLength(5)
                .HasColumnName("blood_group");
            entity.Property(e => e.ConfirmationDate).HasColumnName("confirmation_date");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.DateOfBirth).HasColumnName("date_of_birth");
            entity.Property(e => e.Deleted)
                .HasColumnType("bit(1)")
                .HasColumnName("deleted");
            entity.Property(e => e.DeletedAt)
                .HasMaxLength(6)
                .HasColumnName("deleted_at");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.DesignationId)
                .HasMaxLength(36)
                .HasColumnName("designation_id");
            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(20)
                .HasColumnName("employee_code");
            entity.Property(e => e.EmploymentType)
                .HasColumnType("enum('CONTRACT','FULL_TIME','INTERN','PART_TIME')")
                .HasColumnName("employment_type");
            entity.Property(e => e.ExitDate).HasColumnName("exit_date");
            entity.Property(e => e.FirstName)
                .HasMaxLength(80)
                .HasColumnName("first_name");
            entity.Property(e => e.Gender)
                .HasColumnType("enum('FEMALE','MALE','OTHER','UNDISCLOSED')")
                .HasColumnName("gender");
            entity.Property(e => e.JobGradeId)
                .HasMaxLength(36)
                .HasColumnName("job_grade_id");
            entity.Property(e => e.JoiningDate).HasColumnName("joining_date");
            entity.Property(e => e.LastName)
                .HasMaxLength(80)
                .HasColumnName("last_name");
            entity.Property(e => e.LocationId)
                .HasMaxLength(36)
                .HasColumnName("location_id");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.MaritalStatus)
                .HasColumnType("enum('DIVORCED','MARRIED','SINGLE','WIDOWED')")
                .HasColumnName("marital_status");
            entity.Property(e => e.MiddleName)
                .HasMaxLength(80)
                .HasColumnName("middle_name");
            entity.Property(e => e.NationalId)
                .HasMaxLength(200)
                .HasColumnName("national_id");
            entity.Property(e => e.Nationality)
                .HasMaxLength(60)
                .HasColumnName("nationality");
            entity.Property(e => e.NoticePeriodDays).HasColumnName("notice_period_days");
            entity.Property(e => e.PanNumber)
                .HasMaxLength(200)
                .HasColumnName("pan_number");
            entity.Property(e => e.PersonalEmail)
                .HasMaxLength(150)
                .HasColumnName("personal_email");
            entity.Property(e => e.Phone)
                .HasMaxLength(20)
                .HasColumnName("phone");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','INACTIVE','ON_NOTICE','RESIGNED','TERMINATED')")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Version).HasColumnName("version");
            entity.Property(e => e.WorkEmail)
                .HasMaxLength(150)
                .HasColumnName("work_email");
        });

        modelBuilder.Entity<EmployeeAddress>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_addresses");

            entity.HasIndex(e => e.EmployeeId, "FK4kelvir0i8vgoydc61kl4jpgv");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.City)
                .HasMaxLength(80)
                .HasColumnName("city");
            entity.Property(e => e.Country)
                .HasMaxLength(80)
                .HasColumnName("country");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.IsPrimary)
                .HasColumnType("bit(1)")
                .HasColumnName("is_primary");
            entity.Property(e => e.Line1)
                .HasMaxLength(150)
                .HasColumnName("line1");
            entity.Property(e => e.Line2)
                .HasMaxLength(150)
                .HasColumnName("line2");
            entity.Property(e => e.PostalCode)
                .HasMaxLength(15)
                .HasColumnName("postal_code");
            entity.Property(e => e.State)
                .HasMaxLength(80)
                .HasColumnName("state");
            entity.Property(e => e.Type)
                .HasColumnType("enum('CURRENT','MAILING','OFFICE','PERMANENT')")
                .HasColumnName("type");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Employee).WithMany(p => p.EmployeeAddresses)
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK4kelvir0i8vgoydc61kl4jpgv");
        });

        modelBuilder.Entity<EmployeeBankDetail>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_bank_details");

            entity.HasIndex(e => e.EmployeeId, "FKlubeqplhmxo40vv4ao87yptj2");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.AccountHolderName)
                .HasMaxLength(120)
                .HasColumnName("account_holder_name");
            entity.Property(e => e.AccountNumber)
                .HasMaxLength(200)
                .HasColumnName("account_number");
            entity.Property(e => e.AccountType)
                .HasMaxLength(20)
                .HasColumnName("account_type");
            entity.Property(e => e.BankName)
                .HasMaxLength(120)
                .HasColumnName("bank_name");
            entity.Property(e => e.Branch)
                .HasMaxLength(120)
                .HasColumnName("branch");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.IfscCode)
                .HasMaxLength(200)
                .HasColumnName("ifsc_code");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Employee).WithMany(p => p.EmployeeBankDetails)
                .HasForeignKey(d => d.EmployeeId)
                .HasConstraintName("FKlubeqplhmxo40vv4ao87yptj2");
        });

        modelBuilder.Entity<EmployeeEducation>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_education");

            entity.HasIndex(e => e.EmployeeId, "FKp4wlgwluyoknphmwhgn2o5pks");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Degree)
                .HasMaxLength(120)
                .HasColumnName("degree");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EndYear).HasColumnName("end_year");
            entity.Property(e => e.FieldOfStudy)
                .HasMaxLength(120)
                .HasColumnName("field_of_study");
            entity.Property(e => e.Grade)
                .HasMaxLength(40)
                .HasColumnName("grade");
            entity.Property(e => e.Institution)
                .HasMaxLength(200)
                .HasColumnName("institution");
            entity.Property(e => e.StartYear).HasColumnName("start_year");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");

            entity.HasOne(d => d.Employee).WithMany(p => p.EmployeeEducations)
                .HasForeignKey(d => d.EmployeeId)
                .HasConstraintName("FKp4wlgwluyoknphmwhgn2o5pks");
        });

        modelBuilder.Entity<EmployeeExperience>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_experience");

            entity.HasIndex(e => e.EmployeeId, "idx_experience_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.Company)
                .HasMaxLength(150)
                .HasColumnName("company");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.Description)
                .HasMaxLength(500)
                .HasColumnName("description");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.JobTitle)
                .HasMaxLength(120)
                .HasColumnName("job_title");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
            entity.Property(e => e.Verified)
                .HasColumnType("bit(1)")
                .HasColumnName("verified");
        });

        modelBuilder.Entity<EmployeeSequence>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_sequence");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.NextValue).HasColumnName("next_value");
        });

        modelBuilder.Entity<EmployeeStatusHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employee_status_history");

            entity.HasIndex(e => new { e.EmployeeId, e.ChangedAt }, "idx_status_history_employee");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ChangedAt)
                .HasMaxLength(6)
                .HasColumnName("changed_at");
            entity.Property(e => e.ChangedBy)
                .HasMaxLength(100)
                .HasColumnName("changed_by");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(15)
                .HasColumnName("new_status");
            entity.Property(e => e.OldStatus)
                .HasMaxLength(15)
                .HasColumnName("old_status");
        });

        modelBuilder.Entity<EmploymentHistory>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("employment_history");

            entity.HasIndex(e => new { e.EmployeeId, e.EffectiveDate }, "idx_history_employee");

            entity.Property(e => e.Id)
                .HasMaxLength(36)
                .HasColumnName("id");
            entity.Property(e => e.ChangeType)
                .HasColumnType("enum('DETAILS_UPDATE','JOINED','MANAGER_CHANGE','PROMOTION','STATUS_CHANGE','TRANSFER')")
                .HasColumnName("change_type");
            entity.Property(e => e.CreatedAt)
                .HasMaxLength(6)
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .HasColumnName("created_by");
            entity.Property(e => e.EffectiveDate).HasColumnName("effective_date");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.FromValue)
                .HasMaxLength(500)
                .HasColumnName("from_value");
            entity.Property(e => e.Reason)
                .HasMaxLength(300)
                .HasColumnName("reason");
            entity.Property(e => e.ToValue)
                .HasMaxLength(500)
                .HasColumnName("to_value");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<ProfileChangeLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PRIMARY");

            entity.ToTable("profile_change_log");

            entity.HasIndex(e => new { e.EmployeeId, e.CreatedAt }, "idx_profile_log_employee");

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
            entity.Property(e => e.FieldName)
                .HasMaxLength(60)
                .HasColumnName("field_name");
            entity.Property(e => e.NewValue)
                .HasMaxLength(500)
                .HasColumnName("new_value");
            entity.Property(e => e.OldValue)
                .HasMaxLength(500)
                .HasColumnName("old_value");
            entity.Property(e => e.UpdatedAt)
                .HasMaxLength(6)
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy)
                .HasMaxLength(100)
                .HasColumnName("updated_by");
        });

        modelBuilder.Entity<VwEmployeeDirectory>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vw_employee_directory");

            entity.Property(e => e.DepartmentId)
                .HasMaxLength(36)
                .HasColumnName("department_id");
            entity.Property(e => e.DesignationId)
                .HasMaxLength(36)
                .HasColumnName("designation_id");
            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(20)
                .HasColumnName("employee_code");
            entity.Property(e => e.EmployeeId)
                .HasMaxLength(36)
                .HasColumnName("employee_id");
            entity.Property(e => e.EmploymentType)
                .HasColumnType("enum('CONTRACT','FULL_TIME','INTERN','PART_TIME')")
                .HasColumnName("employment_type");
            entity.Property(e => e.FullName)
                .HasMaxLength(161)
                .HasColumnName("full_name");
            entity.Property(e => e.JoiningDate).HasColumnName("joining_date");
            entity.Property(e => e.LocationId)
                .HasMaxLength(36)
                .HasColumnName("location_id");
            entity.Property(e => e.ManagerId)
                .HasMaxLength(36)
                .HasColumnName("manager_id");
            entity.Property(e => e.Status)
                .HasColumnType("enum('ACTIVE','INACTIVE','ON_NOTICE','RESIGNED','TERMINATED')")
                .HasColumnName("status");
            entity.Property(e => e.TenureMonths).HasColumnName("tenure_months");
            entity.Property(e => e.WorkEmail)
                .HasMaxLength(150)
                .HasColumnName("work_email");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
