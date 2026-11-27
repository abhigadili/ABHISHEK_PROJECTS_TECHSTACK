using HR.AttendanceService.Clients;
using HR.AttendanceService.Data;
using HR.AttendanceService.DTOs;
using HR.AttendanceService.Jobs;
using HR.AttendanceService.Services;
using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Http;
using HR.Common.Messaging;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<AttendanceDbContext>("HR.AttendanceService", "hr_attendance_db", 32105);
var s = builder.Services;
s.AddSingleton<OfficeTime>();
s.AddScoped<IAttendanceService, AttendanceService>();
s.AddScoped<ICorrectionService, CorrectionService>();
s.AddScoped<IWfhService, WfhService>();
s.AddScoped<IShiftAssignmentService, ShiftAssignmentService>();
s.AddScoped<ICrudService<ShiftRequest, ShiftDto>, ShiftCrudService>();
s.AddHrClient<IHolidayClient, HolidayClient>(builder.Configuration["Services:Holiday"] ?? "http://localhost:32106");
s.AddEmployeeReadModel<AttendanceEmployeeReadModel>();
s.AddEventHandler<LeaveApprovedHandler>();
s.AddEventHandler<LeaveCancelledHandler>();
s.AddHostedService<MissingPunchJob>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.AttendanceService");
await app.RunHrAsync<AttendanceDbContext>(["attendance_records", "attendance_corrections", "attendance_employees", "approved_leave_days", "holiday_snapshots", "monthly_attendance_summary", "shifts", "shift_assignments", "wfh_requests", "audit_history"]);
