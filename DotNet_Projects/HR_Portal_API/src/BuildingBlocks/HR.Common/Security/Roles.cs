namespace HR.Common.Security;

public static class Roles
{
    public const string Employee = "EMPLOYEE", Manager = "MANAGER", HrAdmin = "HR_ADMIN", PayrollAdmin = "PAYROLL_ADMIN",
        FinanceAdmin = "FINANCE_ADMIN", ProjectManager = "PROJECT_MANAGER", SuperAdmin = "SUPER_ADMIN";
    public static readonly string[] All = [Employee, Manager, HrAdmin, PayrollAdmin, FinanceAdmin, ProjectManager, SuperAdmin];
}

/// <summary>Permission codes stored in hr_auth_db.permissions; used by [Authorize(Policy = ...)] through the permission policy provider.</summary>
public static class Perm
{
    public const string SelfService = "SELF_SERVICE", TeamView = "TEAM_VIEW", EmployeeRead = "EMPLOYEE_READ", EmployeeWrite = "EMPLOYEE_WRITE",
        OrgManage = "ORG_MANAGE", UserManage = "USER_MANAGE", LeaveApprove = "LEAVE_APPROVE", LeavePolicyManage = "LEAVE_POLICY_MANAGE",
        AttendanceApprove = "ATTENDANCE_APPROVE", AttendanceManage = "ATTENDANCE_MANAGE", HolidayManage = "HOLIDAY_MANAGE",
        PayrollView = "PAYROLL_VIEW", PayrollProcess = "PAYROLL_PROCESS", PayrollApprove = "PAYROLL_APPROVE", SalaryManage = "SALARY_MANAGE",
        PayslipViewAll = "PAYSLIP_VIEW_ALL", TaxConfig = "TAX_CONFIG", TaxReview = "TAX_REVIEW", PerformanceManage = "PERFORMANCE_MANAGE",
        PerformanceReview = "PERFORMANCE_REVIEW", ProjectManage = "PROJECT_MANAGE", TimesheetApprove = "TIMESHEET_APPROVE",
        ExitManage = "EXIT_MANAGE", ExitApprove = "EXIT_APPROVE", DocumentVerify = "DOCUMENT_VERIFY", NotificationManage = "NOTIFICATION_MANAGE",
        ReportView = "REPORT_VIEW", AuditView = "AUDIT_VIEW";
}
