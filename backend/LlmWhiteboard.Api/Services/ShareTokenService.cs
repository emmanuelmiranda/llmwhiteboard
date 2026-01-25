using System.Security.Cryptography;
using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Services;

public class ShareTokenService : IShareTokenService
{
    private const string TokenPrefix = "lwb_sh_";
    private readonly AppDbContext _db;

    public ShareTokenService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(string Token, ShareToken ShareToken)> CreateShareAsync(string userId, CreateShareRequest request)
    {
        // Validate request
        if (request.Scope == ShareScope.Session && string.IsNullOrEmpty(request.SessionId))
        {
            throw new ArgumentException("SessionId is required for Session scope shares");
        }

        // Verify session ownership if session scope
        if (request.Scope == ShareScope.Session)
        {
            var session = await _db.Sessions
                .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.UserId == userId);

            if (session == null)
            {
                throw new KeyNotFoundException("Session not found");
            }
        }

        // Generate token
        var randomBytes = RandomNumberGenerator.GetBytes(32);
        var token = $"{TokenPrefix}{Convert.ToHexString(randomBytes).ToLower()}";

        var shareToken = new ShareToken
        {
            UserId = userId,
            SessionId = request.Scope == ShareScope.Session ? request.SessionId : null,
            Scope = request.Scope,
            Visibility = request.Visibility,
            Token = token,
            Name = request.Name,
            ExpiresAt = request.ExpiresAt,
            MaxViewers = request.MaxViewers
        };

        _db.ShareTokens.Add(shareToken);
        await _db.SaveChangesAsync();

        return (token, shareToken);
    }

    public async Task<ShareToken?> ValidateTokenAsync(string token)
    {
        if (!token.StartsWith(TokenPrefix))
            return null;

        var shareToken = await _db.ShareTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == token && t.RevokedAt == null);

        if (shareToken == null)
            return null;

        // Check expiry
        if (shareToken.ExpiresAt.HasValue && shareToken.ExpiresAt.Value < DateTime.UtcNow)
        {
            return null;
        }

        return shareToken;
    }

    public async Task<List<ShareToken>> GetUserSharesAsync(string userId)
    {
        return await _db.ShareTokens
            .Include(t => t.Session)
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<ShareToken>> GetSessionSharesAsync(string sessionId, string userId)
    {
        return await _db.ShareTokens
            .Where(t => t.SessionId == sessionId && t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> RevokeShareAsync(string shareId, string userId)
    {
        var shareToken = await _db.ShareTokens
            .FirstOrDefaultAsync(t => t.Id == shareId && t.UserId == userId && t.RevokedAt == null);

        if (shareToken == null)
            return false;

        shareToken.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return true;
    }

    public async Task RecordAccessAsync(string shareTokenId)
    {
        var shareToken = await _db.ShareTokens.FindAsync(shareTokenId);

        if (shareToken != null)
        {
            shareToken.AccessCount++;
            shareToken.LastAccessedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }
}
