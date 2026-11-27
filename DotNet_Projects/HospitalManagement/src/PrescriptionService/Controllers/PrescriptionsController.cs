using HMS.Prescriptions.Dtos;
using HMS.Prescriptions.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Prescriptions.Controllers;

[ApiController, Authorize, Route("api/prescriptions")]
public sealed class PrescriptionsController(IPrescriptionAppService service) : ControllerBase
{
    [HttpPost, Authorize(Roles = "ADMIN,DOCTOR")]
    public async Task<IActionResult> Create([FromBody] PrescriptionRequest r, CancellationToken ct) => StatusCode(201, await service.CreateAsync(r, ct));

    [HttpGet("{id:long}")]
    public Task<PrescriptionResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpGet("{id:long}/status")]
    public Task<StatusResponse> Status(long id, CancellationToken ct) => service.StatusAsync(id, ct);

    [HttpGet("patient/{patientId:long}"), Authorize(Roles = "ADMIN,DOCTOR,PATIENT,PHARMACIST")]
    public Task<List<PrescriptionResponse>> ForPatient(long patientId, CancellationToken ct) => service.ForPatientAsync(patientId, ct);

    [HttpGet("doctor/{doctorId:long}"), Authorize(Roles = "ADMIN,DOCTOR")]
    public Task<List<PrescriptionResponse>> ForDoctor(long doctorId, CancellationToken ct) => service.ForDoctorAsync(doctorId, ct);

    [HttpPut("{id:long}/cancel"), Authorize(Roles = "ADMIN,DOCTOR")]
    public Task<StatusResponse> Cancel(long id, CancellationToken ct) => service.CancelAsync(id, ct);
}
