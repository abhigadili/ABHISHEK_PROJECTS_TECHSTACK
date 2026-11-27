using Asp.Versioning;
using HR.Common.Crud;
using HR.Common.Security;
using HR.OrganizationService.DTOs;

namespace HR.OrganizationService.Controllers;

[ApiVersion("1.0"), Microsoft.AspNetCore.Mvc.Route("api/v{version:apiVersion}/organization/organizations")]
public sealed class OrganizationsController(ICrudService<OrganizationRequest, OrganizationDto> s, ICurrentUser u) : CrudController<OrganizationRequest, OrganizationDto>(s, u)
{ protected override string[] WritePermissions => [Perm.OrgManage]; }

[ApiVersion("1.0"), Microsoft.AspNetCore.Mvc.Route("api/v{version:apiVersion}/organization/business-units")]
public sealed class BusinessUnitsController(ICrudService<BusinessUnitRequest, BusinessUnitDto> s, ICurrentUser u) : CrudController<BusinessUnitRequest, BusinessUnitDto>(s, u)
{ protected override string[] WritePermissions => [Perm.OrgManage]; }

[ApiVersion("1.0"), Microsoft.AspNetCore.Mvc.Route("api/v{version:apiVersion}/organization/departments")]
public sealed class DepartmentsController(ICrudService<DepartmentRequest, DepartmentDto> s, ICurrentUser u) : CrudController<DepartmentRequest, DepartmentDto>(s, u)
{ protected override string[] WritePermissions => [Perm.OrgManage]; }

[ApiVersion("1.0"), Microsoft.AspNetCore.Mvc.Route("api/v{version:apiVersion}/organization/designations")]
public sealed class DesignationsController(ICrudService<DesignationRequest, DesignationDto> s, ICurrentUser u) : CrudController<DesignationRequest, DesignationDto>(s, u)
{ protected override string[] WritePermissions => [Perm.OrgManage]; }

[ApiVersion("1.0"), Microsoft.AspNetCore.Mvc.Route("api/v{version:apiVersion}/organization/job-grades")]
public sealed class JobGradesController(ICrudService<JobGradeRequest, JobGradeDto> s, ICurrentUser u) : CrudController<JobGradeRequest, JobGradeDto>(s, u)
{ protected override string[] WritePermissions => [Perm.OrgManage]; }

[ApiVersion("1.0"), Microsoft.AspNetCore.Mvc.Route("api/v{version:apiVersion}/organization/locations")]
public sealed class LocationsController(ICrudService<LocationRequest, LocationDto> s, ICurrentUser u) : CrudController<LocationRequest, LocationDto>(s, u)
{ protected override string[] WritePermissions => [Perm.OrgManage]; }
