using HR.Common.Hosting;
using HR.Common.Http;
using HR.Common.Messaging;
using HR.TimesheetService.Clients;
using HR.TimesheetService.Data;
using HR.TimesheetService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<TimesheetDbContext>("HR.TimesheetService", "hr_timesheet_db", 32111);
var s = builder.Services;
s.AddScoped<ITimesheetService, TimesheetService>();
s.AddHrClient<IProjectClient, ProjectClient>(builder.Configuration["Services:Project"] ?? "http://localhost:32110");
s.AddEmployeeReadModel<TimesheetEmployeeReadModel>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.TimesheetService");
await app.RunHrAsync<TimesheetDbContext>(["timesheets", "timesheet_entries", "timesheet_history", "timesheet_tasks", "timesheet_employees", "audit_history"]);
