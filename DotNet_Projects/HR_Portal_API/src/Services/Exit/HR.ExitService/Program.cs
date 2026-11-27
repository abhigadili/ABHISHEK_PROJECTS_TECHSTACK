using HR.Common.Hosting;
using HR.Common.Http;
using HR.ExitService.Clients;
using HR.ExitService.Data;
using HR.ExitService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<ExitDbContext>("HR.ExitService", "hr_exit_db", 32112);
var s = builder.Services;
var cfg = builder.Configuration;
s.AddScoped<IResignationService, ResignationService>();
s.AddScoped<IExitTasksService, ExitTasksService>();
s.AddScoped<ISettlementService, SettlementService>();
s.AddHrClient<IEmployeeClient, EmployeeClient>(cfg["Services:Employee"] ?? "http://localhost:32102");
s.AddHrClient<IPayrollClient, PayrollClient>(cfg["Services:Payroll"] ?? "http://localhost:32107");

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.ExitService");
await app.RunHrAsync<ExitDbContext>(["resignations", "exit_tasks", "exit_history", "exit_interviews", "exit_interview_forms", "exit_policy", "settlements", "settlement_lines", "audit_history"]);
