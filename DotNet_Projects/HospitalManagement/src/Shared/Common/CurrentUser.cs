using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace HMS.Shared.Common;

public static class Roles
{
    public const string Admin = "ADMIN";
    public const string Doctor = "DOCTOR";
    public const string Patient = "PATIENT";
    public const string LabStaff = "LAB_STAFF";
    public const string Pharmacist = "PHARMACIST";
    public const string BillingStaff = "BILLING_STAFF";
    public static readonly string[] All = [Admin, Doctor, Patient, LabStaff, Pharmacist, BillingStaff];
}

/// <summary>Read-only view of the authenticated caller, taken from the validated JWT.</summary>
public interface ICurrentUser
{
    long? Id { get; }
    string? Username { get; }
    string? Email { get; }
    string? Token { get; }
    bool IsInRole(string role);
    bool IsAdmin { get; }
}

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;
    public long? Id => long.TryParse(Principal?.FindFirstValue("sub") ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public string? Username => Principal?.FindFirstValue("unique_name") ?? Principal?.FindFirstValue(ClaimTypes.Name);
    public string? Email => Principal?.FindFirstValue("email") ?? Principal?.FindFirstValue(ClaimTypes.Email);
    public string? Token
    {
        get
        {
            var h = accessor.HttpContext?.Request.Headers.Authorization.ToString();
            return !string.IsNullOrEmpty(h) && h.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? h[7..] : null;
        }
    }
    public bool IsInRole(string role) => Principal?.IsInRole(role) ?? false;
    public bool IsAdmin => IsInRole(Roles.Admin);
}

/// <summary>Validation: the date must lie in the past.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class PastDateAttribute : System.ComponentModel.DataAnnotations.ValidationAttribute
{
    public override bool IsValid(object? value) => value is null || (value is DateOnly d && d < DateOnly.FromDateTime(DateTime.UtcNow));
    public override string FormatErrorMessage(string name) => "must be a date in the past";
}

/// <summary>Validation: the date must be today or later.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class FutureOrTodayAttribute : System.ComponentModel.DataAnnotations.ValidationAttribute
{
    public override bool IsValid(object? value) => value is null || (value is DateOnly d && d >= DateOnly.FromDateTime(DateTime.Now));
    public override string FormatErrorMessage(string name) => "must be today or a future date";
}

/// <summary>Accepts both "HH:mm" and "HH:mm:ss" for TimeOnly (System.Text.Json by default only accepts the long form); writes "HH:mm:ss".</summary>
public sealed class FlexibleTimeOnlyConverter : System.Text.Json.Serialization.JsonConverter<TimeOnly>
{
    public override TimeOnly Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (TimeOnly.TryParseExact(s, ["HH:mm", "HH:mm:ss", "HH:mm:ss.FFFFFFF"], System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var t)) return t;
        throw new System.Text.Json.JsonException($"'{s}' is not a valid time (expected HH:mm or HH:mm:ss)");
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, TimeOnly value, System.Text.Json.JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture));
}
