using HMS.Pharmacy.Domain;
using HMS.Pharmacy.Dtos;
using HMS.Pharmacy.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Pharmacy.Controllers;

[ApiController, Authorize, Route("api/pharmacy")]
public sealed class PharmacyController(IPharmacyAppService service) : ControllerBase
{
    [HttpGet("medicines")]
    public Task<List<MedicineResponse>> Medicines(CancellationToken ct) => service.ListMedicinesAsync(ct);

    [HttpPost("medicines"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public async Task<IActionResult> Add([FromBody] MedicineRequest r, CancellationToken ct) => StatusCode(201, await service.AddMedicineAsync(r, ct));

    [HttpPut("medicines/{id:long}"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public Task<MedicineResponse> Update(long id, [FromBody] MedicineRequest r, CancellationToken ct) => service.UpdateMedicineAsync(id, r, ct);

    [HttpPost("medicines/{id:long}/restock"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public Task<MedicineResponse> Restock(long id, [FromBody] RestockRequest r, CancellationToken ct) => service.RestockAsync(id, r.Quantity!.Value, ct);

    [HttpGet("orders"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public Task<PageResponse<OrderResponse>> Orders([FromQuery] OrderStatus? status, [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default) => service.OrdersAsync(status, page, size, ct);

    [HttpGet("orders/{id:long}"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public Task<OrderResponse> Order(long id, CancellationToken ct) => service.OrderAsync(id, ct);

    [HttpGet("orders/prescription/{prescriptionId:long}"), Authorize(Roles = "ADMIN,PHARMACIST,DOCTOR")]
    public Task<OrderResponse> ByPrescription(long prescriptionId, CancellationToken ct) => service.OrderByPrescriptionAsync(prescriptionId, ct);

    [HttpPost("orders/{id:long}/dispense"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public Task<OrderResponse> Dispense(long id, CancellationToken ct) => service.DispenseAsync(id, ct);

    [HttpPost("orders/{id:long}/reject"), Authorize(Roles = "ADMIN,PHARMACIST")]
    public Task<OrderResponse> Reject(long id, [FromBody] RejectRequest r, CancellationToken ct) => service.RejectAsync(id, r.Reason, ct);
}
