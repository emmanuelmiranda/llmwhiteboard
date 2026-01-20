using System.Security.Cryptography;
using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Services;

public class TokenService : ITokenService
{
    private const string TokenPrefix = "lwb_sk_";
    private readonly AppDbContext _db;

    public TokenService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(string Token, ApiToken ApiToken)> CreateTokenAsync(string userId, string name)
    {
        var randomBytes = RandomNumberGenerator.GetBytes(32);
        var token = $"{TokenPrefix}{Convert.ToHexString(randomBytes).ToLower()}";
        var prefix = token[..12];
        var tokenHash = BCrypt.Net.BCrypt.HashPassword(token, 10);

        var apiToken = new ApiToken
        {
            UserId = userId,
            Name = name,
            TokenHash = tokenHash,
            TokenPrefix = prefix
        };

        _db.ApiTokens.Add(apiToken);
        await _db.SaveChangesAsync();

        return (token, apiToken);
    }

    public async Task<(bool Valid, string? UserId, string? TokenId)> ValidateTokenAsync(string token)
    {
        if (!token.StartsWith(TokenPrefix))
            return (false, null, null);

        var prefix = token[..12];

        var apiTokens = await _db.ApiTokens
            .Where(t => t.TokenPrefix == prefix && t.RevokedAt == null)
            .ToListAsync();

        foreach (var apiToken in apiTokens)
        {
            if (BCrypt.Net.BCrypt.Verify(token, apiToken.TokenHash))
            {
                apiToken.LastUsedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                return (true, apiToken.UserId, apiToken.Id);
            }
        }

        return (false, null, null);
    }

    public async Task<List<ApiToken>> GetUserTokensAsync(string userId)
    {
        return await _db.ApiTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> RevokeTokenAsync(string tokenId, string userId)
    {
        var token = await _db.ApiTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.UserId == userId && t.RevokedAt == null);

        if (token == null)
            return false;

        token.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return true;
    }
}
