using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HMS.Doctors.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateTable(
                name: "hdn_doctors",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    FirstName = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LastName = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Email = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Phone = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LicenseNumber = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Specialization = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Qualification = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExperienceYears = table.Column<int>(type: "int", nullable: true),
                    ConsultationFee = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    HospitalId = table.Column<long>(type: "bigint", nullable: false),
                    DepartmentId = table.Column<long>(type: "bigint", nullable: true),
                    Active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hdn_doctors", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "hdn_doctor_schedules",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    DoctorId = table.Column<long>(type: "bigint", nullable: false),
                    DayOfWeek = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StartTime = table.Column<TimeOnly>(type: "time(6)", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time(6)", nullable: false),
                    SlotMinutes = table.Column<int>(type: "int", nullable: false),
                    BreakStart = table.Column<TimeOnly>(type: "time(6)", nullable: true),
                    BreakEnd = table.Column<TimeOnly>(type: "time(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hdn_doctor_schedules", x => x.Id);
                    table.ForeignKey(
                        name: "fk_hdn_schedule_doctor",
                        column: x => x.DoctorId,
                        principalTable: "hdn_doctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "hdn_doctor_unavailability",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    DoctorId = table.Column<long>(type: "bigint", nullable: false),
                    UnavailableDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hdn_doctor_unavailability", x => x.Id);
                    table.ForeignKey(
                        name: "fk_hdn_unavailable_doctor",
                        column: x => x.DoctorId,
                        principalTable: "hdn_doctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "uk_schedule_doctor_day",
                table: "hdn_doctor_schedules",
                columns: new[] { "DoctorId", "DayOfWeek" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uk_unavailable_doctor_date",
                table: "hdn_doctor_unavailability",
                columns: new[] { "DoctorId", "UnavailableDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_doctor_hospital",
                table: "hdn_doctors",
                columns: new[] { "HospitalId", "DepartmentId" });

            migrationBuilder.CreateIndex(
                name: "idx_doctor_specialization",
                table: "hdn_doctors",
                columns: new[] { "Specialization", "Active" });

            migrationBuilder.CreateIndex(
                name: "uk_doctor_email",
                table: "hdn_doctors",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uk_doctor_license",
                table: "hdn_doctors",
                column: "LicenseNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uk_doctor_user",
                table: "hdn_doctors",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hdn_doctor_schedules");

            migrationBuilder.DropTable(
                name: "hdn_doctor_unavailability");

            migrationBuilder.DropTable(
                name: "hdn_doctors");
        }
    }
}
