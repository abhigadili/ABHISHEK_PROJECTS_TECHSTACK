using HMS.Laboratory.Domain;
using HMS.Laboratory.Dtos;
using HMS.Laboratory.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Laboratory.Controllers;

[ApiController, Authorize, Route("api/lab")]
public sealed class LabController(ILabAppService service) : ControllerBase
{
    [HttpGet("tests")]
    public Task<List<TestResponse>> Catalogue(CancellationToken ct) => service.CatalogueAsync(ct);

    [HttpPost("tests"), Authorize(Roles = "ADMIN,LAB_STAFF")]
    public async Task<IActionResult> AddTest([FromBody] TestRequest r, CancellationToken ct) => StatusCode(201, await service.AddTestAsync(r, ct));

    [HttpPost("requests"), Authorize(Roles = "ADMIN,DOCTOR")]
    public async Task<IActionResult> Request([FromBody] LabRequestCreate r, CancellationToken ct) => StatusCode(201, await service.RequestAsync(r, ct));

    [HttpGet("requests"), Authorize(Roles = "ADMIN,DOCTOR,LAB_STAFF")]
    public Task<PageResponse<LabRequestResponse>> Queue([FromQuery] LabStatus? status, [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default) => service.QueueAsync(status, page, size, ct);

    [HttpGet("requests/{id:long}")]
    public Task<LabRequestResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpGet("requests/patient/{patientId:long}")]
    public Task<List<LabRequestResponse>> ForPatient(long patientId, CancellationToken ct) => service.ForPatientAsync(patientId, ct);

    [HttpPut("requests/{id:long}/status"), Authorize(Roles = "ADMIN,LAB_STAFF")]
    public Task<LabRequestResponse> Status(long id, [FromBody] StatusUpdate r, CancellationToken ct) => service.UpdateStatusAsync(id, r.Status!.Value, ct);

    [HttpPut("requests/{id:long}/cancel"), Authorize(Roles = "ADMIN,DOCTOR,LAB_STAFF")]
    public Task<LabRequestResponse> Cancel(long id, CancellationToken ct) => service.CancelAsync(id, ct);

    [HttpPost("requests/{id:long}/report"), Authorize(Roles = "ADMIN,LAB_STAFF")]
    public async Task<IActionResult> SubmitReport(long id, [FromBody] ReportRequest r, CancellationToken ct) => StatusCode(201, await service.SubmitReportAsync(id, r, ct));

    [HttpGet("requests/{id:long}/report")]
    public Task<ReportResponse> Report(long id, CancellationToken ct) => service.ReportAsync(id, ct);
}
