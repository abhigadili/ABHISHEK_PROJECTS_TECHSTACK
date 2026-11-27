using FluentValidation;
using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Extensions;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.CourseService.Kafka.Producers;
using StudentMgmt.CourseService.Persistence;
using StudentMgmt.CourseService.Services;
using StudentMgmt.CourseService.Services.Interfaces;
using StudentMgmt.CourseService.UnitOfWork;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseAppSerilog("CourseService");

builder.Services.AddControllers();
builder.Services.AddAppApiVersioning();
builder.Services.AddAppSwagger("Course Service API");
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddKafkaMessaging(builder.Configuration);
builder.Services.AddSharedCommonServices();
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<CourseDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));
builder.Services.AddAppHealthChecks(connectionString, builder.Configuration["Kafka:BootstrapServers"]!);

builder.Services.AddScoped<ICourseUnitOfWork, CourseUnitOfWork>();
builder.Services.AddScoped<ICourseAppService, CourseAppService>();
builder.Services.AddScoped<CourseEventPublisher>();

var app = builder.Build();

app.UseSharedMiddlewares();
app.UseCors(StudentMgmt.BuildingBlocks.Common.Extensions.CorsServiceExtensions.PolicyName);
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CourseDbContext>();
    db.Database.Migrate();
}

app.Run();
