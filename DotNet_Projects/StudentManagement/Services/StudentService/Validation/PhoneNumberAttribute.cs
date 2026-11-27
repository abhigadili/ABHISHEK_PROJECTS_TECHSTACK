using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace StudentService.Validation;

/// <summary>Optional phone number: 7-15 digits with optional leading '+', spaces, dashes or parentheses.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed partial class OptionalPhoneAttribute : ValidationAttribute
{
    public OptionalPhoneAttribute() : base("must be a valid phone number (7-15 digits, optional leading +)") { }

    [GeneratedRegex(@"^\+?[0-9 ()\-]{7,20}$")] private static partial Regex Allowed();

    public override bool IsValid(object? value)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s)) return true;
        if (!Allowed().IsMatch(s)) return false;
        var digits = s.Count(char.IsDigit);
        return digits is >= 7 and <= 15;
    }
}
