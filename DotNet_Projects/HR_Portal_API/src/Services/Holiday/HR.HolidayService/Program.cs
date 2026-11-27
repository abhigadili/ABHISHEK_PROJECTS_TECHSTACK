using HR.Common.Hosting;
using HR.HolidayService.Data;
using HR.HolidayService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<HolidayDbContext>("HR.HolidayService", "hr_holiday_db", 32106, kafka: false);
builder.Services.AddScoped<IHolidayService, HolidayService>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.HolidayService");
await app.RunHrAsync<HolidayDbContext>(["holidays", "holiday_scopes", "holiday_years", "audit_history"]);
