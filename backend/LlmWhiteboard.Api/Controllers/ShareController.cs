using System.Security.Claims;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShareController : ControllerBase
{
    private readonly IShareTokenService _shareTokenService;
    private readonly IConfiguration _configuration;

    public ShareController(IShareTokenService shareTokenService, IConfiguration configuration)
    {
        _shareTokenService = shareTokenService;
        _configuration = configuration;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    private string GetShareUrl(string token)
    {
        var frontendUrl = _configuration["Frontend:Url"] ?? "https://llmwhiteboard.com";
        return $"{frontendUrl}/share/{token}";
    }

    /// <summary>
    /// Create a new share token
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CreateShareResponse>> CreateShare([FromBody] CreateShareRequest request)
    {
        var userId = GetUserId();

        try
        {
            var (token, shareToken) = await _shareTokenService.CreateShareAsync(userId, request);

            return Ok(new CreateShareResponse
            {
                Id = shareToken.Id,
                Token = token,
                Url = GetShareUrl(token),
                Message = "Share link created. Anyone with this link can view."
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Session not found" });
        }
    }

    /// <summary>
    /// List all shares for the current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ShareListResponse>> GetShares()
    {
        var userId = GetUserId();
        var shares = await _shareTokenService.GetUserSharesAsync(userId);

        return Ok(new ShareListResponse
        {
            Shares = shares.Select(s => new ShareTokenDto
            {
                Id = s.Id,
                SessionId = s.SessionId,
                Scope = s.Scope.ToString(),
                Visibility = s.Visibility.ToString(),
                TokenPrefix = s.TokenPrefix,
                Name = s.Name,
                ExpiresAt = s.ExpiresAt,
                MaxViewers = s.MaxViewers,
                IsRevoked = s.RevokedAt.HasValue,
                CreatedAt = s.CreatedAt,
                LastAccessedAt = s.LastAccessedAt,
                AccessCount = s.AccessCount
            }).ToList()
        });
    }

    /// <summary>
    /// List shares for a specific session
    /// </summary>
    [HttpGet("session/{sessionId}")]
    public async Task<ActionResult<ShareListResponse>> GetSessionShares(string sessionId)
    {
        var userId = GetUserId();
        var shares = await _shareTokenService.GetSessionSharesAsync(sessionId, userId);

        return Ok(new ShareListResponse
        {
            Shares = shares.Select(s => new ShareTokenDto
            {
                Id = s.Id,
                SessionId = s.SessionId,
                Scope = s.Scope.ToString(),
                Visibility = s.Visibility.ToString(),
                TokenPrefix = s.TokenPrefix,
                Name = s.Name,
                ExpiresAt = s.ExpiresAt,
                MaxViewers = s.MaxViewers,
                IsRevoked = s.RevokedAt.HasValue,
                CreatedAt = s.CreatedAt,
                LastAccessedAt = s.LastAccessedAt,
                AccessCount = s.AccessCount
            }).ToList()
        });
    }

    /// <summary>
    /// Revoke a share token
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> RevokeShare(string id)
    {
        var userId = GetUserId();
        var revoked = await _shareTokenService.RevokeShareAsync(id, userId);

        if (!revoked)
        {
            return NotFound(new { error = "Share not found" });
        }

        return Ok(new { success = true });
    }
}
