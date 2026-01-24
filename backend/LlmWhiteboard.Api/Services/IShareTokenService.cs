using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Services;

public interface IShareTokenService
{
    /// <summary>
    /// Create a new share token
    /// </summary>
    Task<(string Token, ShareToken ShareToken)> CreateShareAsync(string userId, CreateShareRequest request);

    /// <summary>
    /// Validate a share token and return share info
    /// </summary>
    Task<ShareToken?> ValidateTokenAsync(string token);

    /// <summary>
    /// Get all shares for a user
    /// </summary>
    Task<List<ShareToken>> GetUserSharesAsync(string userId);

    /// <summary>
    /// Get all shares for a specific session
    /// </summary>
    Task<List<ShareToken>> GetSessionSharesAsync(string sessionId, string userId);

    /// <summary>
    /// Revoke a share token
    /// </summary>
    Task<bool> RevokeShareAsync(string shareId, string userId);

    /// <summary>
    /// Record access to a share (increments counter, updates last access time)
    /// </summary>
    Task RecordAccessAsync(string shareTokenId);
}
