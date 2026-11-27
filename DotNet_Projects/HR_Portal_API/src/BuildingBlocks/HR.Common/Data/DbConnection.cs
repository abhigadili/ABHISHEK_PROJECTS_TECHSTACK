using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HR.Common.Data;

public static class DbConnection
{
    /// <summary>Connection string built from configuration; credentials only come from the environment (never source code).</summary>
    public static string Build(IConfiguration cfg, string database)
    {
        var host = cfg["MYSQL_HOST"] ?? "localhost";
        var port = cfg["MYSQL_PORT"] ?? "3306";
        var user = cfg["MYSQL_USER"] ?? throw new InvalidOperationException("MYSQL_USER is not set (see .env.example)");
        var pwd = cfg["MYSQL_PASSWORD"] ?? throw new InvalidOperationException("MYSQL_PASSWORD is not set (see .env.example)");
        // Pooling=true + bounded pool: ADO.NET connection pooling shared by EF Core and the raw ADO.NET helpers
        return new MySqlConnector.MySqlConnectionStringBuilder
        {
            Server = host, Port = uint.Parse(port), Database = database, UserID = user, Password = pwd,
            SslMode = MySqlConnector.MySqlSslMode.None, AllowPublicKeyRetrieval = true, CharacterSet = "utf8mb4",
            Pooling = true, MinimumPoolSize = 1, MaximumPoolSize = 30, DefaultCommandTimeout = 30, ConnectionTimeout = 10,
            AllowUserVariables = true
        }.ConnectionString;
    }

    public static void Configure(DbContextOptionsBuilder o, string connectionString) =>
        o.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)), m => m.EnableRetryOnFailure(3));
}
