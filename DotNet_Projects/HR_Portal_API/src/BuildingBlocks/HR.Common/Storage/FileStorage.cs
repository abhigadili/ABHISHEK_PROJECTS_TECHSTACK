using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace HR.Common.Storage;

public sealed record StoredFile(string StoragePath, string Sha256, long SizeBytes);

/// <summary>Configurable file storage (metadata lives in MySQL, bytes here). The local-disk implementation can be swapped for object storage.</summary>
public interface IFileStorage
{
    Task<StoredFile> SaveAsync(string folder, string fileName, byte[] content, CancellationToken ct = default);
    Task<StoredFile> SaveAsync(string folder, string fileName, Stream content, CancellationToken ct = default);
    Stream Open(string storagePath);
    bool Exists(string storagePath);
    void Delete(string storagePath);
}

public sealed class LocalFileStorage(IConfiguration cfg) : IFileStorage
{
    private readonly string _root = Path.GetFullPath(cfg["STORAGE_DIR"] ?? "storage");

    /// <summary>Resolves a relative storage path under the root; anything escaping the root (path traversal) is rejected.</summary>
    private string Resolve(string relative)
    {
        var full = Path.GetFullPath(Path.Combine(_root, relative));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal)) throw new InvalidOperationException("Invalid storage path");
        return full;
    }

    private static string Safe(string name)
    {
        var cleaned = new string(Path.GetFileName(name).Select(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_').ToArray());
        return string.IsNullOrWhiteSpace(cleaned) ? "file" : cleaned;
    }

    public async Task<StoredFile> SaveAsync(string folder, string fileName, byte[] content, CancellationToken ct = default)
    {
        using var ms = new MemoryStream(content);
        return await SaveAsync(folder, fileName, ms, ct);
    }

    public async Task<StoredFile> SaveAsync(string folder, string fileName, Stream content, CancellationToken ct = default)
    {
        var relative = Path.Combine(string.Join('/', folder.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Safe)), $"{Guid.NewGuid():N}-{Safe(fileName)}").Replace('\\', '/');
        var full = Resolve(relative);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        using var sha = SHA256.Create();
        long size = 0;
        await using (var fs = new FileStream(full, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            var buffer = new byte[81920];
            int n;
            while ((n = await content.ReadAsync(buffer, ct)) > 0)
            {
                sha.TransformBlock(buffer, 0, n, null, 0);
                await fs.WriteAsync(buffer.AsMemory(0, n), ct);
                size += n;
            }
            sha.TransformFinalBlock([], 0, 0);
        }
        return new StoredFile(relative, Convert.ToHexString(sha.Hash!).ToLowerInvariant(), size);
    }

    public Stream Open(string storagePath) => new FileStream(Resolve(storagePath), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
    public bool Exists(string storagePath) => File.Exists(Resolve(storagePath));
    public void Delete(string storagePath) { var f = Resolve(storagePath); if (File.Exists(f)) File.Delete(f); }
}
