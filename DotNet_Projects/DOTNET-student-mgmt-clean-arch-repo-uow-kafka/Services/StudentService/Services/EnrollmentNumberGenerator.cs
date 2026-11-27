using System.Security.Cryptography;

namespace StudentMgmt.StudentService.Services;

/// <summary>
/// Generates enrollment numbers shaped like "STU-2026-000123". Used both by
/// StudentAppService.CreateAsync and AuthService.RegisterAsync (when the
/// registered role is Student) so both entry points produce the same format.
/// A cryptographically random 6-digit suffix is used instead of a running
/// counter to avoid a race between concurrent registrations without needing an
/// extra round-trip to the database to compute "next sequence".
/// </summary>
public static class EnrollmentNumberGenerator
{
    public static string Generate() =>
        $"STU-{DateTime.UtcNow.Year}-{RandomNumberGenerator.GetInt32(0, 1_000_000):D6}";
}
