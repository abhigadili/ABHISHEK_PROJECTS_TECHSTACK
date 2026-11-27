using HR.Common.Crud;
using HR.Common.Hosting;
using HR.Common.Http;
using HR.PayrollService.Clients;
using HR.PayrollService.Data;
using HR.PayrollService.DTOs;
using HR.PayrollService.Engine;
using HR.PayrollService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddHrService<PayrollDbContext>("HR.PayrollService", "hr_payroll_db", 32107);
var s = builder.Services;
var cfg = builder.Configuration;
// calculation strategies (Strategy pattern) discovered by the engine through DI
s.AddSingleton<IEarningStrategy, PercentOfCtcStrategy>(); s.AddSingleton<IEarningStrategy, PercentOfBasicStrategy>(); s.AddSingleton<IEarningStrategy, FixedStrategy>();
s.AddSingleton<IDeductionStrategy, StatutoryPfStrategy>(); s.AddSingleton<IDeductionStrategy, SlabPtStrategy>(); s.AddSingleton<IDeductionStrategy, TaxTdsStrategy>();
s.AddSingleton<IDeductionStrategy, VariableDeductionStrategy>(); s.AddSingleton<IDeductionStrategy, FixedDeductionStrategy>();
s.AddSingleton<ISalaryEngine, SalaryEngine>();
s.AddScoped<ISalaryService, SalaryService>();
s.AddScoped<IAdjustmentService, AdjustmentService>();
s.AddScoped<IPayslipService, PayslipService>();
s.AddScoped<IPayrollRunService, PayrollRunService>();
s.AddScoped<ICrudService<SalaryComponentRequest, SalaryComponentDto>, SalaryComponentService>();
s.AddHrClient<IEmployeeClient, EmployeeClient>(cfg["Services:Employee"] ?? "http://localhost:32102", 10);
s.AddHrClient<IAttendanceClient, AttendanceClient>(cfg["Services:Attendance"] ?? "http://localhost:32105", 20);
s.AddHrClient<ILeaveClient, LeaveClient>(cfg["Services:Leave"] ?? "http://localhost:32104");
s.AddHrClient<ITaxClient, TaxClient>(cfg["Services:Tax"] ?? "http://localhost:32108");

var app = builder.Build();
app.UseHrPipeline();
app.MapHrBasics("HR.PayrollService");
await app.RunHrAsync<PayrollDbContext>(["employee_salaries", "loan_deductions", "loans", "payroll_adjustments", "payroll_config", "payroll_entries", "payroll_entry_lines", "payroll_runs", "payslips", "salary_components", "salary_revision_history", "salary_revisions", "salary_structure_components", "salary_structures", "audit_history"]);
