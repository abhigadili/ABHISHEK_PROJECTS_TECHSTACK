namespace HMS.Shared.Common;

/// <summary>Ambient correlation id: set by the HTTP middleware or the Kafka consumer, copied onto outgoing HTTP/gRPC/Kafka messages.</summary>
public static class CorrelationContext
{
    private static readonly AsyncLocal<string?> Current = new();
    public const string HeaderName = "X-Correlation-Id";
    public static string? Id { get => Current.Value; set => Current.Value = value; }
    public static string NewId() => Guid.NewGuid().ToString("N")[..16];
}
