using HR.AuthService.Services;
using HR.Common.Messaging;

namespace HR.AuthService.Consumers;

/// <summary>When an employee leaves (exit completed or terminated) their login is deactivated and every session revoked.</summary>
public sealed class EmployeeExitedHandler(IUserService users) : EventHandlerBase<EmployeeExitedEvent>
{
    public override string Topic => Topics.EmployeeExited;
    protected override Task HandleAsync(EmployeeExitedEvent e, CancellationToken ct) => users.DeactivateByEmployeeAsync(e.EmployeeId, ct);
}

public sealed class EmployeeTerminatedHandler(IUserService users) : EventHandlerBase<EmployeeEvent>
{
    public override string Topic => Topics.EmployeeTerminated;
    protected override Task HandleAsync(EmployeeEvent e, CancellationToken ct) => users.DeactivateByEmployeeAsync(e.EmployeeId, ct);
}
