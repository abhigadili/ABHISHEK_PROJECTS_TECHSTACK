using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Http;
using HR.ProjectService.Clients;
using HR.ProjectService.Consumers;
using HR.ProjectService.Data;
using HR.ProjectService.DTOs;
using HR.ProjectService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<ProjectDbContext>("HR.ProjectService", "hr_project_db", 32110);
var s = builder.Services;
s.AddScoped<ICrudService<CustomerRequest, CustomerDto>, CustomerService>();
s.AddScoped<IContactService, ContactService>();
s.AddScoped<IProjectService, ProjectService>();
s.AddHrClient<IEmployeeClient, EmployeeClient>(builder.Configuration["Services:Employee"] ?? "http://localhost:32102");
s.AddEventHandler<EmployeeExitedHandler>();
s.AddEventHandler<EmployeeTerminatedHandler>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.ProjectService");
await app.RunHrAsync<ProjectDbContext>(["customers", "customer_contacts", "projects", "project_allocations", "project_history", "audit_history"]);
