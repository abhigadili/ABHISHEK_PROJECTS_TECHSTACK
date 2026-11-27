using Microsoft.Extensions.DependencyInjection;

namespace HR.Common.Messaging;

/// <summary>
/// Every service owns a local copy of the employee data it needs (leave_employees, attendance_employees ...) - no cross-database reads.
/// The service implements this port; the shared consumer feeds it from employee.created / updated / terminated.
/// </summary>
public interface IEmployeeReadModel
{
    Task UpsertAsync(EmployeeEvent e, CancellationToken ct);
}

public sealed class EmployeeSnapshotHandler(string topic, IEmployeeReadModel model) : EventHandlerBase<EmployeeEvent>
{
    public override string Topic => topic;
    public override string Name => "EmployeeSnapshot";
    protected override Task HandleAsync(EmployeeEvent e, CancellationToken ct) => model.UpsertAsync(e, ct);
}

public static class EmployeeReadModelRegistration
{
    public static IServiceCollection AddEmployeeReadModel<TModel>(this IServiceCollection services) where TModel : class, IEmployeeReadModel
    {
        services.AddScoped<IEmployeeReadModel, TModel>();
        foreach (var topic in new[] { Topics.EmployeeCreated, Topics.EmployeeUpdated, Topics.EmployeeTerminated })
            services.AddScoped<IEventHandler>(sp => new EmployeeSnapshotHandler(topic, sp.GetRequiredService<IEmployeeReadModel>()));
        return services;
    }
}
