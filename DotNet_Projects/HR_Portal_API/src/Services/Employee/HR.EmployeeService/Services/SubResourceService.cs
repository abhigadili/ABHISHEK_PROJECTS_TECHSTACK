using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Security;
using HR.Common.Util;
using HR.EmployeeService.Data;
using HR.EmployeeService.DTOs;
using HR.EmployeeService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.EmployeeService.Services;

/// <summary>Addresses, emergency contacts, education, experience and bank details of an employee. Bank details are encrypted at rest and masked on read.</summary>
public interface ISubResourceService
{
    Task<List<TDto>> ListAsync<TDto>(string employeeId, CancellationToken ct);
    Task<TDto> AddAsync<TReq, TDto>(string employeeId, TReq req, CancellationToken ct);
    Task<TDto> UpdateAsync<TReq, TDto>(string employeeId, string subId, TReq req, CancellationToken ct);
    Task DeleteAsync<TDto>(string employeeId, string subId, CancellationToken ct);
}

public sealed class SubResourceService(EmployeeDbContext db, ICurrentUser user, IFieldCrypto crypto, IAuditWriter audit, ICacheService cache) : ISubResourceService
{
    private async Task<Employee> LoadEmployeeAsync(string id, CancellationToken ct) =>
        await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, ct) ?? throw new NotFoundException("Employee not found");

    private void AssertCanView(Employee e, bool bank)
    {
        var self = user.EmployeeId == e.Id;
        var ok = bank ? self || user.HasAnyPermission(Perm.EmployeeWrite, Perm.PayrollView)
                      : self || e.ManagerId == user.EmployeeId || user.HasAnyPermission(Perm.EmployeeRead, Perm.EmployeeWrite);
        if (!ok && !user.IsSuperAdmin) throw new ForbiddenException();
    }

    private void AssertCanEdit(string employeeId)
    {
        if (!(user.HasPermission(Perm.EmployeeWrite) || user.IsSuperAdmin || user.EmployeeId == employeeId)) throw new ForbiddenException("You may only edit your own records");
    }

    public async Task<List<TDto>> ListAsync<TDto>(string employeeId, CancellationToken ct)
    {
        var emp = await LoadEmployeeAsync(employeeId, ct);
        AssertCanView(emp, typeof(TDto) == typeof(BankDetailDto));
        object list = typeof(TDto).Name switch
        {
            nameof(AddressDto) => (await db.EmployeeAddresses.AsNoTracking().Where(x => x.EmployeeId == employeeId).OrderBy(x => x.CreatedAt).ToListAsync(ct)).Adapt<List<AddressDto>>(),
            nameof(EmergencyContactDto) => (await db.EmergencyContacts.AsNoTracking().Where(x => x.EmployeeId == employeeId).OrderBy(x => x.CreatedAt).ToListAsync(ct)).Adapt<List<EmergencyContactDto>>(),
            nameof(EducationDto) => (await db.EmployeeEducations.AsNoTracking().Where(x => x.EmployeeId == employeeId).OrderBy(x => x.CreatedAt).ToListAsync(ct)).Adapt<List<EducationDto>>(),
            nameof(ExperienceDto) => (await db.EmployeeExperiences.AsNoTracking().Where(x => x.EmployeeId == employeeId).OrderBy(x => x.StartDate).ToListAsync(ct)).Adapt<List<ExperienceDto>>(),
            nameof(BankDetailDto) => (await db.EmployeeBankDetails.AsNoTracking().Where(x => x.EmployeeId == employeeId).OrderBy(x => x.CreatedAt).ToListAsync(ct)).Select(ToBankDto).ToList(),
            _ => throw new InvalidOperationException()
        };
        return (List<TDto>)list;
    }

    public async Task<TDto> AddAsync<TReq, TDto>(string employeeId, TReq req, CancellationToken ct)
    {
        AssertCanEdit(employeeId);
        await LoadEmployeeAsync(employeeId, ct);
        object dto;
        string kind;
        switch (req)
        {
            case AddressRequest a: { var e = a.Adapt<EmployeeAddress>(); e.EmployeeId = employeeId; db.EmployeeAddresses.Add(e); await db.SaveChangesAsync(ct); dto = e.Adapt<AddressDto>(); kind = "ADDRESS"; break; }
            case EmergencyContactRequest c: { var e = c.Adapt<EmergencyContact>(); e.EmployeeId = employeeId; db.EmergencyContacts.Add(e); await db.SaveChangesAsync(ct); dto = e.Adapt<EmergencyContactDto>(); kind = "EMERGENCY_CONTACT"; break; }
            case EducationRequest ed: { var e = ed.Adapt<EmployeeEducation>(); e.EmployeeId = employeeId; db.EmployeeEducations.Add(e); await db.SaveChangesAsync(ct); dto = e.Adapt<EducationDto>(); kind = "EDUCATION"; break; }
            case ExperienceRequest x: { var e = x.Adapt<EmployeeExperience>(); e.EmployeeId = employeeId; db.EmployeeExperiences.Add(e); await db.SaveChangesAsync(ct); dto = e.Adapt<ExperienceDto>(); kind = "EXPERIENCE"; break; }
            case BankDetailRequest b:
            {
                var e = b.Adapt<EmployeeBankDetail>(); e.EmployeeId = employeeId; e.AccountNumber = crypto.Encrypt(b.AccountNumber); e.IfscCode = b.IfscCode is null ? null : crypto.Encrypt(b.IfscCode);
                db.EmployeeBankDetails.Add(e); await db.SaveChangesAsync(ct); dto = ToBankDto(e); kind = "BANK_DETAIL"; break;
            }
            default: throw new InvalidOperationException();
        }
        await audit.WriteAsync("Employee", employeeId, kind + "_ADDED");
        await cache.EvictPrefixAsync(CacheKeys.EmployeePrefix);
        return (TDto)dto;
    }

    public async Task<TDto> UpdateAsync<TReq, TDto>(string employeeId, string subId, TReq req, CancellationToken ct)
    {
        AssertCanEdit(employeeId);
        object dto;
        string kind;
        switch (req)
        {
            case AddressRequest a: { var e = await db.EmployeeAddresses.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct) ?? throw Missing(); a.Adapt(e); await db.SaveChangesAsync(ct); dto = e.Adapt<AddressDto>(); kind = "ADDRESS"; break; }
            case EmergencyContactRequest c: { var e = await db.EmergencyContacts.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct) ?? throw Missing(); c.Adapt(e); await db.SaveChangesAsync(ct); dto = e.Adapt<EmergencyContactDto>(); kind = "EMERGENCY_CONTACT"; break; }
            case EducationRequest ed: { var e = await db.EmployeeEducations.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct) ?? throw Missing(); ed.Adapt(e); await db.SaveChangesAsync(ct); dto = e.Adapt<EducationDto>(); kind = "EDUCATION"; break; }
            case ExperienceRequest x: { var e = await db.EmployeeExperiences.FirstOrDefaultAsync(r => r.Id == subId && r.EmployeeId == employeeId, ct) ?? throw Missing(); x.Adapt(e); await db.SaveChangesAsync(ct); dto = e.Adapt<ExperienceDto>(); kind = "EXPERIENCE"; break; }
            case BankDetailRequest b:
            {
                var e = await db.EmployeeBankDetails.FirstOrDefaultAsync(r => r.Id == subId && r.EmployeeId == employeeId, ct) ?? throw Missing();
                b.Adapt(e); e.AccountNumber = crypto.Encrypt(b.AccountNumber); e.IfscCode = b.IfscCode is null ? null : crypto.Encrypt(b.IfscCode);
                await db.SaveChangesAsync(ct); dto = ToBankDto(e); kind = "BANK_DETAIL"; break;
            }
            default: throw new InvalidOperationException();
        }
        await audit.WriteAsync("Employee", employeeId, kind + "_UPDATED", null, new { id = subId });
        await cache.EvictPrefixAsync(CacheKeys.EmployeePrefix);
        return (TDto)dto;
    }

    public async Task DeleteAsync<TDto>(string employeeId, string subId, CancellationToken ct)
    {
        AssertCanEdit(employeeId);
        object? entity = typeof(TDto).Name switch
        {
            nameof(AddressDto) => await db.EmployeeAddresses.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct),
            nameof(EmergencyContactDto) => await db.EmergencyContacts.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct),
            nameof(EducationDto) => await db.EmployeeEducations.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct),
            nameof(ExperienceDto) => await db.EmployeeExperiences.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct),
            nameof(BankDetailDto) => await db.EmployeeBankDetails.FirstOrDefaultAsync(x => x.Id == subId && x.EmployeeId == employeeId, ct),
            _ => null
        };
        if (entity is null) throw Missing();
        db.Remove(entity);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Employee", employeeId, typeof(TDto).Name.Replace("Dto", "").ToUpperInvariant() + "_REMOVED", new { id = subId });
        await cache.EvictPrefixAsync(CacheKeys.EmployeePrefix);
    }

    private static NotFoundException Missing() => new("Record not found for this employee");

    private BankDetailDto ToBankDto(EmployeeBankDetail e) => new(e.Id, e.AccountHolderName, e.BankName, MaskAccount(crypto.Reveal(e.AccountNumber)), MaskIfsc(crypto.Reveal(e.IfscCode)), e.Branch, e.AccountType);
    private static string MaskAccount(string? v) => v is "[protected]" ? v : IFieldCrypto.Mask(v);
    private static string? MaskIfsc(string? v) => v is null or "[protected]" ? v : v.Length > 4 ? v[..4] + new string('*', v.Length - 4) : v;
}
