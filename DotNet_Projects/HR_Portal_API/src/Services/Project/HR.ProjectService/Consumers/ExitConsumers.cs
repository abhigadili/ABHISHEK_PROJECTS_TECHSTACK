using HR.Common.Messaging;
using HR.ProjectService.Services;

namespace HR.ProjectService.Consumers;

public sealed class EmployeeExitedHandler(IProjectService projects) : EventHandlerBase<EmployeeExitedEvent>
{
    public override string Topic => Topics.EmployeeExited;
    protected override Task HandleAsync(EmployeeExitedEvent e, CancellationToken ct) => projects.EndAllocationsForExitAsync(e.EmployeeId, e.LastWorkingDay, ct);
}

public sealed class EmployeeTerminatedHandler(IProjectService projects) : EventHandlerBase<EmployeeEvent>
{
    public override string Topic => Topics.EmployeeTerminated;
    protected override Task HandleAsync(EmployeeEvent e, CancellationToken ct) => projects.EndAllocationsForExitAsync(e.EmployeeId, e.ExitDate ?? DateOnly.FromDateTime(DateTime.UtcNow), ct);
}
