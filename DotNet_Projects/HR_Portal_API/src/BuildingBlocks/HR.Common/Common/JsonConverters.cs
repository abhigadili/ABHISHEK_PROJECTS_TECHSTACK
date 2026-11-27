using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HR.Common.Common;

/// <summary>Accepts "HH:mm" and "HH:mm:ss" for TimeOnly (System.Text.Json natively only accepts the long form); writes "HH:mm:ss".</summary>
public sealed class FlexibleTimeOnlyConverter : JsonConverter<TimeOnly>
{
    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (TimeOnly.TryParseExact(s, ["HH:mm", "HH:mm:ss", "HH:mm:ss.FFFFFFF"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)) return t;
        throw new JsonException($"'{s}' is not a valid time (expected HH:mm or HH:mm:ss)");
    }
    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) => writer.WriteStringValue(value.ToString("HH:mm:ss", CultureInfo.InvariantCulture));
}

/// <summary>DateTime without a Kind (as returned by MySQL DATETIME) is UTC in this system: always serialised with a trailing Z.</summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var d = reader.GetDateTime();
        return d.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(d, DateTimeKind.Utc) : d.ToUniversalTime();
    }
    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue((value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime()).ToString("yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'", CultureInfo.InvariantCulture));
}
