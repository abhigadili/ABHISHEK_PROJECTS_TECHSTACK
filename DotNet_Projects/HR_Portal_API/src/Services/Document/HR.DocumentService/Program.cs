using HR.Common.Hosting;
using HR.DocumentService.Data;
using HR.DocumentService.Jobs;
using HR.DocumentService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<DocumentDbContext>("HR.DocumentService", "hr_document_db", 32113);
builder.Services.AddScoped<IDocumentService, DocumentService>();
builder.Services.AddEventHandler<PayslipGeneratedHandler>();
builder.Services.AddHostedService<ExpiryReminderJob>();
builder.Services.AddHostedService<CategorySeeder>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.DocumentService");
await app.RunHrAsync<DocumentDbContext>(["documents", "document_categories", "document_history", "document_permissions", "audit_history"]);
