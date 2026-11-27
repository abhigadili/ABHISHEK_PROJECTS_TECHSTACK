using HR.Common.Hosting;
using HR.Common.Messaging;
using HR.PerformanceService.Data;
using HR.PerformanceService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<PerformanceDbContext>("HR.PerformanceService", "hr_performance_db", 32109);
var s = builder.Services;
s.AddScoped<IReviewService, ReviewService>();
s.AddScoped<IGoalService, GoalService>();
s.AddEmployeeReadModel<PerfEmployeeReadModel>();

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.PerformanceService");
await app.RunHrAsync<PerformanceDbContext>(["evaluation_forms", "form_questions", "review_cycles", "performance_reviews", "review_answers", "review_history", "goals", "key_results", "feedback", "perf_employees", "audit_history"]);
