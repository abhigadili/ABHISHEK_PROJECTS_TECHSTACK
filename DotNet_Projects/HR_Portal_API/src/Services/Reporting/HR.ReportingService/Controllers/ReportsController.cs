using Asp.Versioning;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.ReportingService.DTOs;
using HR.ReportingService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.ReportingService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/reports")]
[Authorize]
[HasPermission(Perm.ReportView)]
public sealed class ReportsController(IReportingService reports) : HrControllerBase
{
    [HttpGet("summary")] public async Task<ActionResult<SummaryDto>> Summary(CancellationToken ct) => Ok(await reports.SummaryAsync(ct));
    [HttpGet("headcount")] public async Task<ActionResult<HeadcountReportDto>> Headcount([FromQuery] PeriodQuery q, CancellationToken ct) => Ok(await reports.HeadcountAsync(q, ct));
    [HttpGet("leave")] public async Task<ActionResult<LeaveReportDto>> Leave([FromQuery] PeriodQuery q, CancellationToken ct) => Ok(await reports.LeaveAsync(q, ct));
    [HttpGet("attendance")] public async Task<ActionResult<AttendanceReportDto>> Attendance([FromQuery] MonthQuery q, CancellationToken ct) => Ok(await reports.AttendanceAsync(q.Month, ct));
    [HttpGet("payroll")] public async Task<IActionResult> Payroll([FromQuery] MonthQuery q, CancellationToken ct) => Ok(await reports.PayrollAsync(q.Month, ct));
    [HttpGet("tax")] public async Task<ActionResult<TaxReportDto>> Tax([FromQuery] FyQuery q, CancellationToken ct) => Ok(await reports.TaxAsync(q.Fy, ct));
    [HttpGet("projects")] public async Task<ActionResult<ProjectReportDto>> Projects([FromQuery] ProjectReportQuery q, CancellationToken ct) => Ok(await reports.ProjectsAsync(q.Status, ct));
    [HttpGet("timesheets")] public async Task<ActionResult<TimesheetReportDto>> Timesheets([FromQuery] PeriodQuery q, CancellationToken ct) => Ok(await reports.TimesheetsAsync(q, ct));
    [HttpGet("performance")] public async Task<ActionResult<PerformanceReportDto>> Performance([FromQuery] CycleQuery q, CancellationToken ct) => Ok(await reports.PerformanceAsync(q.CycleId, ct));
    [HttpGet("exits")] public async Task<ActionResult<ExitReportDto>> Exits([FromQuery] PeriodQuery q, CancellationToken ct) => Ok(await reports.ExitsAsync(q, ct));

    /// <summary>Streams a CSV straight from the database cursor to the response (no buffering of the whole result).</summary>
    [HttpGet("export/{report}.csv")]
    public async Task Export(string report, CancellationToken ct)
    {
        var (lines, fileName) = await reports.ExportAsync(report, ct);
        Response.ContentType = "text/csv; charset=utf-8";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        await foreach (var line in lines.WithCancellation(ct)) await Response.WriteAsync(line, ct);
    }
}
