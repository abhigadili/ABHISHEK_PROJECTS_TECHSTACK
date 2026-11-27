using HR.Common.Hosting;
using HR.Common.Http;
using HR.Common.Messaging;
using HR.TaxService.Clients;
using HR.TaxService.Consumers;
using HR.TaxService.Data;
using HR.TaxService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<TaxDbContext>("HR.TaxService", "hr_tax_db", 32108);
var s = builder.Services;
s.AddScoped<IComputationService, ComputationService>();
s.AddScoped<IDeclarationService, DeclarationService>();
s.AddHrClient<IPayrollClient, PayrollClient>(builder.Configuration["Services:Payroll"] ?? "http://localhost:32107");
s.AddEmployeeReadModel<TaxEmployeeReadModel>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.TaxService");
await app.RunHrAsync<TaxDbContext>(["tax_declarations", "investment_declarations", "tax_proofs", "tax_declaration_history", "tax_rules", "tax_computations", "monthly_tds", "tax_documents", "tax_employees", "audit_history"]);
