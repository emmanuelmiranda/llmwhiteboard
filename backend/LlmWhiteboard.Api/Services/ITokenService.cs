using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Services;

public interface ITokenService
{
    Task<(string Token, ApiToken ApiToken)> CreateTokenAsync(string userId, string name, string? teamId = null);
    Task<(bool Valid, string? UserId, string? TokenId)> ValidateTokenAsync(string token);
    Task<List<ApiToken>> GetUserTokensAsync(string userId);
    Task<bool> RevokeTokenAsync(string tokenId, string userId);
    Task<ApiToken?> UpdateTokenTeamAsync(string tokenId, string userId, string? teamId);
}
