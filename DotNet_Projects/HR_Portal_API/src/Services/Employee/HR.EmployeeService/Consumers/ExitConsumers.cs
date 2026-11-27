using HR.Common.Messaging;
using HR.EmployeeService.Services;

namespace HR.EmployeeService.Consumers;

/// <summary>Exit workflow -> employee status. Step 8 of the exit workflow: employee.exited marks the employee RESIGNED.</summary>
public sealed class EmployeeExitedHandler(IEmployeeService employees) : EventHandlerBase<EmployeeExitedEvent>
{
    public override string Topic => Topics.EmployeeExited;
    protected override Task HandleAsync(EmployeeExitedEvent e, CancellationToken ct) => employees.ApplyExitAsync(e.EmployeeId, e.LastWorkingDay, ct);
}

public sealed class ResignationSubmittedHandler(IEmployeeService employees) : EventHandlerBase<ResignationEvent>
{
    public override string Topic => Topics.ResignationSubmitted;
    protected override Task HandleAsync(ResignationEvent e, CancellationToken ct) => employees.ApplyNoticeAsync(e.EmployeeId, ct);
}

public sealed class ResignationWithdrawnHandler(IEmployeeService employees) : EventHandlerBase<ResignationEvent>
{
    public override string Topic => Topics.ResignationWithdrawn;
    protected override Task HandleAsync(ResignationEvent e, CancellationToken ct) => employees.RevertNoticeAsync(e.EmployeeId, ct);
}
