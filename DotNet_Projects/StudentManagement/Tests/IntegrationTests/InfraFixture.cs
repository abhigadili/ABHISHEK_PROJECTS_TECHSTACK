using Testcontainers.MySql;
using Testcontainers.RabbitMq;
using Testcontainers.Redis;

namespace IntegrationTests;

/// <summary>
/// Throw-away MySQL 8, RabbitMQ and Redis containers shared by all integration tests (Testcontainers).
/// Tests never touch the real StudentDB/CourseDB/EnrollmentDB/NotificationDB: every test class creates its own database inside the container.
/// </summary>
public class InfraFixture : IAsyncLifetime
{
    public MySqlContainer MySql { get; } = new MySqlBuilder().WithImage("mysql:8.0").WithUsername("root").WithPassword("it-root-pw").Build();
    public RabbitMqContainer Rabbit { get; } = new RabbitMqBuilder().WithImage("rabbitmq:3.13-management-alpine").WithUsername("it").WithPassword("it-pw").Build();
    public RedisContainer Redis { get; } = new RedisBuilder().WithImage("redis:7-alpine").Build();

    public async Task InitializeAsync() => await Task.WhenAll(MySql.StartAsync(), Rabbit.StartAsync(), Redis.StartAsync());
    public async Task DisposeAsync() { await MySql.DisposeAsync(); await Rabbit.DisposeAsync(); await Redis.DisposeAsync(); }

    /// <summary>Creates an empty database and returns its connection string.</summary>
    public async Task<string> NewDatabaseAsync(string prefix)
    {
        var name = $"{prefix}_{Guid.NewGuid():N}".Substring(0, 30);
        await MySql.ExecScriptAsync($"CREATE DATABASE `{name}`;");
        var b = new MySqlConnector.MySqlConnectionStringBuilder(MySql.GetConnectionString()) { Database = name };
        return b.ConnectionString;
    }

    public Messaging.RabbitMqOptions RabbitOptions
    {
        get
        {
            var u = new Uri(Rabbit.GetConnectionString());
            var ui = u.UserInfo.Split(':');
            return new Messaging.RabbitMqOptions { HostName = u.Host, Port = u.Port, UserName = ui[0], Password = ui[1] };
        }
    }
}

[CollectionDefinition("infra")]
public class InfraCollection : ICollectionFixture<InfraFixture> { }
