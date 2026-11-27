using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Http;
using HR.Common.Messaging;
using HR.LeaveService.Clients;
using HR.LeaveService.Data;
using HR.LeaveService.DTOs;
using HR.LeaveService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<LeaveDbContext>("HR.LeaveService", "hr_leave_db", 32104);
var s = builder.Services;
s.AddScoped<ILeaveApplicationService, LeaveApplicationService>();
s.AddScoped<IBalanceService, BalanceService>();
s.AddScoped<IPolicyService, PolicyService>();
s.AddScoped<ICrudService<LeaveTypeRequest, LeaveTypeDto>, LeaveTypeService>();
s.AddHrClient<IHolidayClient, HolidayClient>(builder.Configuration["Services:Holiday"] ?? "http://localhost:32106");
s.AddHrClient<IEmployeeClient, EmployeeClient>(builder.Configuration["Services:Employee"] ?? "http://localhost:32102");
s.AddEmployeeReadModel<LeaveEmployeeReadModel>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.LeaveService");
await app.RunHrAsync<LeaveDbContext>(["leave_applications", "leave_approvals", "leave_attachments", "leave_balances", "leave_balance_history", "leave_comments", "leave_employees", "leave_policies", "leave_policy_entitlements", "leave_run_log", "leave_types", "audit_history"]);
