using HR.Common.Messaging;
using HR.EmployeeService.DTOs;
using HR.EmployeeService.Entities;
using Mapster;

namespace HR.EmployeeService.Mapping;

/// <summary>Mapster profiles: entity -> response DTO, request -> entity (partial update ignores nulls), nested/collection mapping.</summary>
public static class EmployeeMapping
{
    public static void Register()
    {
        TypeAdapterConfig<Employee, EmployeeProfileDto>.NewConfig()
            .Map(d => d.FullName, s => s.FirstName + " " + s.LastName)
            .Ignore(d => d.NationalId, d => d.PanNumber, d => d.TenureMonths, d => d.Department, d => d.Designation, d => d.Location, d => d.Manager);
        TypeAdapterConfig<Employee, EmployeeSummaryDto>.NewConfig()
            .Map(d => d.EmployeeId, s => s.Id).Map(d => d.FullName, s => s.FirstName + " " + s.LastName).Map(d => d.JoiningDate, s => (DateOnly?)s.JoiningDate);
        TypeAdapterConfig<OnboardEmployeeRequest, Employee>.NewConfig()
            .Ignore(d => d.NationalId, d => d.PanNumber)   // encrypted by the service
            .Map(d => d.JoiningDate, s => s.JoiningDate!.Value);
        TypeAdapterConfig<UpdateEmployeeRequest, Employee>.NewConfig()
            .IgnoreNullValues(true).Ignore(d => d.Version, d => d.NationalId, d => d.PanNumber);   // partial update mapping
        TypeAdapterConfig<AddressRequest, EmployeeAddress>.NewConfig().Map(d => d.IsPrimary, s => s.Primary);
        TypeAdapterConfig<EmployeeAddress, AddressDto>.NewConfig().Map(d => d.Primary, s => s.IsPrimary);
        TypeAdapterConfig<EmergencyContactRequest, EmergencyContact>.NewConfig().Map(d => d.IsPrimary, s => s.Primary);
        TypeAdapterConfig<EmergencyContact, EmergencyContactDto>.NewConfig().Map(d => d.Primary, s => s.IsPrimary);
        TypeAdapterConfig<ExperienceRequest, EmployeeExperience>.NewConfig().Map(d => d.StartDate, s => s.StartDate!.Value);
    }

    public static EmployeeEvent ToEvent(Employee e, string changeType) => new(e.Id, e.EmployeeCode, $"{e.FirstName} {e.LastName}".Trim(), e.WorkEmail, e.DepartmentId, e.DesignationId, e.LocationId,
        e.ManagerId, e.Status, e.JoiningDate, e.ExitDate, e.Gender, changeType);
}
