using HMS.Billing.Domain;
using HMS.Billing.Dtos;
using HMS.Billing.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Billing.Controllers;

[ApiController, Authorize, Route("api")]
public sealed class BillingController(IBillingAppService service) : ControllerBase
{
    [HttpPost("bills"), Authorize(Roles = "ADMIN,BILLING_STAFF")]
    public async Task<IActionResult> Create([FromBody] BillRequest r, CancellationToken ct) => StatusCode(201, await service.CreateManualAsync(r, ct));

    [HttpGet("bills"), Authorize(Roles = "ADMIN,BILLING_STAFF")]
    public Task<PageResponse<BillResponse>> List([FromQuery] BillStatus? status, [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default) => service.ListAsync(status, page, size, ct);

    [HttpGet("bills/{id:long}"), Authorize(Roles = "ADMIN,BILLING_STAFF,PATIENT")]
    public Task<BillResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpGet("bills/patient/{patientId:long}"), Authorize(Roles = "ADMIN,BILLING_STAFF,PATIENT")]
    public Task<List<BillResponse>> ForPatient(long patientId, CancellationToken ct) => service.ForPatientAsync(patientId, ct);

    [HttpPut("bills/{id:long}/cancel"), Authorize(Roles = "ADMIN,BILLING_STAFF")]
    public Task<BillResponse> Cancel(long id, CancellationToken ct) => service.CancelAsync(id, ct);

    [HttpPost("bills/{id:long}/payments"), Authorize(Roles = "ADMIN,BILLING_STAFF,PATIENT")]
    public async Task<IActionResult> Pay(long id, [FromBody] PaymentRequest r, CancellationToken ct) => StatusCode(201, await service.InitiatePaymentAsync(id, r, ct));

    [HttpGet("bills/{id:long}/payments"), Authorize(Roles = "ADMIN,BILLING_STAFF,PATIENT")]
    public Task<List<PaymentResponse>> Payments(long id, CancellationToken ct) => service.PaymentsOfAsync(id, ct);

    [HttpGet("payments/{reference}"), Authorize(Roles = "ADMIN,BILLING_STAFF,PATIENT")]
    public Task<PaymentResponse> Payment(string reference, CancellationToken ct) => service.PaymentAsync(reference, ct);

    /// <summary>Simulated gateway callback / manual confirmation of cash and insurance payments.</summary>
    [HttpPut("payments/{reference}/status"), Authorize(Roles = "ADMIN,BILLING_STAFF")]
    public Task<PaymentResponse> UpdateStatus(string reference, [FromBody] PaymentStatusUpdate u, CancellationToken ct) => service.UpdatePaymentStatusAsync(reference, u, ct);
}
