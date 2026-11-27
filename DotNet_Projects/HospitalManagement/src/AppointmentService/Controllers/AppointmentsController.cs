using HMS.Appointments.Dtos;
using HMS.Appointments.Services;
using HMS.Shared.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Appointments.Controllers;

[ApiController, Authorize, Route("api/appointments")]
public sealed class AppointmentsController(IAppointmentAppService service) : ControllerBase
{
    [HttpGet("availability")]
    public Task<List<SlotView>> Availability([FromQuery] long doctorId, [FromQuery] DateOnly date, CancellationToken ct) => service.AvailabilityAsync(doctorId, date, ct);

    [HttpPost, Authorize(Roles = "ADMIN,PATIENT")]
    public async Task<IActionResult> Book([FromBody] BookRequest r, CancellationToken ct) => StatusCode(201, await service.BookAsync(r, ct));

    [HttpGet("{id:long}")]
    public Task<AppointmentResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpGet("my"), Authorize(Roles = "PATIENT")]
    public Task<List<AppointmentResponse>> Mine(CancellationToken ct) => service.MineAsync(ct);

    [HttpGet("patient/{patientId:long}")]
    public Task<List<AppointmentResponse>> ForPatient(long patientId, CancellationToken ct) => service.ForPatientAsync(patientId, ct);

    [HttpGet("doctor/{doctorId:long}"), Authorize(Roles = "ADMIN,DOCTOR")]
    public Task<List<AppointmentResponse>> ForDoctor(long doctorId, [FromQuery] DateOnly? date, CancellationToken ct) => service.ForDoctorAsync(doctorId, date, ct);

    [HttpPut("{id:long}/reschedule"), Authorize(Roles = "ADMIN,DOCTOR,PATIENT")]
    public Task<AppointmentResponse> Reschedule(long id, [FromBody] RescheduleRequest r, CancellationToken ct) => service.RescheduleAsync(id, r, ct);

    [HttpPut("{id:long}/cancel"), Authorize(Roles = "ADMIN,DOCTOR,PATIENT")]
    public Task<AppointmentResponse> Cancel(long id, [FromBody] CancelRequest? r, CancellationToken ct) => service.CancelAsync(id, r?.Reason, ct);

    [HttpPut("{id:long}/complete"), Authorize(Roles = "ADMIN,DOCTOR")]
    public Task<AppointmentResponse> Complete(long id, [FromBody] CompleteRequest? r, CancellationToken ct) => service.CompleteAsync(id, r?.Notes, ct);
}
