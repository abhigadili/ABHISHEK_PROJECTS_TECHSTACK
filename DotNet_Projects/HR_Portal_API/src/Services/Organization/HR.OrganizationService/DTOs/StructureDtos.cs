using System.ComponentModel.DataAnnotations;

namespace HR.OrganizationService.DTOs;

public sealed class TreeNode
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Type { get; set; } = "";
    public string? Code { get; set; }
    public string? DesignationId { get; set; }
    public string? Status { get; set; }
    public int EmployeeCount { get; set; }
    public List<TreeNode> Children { get; set; } = [];
}

public sealed class ChartQuery { public string Type { get; set; } = "reporting"; public string? RootId { get; set; } [Range(1, 20)] public int Depth { get; set; } = 6; }

public sealed record EmployeeNodeDto(string EmployeeId, string? EmployeeCode, string FullName, string? DepartmentId, string? DesignationId, string? LocationId, string? ManagerId, string Status, DateOnly? JoiningDate);
public sealed record ChainEntryDto(int Level, string EmployeeId, string FullName, string? EmployeeCode, string? DesignationId);
public sealed record EmployeeDetailsDto(string EmployeeId, string? EmployeeCode, string FullName, string Status, DateOnly? JoiningDate, string? DepartmentName, string? DepartmentCode, string? DesignationTitle, string? JobGradeName, string? LocationName, string? ManagerId);
public sealed record ReportingLineDto(string Id, string EmployeeId, string? ManagerId, DateTime EffectiveFrom, DateTime? EffectiveTo);
public sealed record AssignManagerRequest([StringLength(36, MinimumLength = 36)] string? ManagerId, DateOnly? EffectiveFrom);
public sealed record ManagerAssignmentDto(string EmployeeId, string? ManagerId, DateOnly EffectiveFrom);
public sealed record DepartmentEmployeesDto(string DepartmentId, string DepartmentName, long Total, List<EmployeeNodeDto> Employees);
public sealed record EmployeeManagerRef(string Id, long Version);
