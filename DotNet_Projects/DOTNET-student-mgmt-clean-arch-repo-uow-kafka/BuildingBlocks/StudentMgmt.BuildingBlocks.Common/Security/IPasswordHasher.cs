namespace StudentMgmt.BuildingBlocks.Common.Security;

public interface IPasswordHasher
{
    string Hash(string plainTextPassword);

    bool Verify(string plainTextPassword, string passwordHash);
}

/// <summary>Thin wrapper around BCrypt.Net so no service ever imports BCrypt directly.</summary>
public sealed class BCryptPasswordHasher : IPasswordHasher
{
    public string Hash(string plainTextPassword) => BCrypt.Net.BCrypt.HashPassword(plainTextPassword, workFactor: 12);

    public bool Verify(string plainTextPassword, string passwordHash) => BCrypt.Net.BCrypt.Verify(plainTextPassword, passwordHash);
}
