using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CourseService.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "dn_course_categories",
                columns: table => new
                {
                    CategoryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Name = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dn_course_categories", x => x.CategoryId);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "dn_courses",
                columns: table => new
                {
                    CourseId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    CourseName = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CourseCode = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "text", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CategoryId = table.Column<long>(type: "bigint", nullable: true),
                    DurationWeeks = table.Column<int>(type: "int", nullable: false),
                    Fees = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    TotalSeats = table.Column<int>(type: "int", nullable: false),
                    AvailableSeats = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dn_courses", x => x.CourseId);
                    table.CheckConstraint("chk_dn_courses_seats", "`AvailableSeats` >= 0 AND `AvailableSeats` <= `TotalSeats`");
                    table.ForeignKey(
                        name: "FK_dn_courses_dn_course_categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "dn_course_categories",
                        principalColumn: "CategoryId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "dn_seat_reservations",
                columns: table => new
                {
                    ReservationId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    EnrollmentId = table.Column<long>(type: "bigint", nullable: false),
                    CourseId = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dn_seat_reservations", x => x.ReservationId);
                    table.ForeignKey(
                        name: "FK_dn_seat_reservations_dn_courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "dn_courses",
                        principalColumn: "CourseId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "uk_dn_course_categories_name",
                table: "dn_course_categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_dn_courses_status",
                table: "dn_courses",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_dn_courses_CategoryId",
                table: "dn_courses",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "uk_dn_courses_code",
                table: "dn_courses",
                column: "CourseCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_dn_seat_res_course",
                table: "dn_seat_reservations",
                columns: new[] { "CourseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "uk_dn_seat_res_enrollment",
                table: "dn_seat_reservations",
                column: "EnrollmentId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dn_seat_reservations");

            migrationBuilder.DropTable(
                name: "dn_courses");

            migrationBuilder.DropTable(
                name: "dn_course_categories");
        }
    }
}
