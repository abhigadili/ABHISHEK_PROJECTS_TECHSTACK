using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Http;
using HR.Common.Messaging;
using HR.OrganizationService.Clients;
using HR.OrganizationService.Data;
using HR.OrganizationService.DTOs;
using HR.OrganizationService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<OrganizationDbContext>("HR.OrganizationService", "hr_organization_db", 32103);
var s = builder.Services;
s.AddScoped<ICrudService<OrganizationRequest, OrganizationDto>, OrganizationRefService>();
s.AddScoped<ICrudService<BusinessUnitRequest, BusinessUnitDto>, BusinessUnitService>();
s.AddScoped<ICrudService<DepartmentRequest, DepartmentDto>, DepartmentService>();
s.AddScoped<ICrudService<DesignationRequest, DesignationDto>, DesignationService>();
s.AddScoped<ICrudService<JobGradeRequest, JobGradeDto>, JobGradeService>();
s.AddScoped<ICrudService<LocationRequest, LocationDto>, LocationService>();
s.AddScoped<IStructureService, StructureService>();
s.AddHrClient<IEmployeeClient, EmployeeClient>(builder.Configuration["Services:Employee"] ?? "http://localhost:32102");
s.AddEmployeeReadModel<OrgEmployeeReadModel>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.OrganizationService");
await app.RunHrAsync<OrganizationDbContext>(["organizations", "business_units", "departments", "designations", "job_grades", "locations", "org_employee_nodes", "reporting_lines", "audit_history"]);
