using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StudentMgmt.BuildingBlocks.Common.Extensions;

public static class HealthCheckServiceExtensions
{
    /// <summary>
    /// Wires up three checks surfaced at GET /health: the service's own MySQL
    /// database, Kafka connectivity, and a trivial "application is alive" check.
    /// Each service calls this once with its own connection string.
    /// </summary>
    public static IServiceCollection AddAppHealthChecks(this IServiceCollection services, string mySqlConnectionString, string kafkaBootstrapServers)
    {
        services.AddHealthChecks()
            .AddMySql(mySqlConnectionString, name: "mysql-database", tags: new[] { "database", "ready" })
            .AddKafka(options => options.BootstrapServers = kafkaBootstrapServers, name: "kafka-broker", tags: new[] { "messaging", "ready" })
            .AddCheck("application", () => HealthCheckResult.Healthy("Application is running."), tags: new[] { "live" });

        return services;
    }
}
