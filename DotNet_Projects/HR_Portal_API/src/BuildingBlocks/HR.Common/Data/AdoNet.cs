using System.Data;
using System.Data.Common;
using MySqlConnector;

namespace HR.Common.Data;

/// <summary>
/// Practical ADO.NET layer (MySqlConnection / MySqlCommand / MySqlDataReader / MySqlParameter) on the pooled MySqlDataSource.
/// Every value travels as a MySqlParameter - SQL text is never concatenated with user input.
/// </summary>
public interface IAdoNet
{
    Task<List<T>> QueryAsync<T>(string sql, Func<DbDataReader, T> map, object? parameters = null, CancellationToken ct = default);
    Task<T?> ScalarAsync<T>(string sql, object? parameters = null, CancellationToken ct = default);
    Task<int> ExecuteAsync(string sql, object? parameters = null, CancellationToken ct = default);
    /// <summary>Calls a stored procedure (CommandType.StoredProcedure) and maps the first result set.</summary>
    Task<List<T>> CallProcedureAsync<T>(string procedure, Func<DbDataReader, T> map, object? parameters = null, CancellationToken ct = default);
    /// <summary>Calls a stored procedure that returns no rows.</summary>
    Task<int> CallProcedureNonQueryAsync(string procedure, object? parameters = null, CancellationToken ct = default);
    /// <summary>Several statements in one explicit transaction using a MySqlBatch (one round trip).</summary>
    Task<int> ExecuteBatchAsync(IEnumerable<(string Sql, object? Params)> statements, CancellationToken ct = default);
    /// <summary>Disconnected access with MySqlDataAdapter -> DataTable (used by CSV/report exports).</summary>
    Task<DataTable> FillTableAsync(string sql, object? parameters = null, CancellationToken ct = default);
    /// <summary>Streams rows without buffering them (IAsyncEnumerable).</summary>
    IAsyncEnumerable<T> StreamAsync<T>(string sql, Func<DbDataReader, T> map, object? parameters = null, CancellationToken ct = default);
}

public sealed class AdoNet(MySqlDataSource dataSource) : IAdoNet
{
    public async Task<List<T>> QueryAsync<T>(string sql, Func<DbDataReader, T> map, object? parameters = null, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, sql, parameters, CommandType.Text);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<T>();
        while (await r.ReadAsync(ct)) list.Add(map(r));
        return list;
    }

    public async IAsyncEnumerable<T> StreamAsync<T>(string sql, Func<DbDataReader, T> map, object? parameters = null, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, sql, parameters, CommandType.Text);
        await using var r = await cmd.ExecuteReaderAsync(CommandBehavior.SequentialAccess, ct);
        while (await r.ReadAsync(ct)) yield return map(r);
    }

    public async Task<T?> ScalarAsync<T>(string sql, object? parameters = null, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, sql, parameters, CommandType.Text);
        var v = await cmd.ExecuteScalarAsync(ct);
        return v is null or DBNull ? default : (T)Convert.ChangeType(v, Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T), System.Globalization.CultureInfo.InvariantCulture);
    }

    public async Task<int> ExecuteAsync(string sql, object? parameters = null, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, sql, parameters, CommandType.Text);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<List<T>> CallProcedureAsync<T>(string procedure, Func<DbDataReader, T> map, object? parameters = null, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, EnsureIdentifier(procedure), parameters, CommandType.StoredProcedure);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<T>();
        while (await r.ReadAsync(ct)) list.Add(map(r));
        return list;
    }

    public async Task<int> CallProcedureNonQueryAsync(string procedure, object? parameters = null, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, EnsureIdentifier(procedure), parameters, CommandType.StoredProcedure);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<int> ExecuteBatchAsync(IEnumerable<(string Sql, object? Params)> statements, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var batch = new MySqlBatch(conn, tx);
        foreach (var (sql, ps) in statements)
        {
            var c = new MySqlBatchCommand(sql);
            AddParams(c.Parameters, ps);
            batch.BatchCommands.Add(c);
        }
        var n = await batch.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct);
        return n;
    }

    public async Task<DataTable> FillTableAsync(string sql, object? parameters = null, CancellationToken ct = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = Build(conn, sql, parameters, CommandType.Text);
        using var adapter = new MySqlDataAdapter(cmd);
        var table = new DataTable();
        adapter.Fill(table);   // the adapter API is synchronous by design; the work is a bounded report query
        return table;
    }

    private static MySqlCommand Build(MySqlConnection conn, string sql, object? parameters, CommandType type)
    {
        var cmd = new MySqlCommand(sql, conn) { CommandType = type };
        AddParams(cmd.Parameters, parameters);
        return cmd;
    }

    private static void AddParams(MySqlParameterCollection target, object? parameters)
    {
        if (parameters is null) return;
        foreach (var p in parameters.GetType().GetProperties())
            target.Add(new MySqlParameter("@" + p.Name, p.GetValue(parameters) ?? DBNull.Value));
    }

    private static string EnsureIdentifier(string name)
    {
        if (name.Length == 0 || !name.All(c => char.IsLetterOrDigit(c) || c == '_')) throw new ArgumentException("Invalid routine name", nameof(name));
        return name;
    }
}

public static class DbDataReaderExtensions
{
    /// <summary>Whole current row as a name -> value dictionary (used for stored-procedure result sets whose shape is owned by the database).</summary>
    public static Dictionary<string, object?> ToDictionary(this DbDataReader r)
    {
        var d = new Dictionary<string, object?>(r.FieldCount, StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < r.FieldCount; i++)
        {
            var v = r.IsDBNull(i) ? null : r.GetValue(i);
            if (v is DateTime dt) v = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
            else if (v is MySqlConnector.MySqlDateTime md) v = md.GetDateTime();
            d[CamelCase(r.GetName(i))] = v;
        }
        return d;
    }

    /// <summary>leave_type_code -> leaveTypeCode (column names of database-owned result sets become JSON-friendly keys).</summary>
    public static string CamelCase(string name)
    {
        var parts = name.Split('_', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return name;
        return parts[0].ToLowerInvariant() + string.Concat(parts.Skip(1).Select(p => char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }

    public static string? Str(this DbDataReader r, string col) { var o = r.GetOrdinal(col); return r.IsDBNull(o) ? null : Convert.ToString(r.GetValue(o), System.Globalization.CultureInfo.InvariantCulture); }
    public static decimal Dec(this DbDataReader r, string col) { var o = r.GetOrdinal(col); return r.IsDBNull(o) ? 0m : Convert.ToDecimal(r.GetValue(o), System.Globalization.CultureInfo.InvariantCulture); }
    public static int Int(this DbDataReader r, string col) { var o = r.GetOrdinal(col); return r.IsDBNull(o) ? 0 : Convert.ToInt32(r.GetValue(o), System.Globalization.CultureInfo.InvariantCulture); }
    public static long Long(this DbDataReader r, string col) { var o = r.GetOrdinal(col); return r.IsDBNull(o) ? 0 : Convert.ToInt64(r.GetValue(o), System.Globalization.CultureInfo.InvariantCulture); }
    public static DateTime? Dt(this DbDataReader r, string col) { var o = r.GetOrdinal(col); return r.IsDBNull(o) ? null : DateTime.SpecifyKind(Convert.ToDateTime(r.GetValue(o)), DateTimeKind.Utc); }
}
