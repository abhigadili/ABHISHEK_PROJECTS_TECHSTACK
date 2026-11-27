using HR.Common.Http;
using HR.Common.Hosting;
using HR.EmployeeService.Clients;
using HR.EmployeeService.Consumers;
using HR.EmployeeService.Data;
using HR.EmployeeService.Mapping;
using HR.EmployeeService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<EmployeeDbContext>("HR.EmployeeService", "hr_employee_db", 32102);
EmployeeMapping.Register();
builder.Services.AddScoped<IEmployeeService, EmployeeService>();
builder.Services.AddScoped<ISubResourceService, SubResourceService>();
builder.Services.AddHrClient<IOrganizationClient, OrganizationClient>(builder.Configuration["Services:Organization"] ?? "http://localhost:32103");
builder.Services.AddEventHandler<EmployeeExitedHandler>();
builder.Services.AddEventHandler<ResignationSubmittedHandler>();
builder.Services.AddEventHandler<ResignationWithdrawnHandler>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.EmployeeService");
await app.RunHrAsync<EmployeeDbContext>(["employees", "employee_addresses", "emergency_contacts", "employee_education", "employee_experience", "employee_bank_details", "employment_history", "profile_change_log", "employee_status_history", "employee_sequence", "audit_history"]);
