namespace HR.Common.Common;

/// <summary>Ambient correlation id: set by HTTP middleware or the Kafka consumer, copied onto outgoing HTTP calls and events.</summary>
public static class CorrelationContext
{
    private static readonly AsyncLocal<string?> Current = new();
    public const string HeaderName = "X-Correlation-Id";
    public static string? Id { get => Current.Value; set => Current.Value = value; }
    public static string NewId() => Guid.NewGuid().ToString("N")[..16];
}
