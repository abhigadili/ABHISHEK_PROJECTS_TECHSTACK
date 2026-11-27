using Common;
using Common.Security;
using CourseService.Data;
using CourseService.Repositories;
using CourseService.Services;
using Messaging;
using Microsoft.EntityFrameworkCore;
using Observability;

var builder = WebApplication.CreateBuilder(args);
builder.AddSmsObservability("course-service", MessagingTelemetry.SourceName);

var cs = builder.Configuration.GetConnectionString("CourseDb") ?? throw new InvalidOperationException("ConnectionStrings:CourseDb missing");
builder.Services.AddDbContext<CourseDbContext>(o => o.UseMySql(cs, new MySqlServerVersion(new Version(8, 0, 36)), my => my.EnableRetryOnFailure(3)));

builder.Services.AddSmsJwtAuth(builder.Configuration);
builder.Services.AddSmsRedis(builder.Configuration);
builder.Services.AddSmsRabbitMq(builder.Configuration, publisher: true);
builder.Services.AddSmsControllers();
builder.Services.AddSmsWebDefaults("Course Service API", "Course catalogue, categories, availability and seat reservation.");
builder.Services.AddScoped<ICourseRepository, CourseRepository>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<ICourseAppService, CourseAppService>();
builder.Services.AddScoped<CategoryAppService>();
builder.Services.AddScoped<ISeatService, SeatService>();
builder.Services.AddHealthChecks().AddDbContextCheck<CourseDbContext>("mysql", tags: new[] { "ready" });

var app = builder.Build();
if (builder.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<CourseDbContext>().Database.MigrateAsync();
}
app.UseSmsWebDefaults();
app.UseSmsObservability();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapSmsHealth();
app.Run();

public partial class Program { }
