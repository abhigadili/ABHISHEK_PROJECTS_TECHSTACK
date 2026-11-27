using HR.Common.Hosting;
using HR.Common.Http;
using HR.Common.Messaging;
using HR.ReportingService.Clients;
using HR.ReportingService.Consumers;
using HR.ReportingService.Data;
using HR.ReportingService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<ReportingDbContext>("HR.ReportingService", "hr_reporting_db", 32115);
var s = builder.Services;
var cfg = builder.Configuration;
s.AddScoped<IReportingService, ReportingService>();
s.AddHrClient<IPayrollApi, PayrollApi>(cfg["Services:Payroll"] ?? "http://localhost:32107", 10);
s.AddHrClient<IProjectApi, ProjectApi>(cfg["Services:Project"] ?? "http://localhost:32110", 10);
s.AddHrClient<IPerformanceApi, PerformanceApi>(cfg["Services:Performance"] ?? "http://localhost:32109", 10);
s.AddEmployeeReadModel<ReportingEmployeeReadModel>();
s.AddReportingConsumers();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.ReportingService");
await app.RunHrAsync<ReportingDbContext>(["rpt_employees", "rpt_facts", "audit_history"]);
