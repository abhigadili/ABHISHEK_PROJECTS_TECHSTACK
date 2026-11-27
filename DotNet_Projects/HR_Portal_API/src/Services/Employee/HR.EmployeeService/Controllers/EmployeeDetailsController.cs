using Asp.Versioning;
using HR.Common.Hosting;
using HR.EmployeeService.DTOs;
using HR.EmployeeService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.EmployeeService.Controllers;

/// <summary>Personal sub-resources of an employee: addresses, emergency contacts, education, experience, bank details.</summary>
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/employees/{employeeId}")]
[Authorize]
public sealed class EmployeeDetailsController(ISubResourceService sub) : HrControllerBase
{
    [HttpGet("addresses")] public async Task<ActionResult<List<AddressDto>>> Addresses(string employeeId, CancellationToken ct) => Ok(await sub.ListAsync<AddressDto>(employeeId, ct));
    [HttpPost("addresses")] public async Task<IActionResult> AddAddress(string employeeId, AddressRequest r, CancellationToken ct) => StatusCode(201, await sub.AddAsync<AddressRequest, AddressDto>(employeeId, r, ct));
    [HttpPut("addresses/{id}")] public async Task<ActionResult<AddressDto>> PutAddress(string employeeId, string id, AddressRequest r, CancellationToken ct) => Ok(await sub.UpdateAsync<AddressRequest, AddressDto>(employeeId, id, r, ct));
    [HttpDelete("addresses/{id}")] public async Task<IActionResult> DelAddress(string employeeId, string id, CancellationToken ct) { await sub.DeleteAsync<AddressDto>(employeeId, id, ct); return NoContent(); }

    [HttpGet("emergency-contacts")] public async Task<ActionResult<List<EmergencyContactDto>>> Contacts(string employeeId, CancellationToken ct) => Ok(await sub.ListAsync<EmergencyContactDto>(employeeId, ct));
    [HttpPost("emergency-contacts")] public async Task<IActionResult> AddContact(string employeeId, EmergencyContactRequest r, CancellationToken ct) => StatusCode(201, await sub.AddAsync<EmergencyContactRequest, EmergencyContactDto>(employeeId, r, ct));
    [HttpPut("emergency-contacts/{id}")] public async Task<ActionResult<EmergencyContactDto>> PutContact(string employeeId, string id, EmergencyContactRequest r, CancellationToken ct) => Ok(await sub.UpdateAsync<EmergencyContactRequest, EmergencyContactDto>(employeeId, id, r, ct));
    [HttpDelete("emergency-contacts/{id}")] public async Task<IActionResult> DelContact(string employeeId, string id, CancellationToken ct) { await sub.DeleteAsync<EmergencyContactDto>(employeeId, id, ct); return NoContent(); }

    [HttpGet("education")] public async Task<ActionResult<List<EducationDto>>> Education(string employeeId, CancellationToken ct) => Ok(await sub.ListAsync<EducationDto>(employeeId, ct));
    [HttpPost("education")] public async Task<IActionResult> AddEducation(string employeeId, EducationRequest r, CancellationToken ct) => StatusCode(201, await sub.AddAsync<EducationRequest, EducationDto>(employeeId, r, ct));
    [HttpPut("education/{id}")] public async Task<ActionResult<EducationDto>> PutEducation(string employeeId, string id, EducationRequest r, CancellationToken ct) => Ok(await sub.UpdateAsync<EducationRequest, EducationDto>(employeeId, id, r, ct));
    [HttpDelete("education/{id}")] public async Task<IActionResult> DelEducation(string employeeId, string id, CancellationToken ct) { await sub.DeleteAsync<EducationDto>(employeeId, id, ct); return NoContent(); }

    [HttpGet("experience")] public async Task<ActionResult<List<ExperienceDto>>> Experience(string employeeId, CancellationToken ct) => Ok(await sub.ListAsync<ExperienceDto>(employeeId, ct));
    [HttpPost("experience")] public async Task<IActionResult> AddExperience(string employeeId, ExperienceRequest r, CancellationToken ct) => StatusCode(201, await sub.AddAsync<ExperienceRequest, ExperienceDto>(employeeId, r, ct));
    [HttpPut("experience/{id}")] public async Task<ActionResult<ExperienceDto>> PutExperience(string employeeId, string id, ExperienceRequest r, CancellationToken ct) => Ok(await sub.UpdateAsync<ExperienceRequest, ExperienceDto>(employeeId, id, r, ct));
    [HttpDelete("experience/{id}")] public async Task<IActionResult> DelExperience(string employeeId, string id, CancellationToken ct) { await sub.DeleteAsync<ExperienceDto>(employeeId, id, ct); return NoContent(); }

    [HttpGet("bank-details")] public async Task<ActionResult<List<BankDetailDto>>> Bank(string employeeId, CancellationToken ct) => Ok(await sub.ListAsync<BankDetailDto>(employeeId, ct));
    [HttpPost("bank-details")] public async Task<IActionResult> AddBank(string employeeId, BankDetailRequest r, CancellationToken ct) => StatusCode(201, await sub.AddAsync<BankDetailRequest, BankDetailDto>(employeeId, r, ct));
    [HttpPut("bank-details/{id}")] public async Task<ActionResult<BankDetailDto>> PutBank(string employeeId, string id, BankDetailRequest r, CancellationToken ct) => Ok(await sub.UpdateAsync<BankDetailRequest, BankDetailDto>(employeeId, id, r, ct));
    [HttpDelete("bank-details/{id}")] public async Task<IActionResult> DelBank(string employeeId, string id, CancellationToken ct) { await sub.DeleteAsync<BankDetailDto>(employeeId, id, ct); return NoContent(); }
}
