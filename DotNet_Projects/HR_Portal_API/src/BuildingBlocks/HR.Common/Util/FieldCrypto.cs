using System.Security.Cryptography;
using System.Text;

namespace HR.Common.Util;

/// <summary>
/// AES-256-GCM field encryption for sensitive columns (bank account, PAN ...). Values written by this app carry the "enc1:" prefix.
/// Values encrypted by the Java application use a different envelope/key and are treated as opaque (never decrypted, never overwritten).
/// </summary>
public interface IFieldCrypto
{
    string Encrypt(string plain);
    /// <summary>Returns the plain text for "enc1:" values, "[protected]" for foreign (Java-encrypted) values, otherwise the value itself.</summary>
    string? Reveal(string? stored);
    static string Mask(string? plain) => string.IsNullOrEmpty(plain) ? "" : plain.Length <= 4 ? new string('*', plain.Length) : new string('*', plain.Length - 4) + plain[^4..];
}

public sealed class FieldCrypto(Microsoft.Extensions.Configuration.IConfiguration cfg) : IFieldCrypto
{
    private const string Prefix = "enc1:";
    private readonly byte[] _key = SHA256.HashData(Encoding.UTF8.GetBytes(cfg["FIELD_ENCRYPTION_KEY"] ?? throw new InvalidOperationException("FIELD_ENCRYPTION_KEY is not set")));

    public string Encrypt(string plain)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var data = Encoding.UTF8.GetBytes(plain);
        var cipher = new byte[data.Length];
        var tag = new byte[16];
        using var gcm = new AesGcm(_key, 16);
        gcm.Encrypt(nonce, data, cipher, tag);
        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string? Reveal(string? stored)
    {
        if (string.IsNullOrEmpty(stored)) return stored;
        if (!stored.StartsWith(Prefix, StringComparison.Ordinal)) return IsLikelyForeignCipher(stored) ? "[protected]" : stored;
        try
        {
            var raw = Convert.FromBase64String(stored[Prefix.Length..]);
            var nonce = raw[..12]; var tag = raw[12..28]; var cipher = raw[28..];
            var plain = new byte[cipher.Length];
            using var gcm = new AesGcm(_key, 16);
            gcm.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException) { return "[protected]"; }
    }

    private static bool IsLikelyForeignCipher(string v) => v.Length >= 24 && v.All(c => char.IsLetterOrDigit(c) || c is '+' or '/' or '=' or '-' or '_' or ':');
}
