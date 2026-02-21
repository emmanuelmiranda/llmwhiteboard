using System.Security.Claims;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TokensController : ControllerBase
{
    private readonly ITokenService _tokenService;

    public TokensController(ITokenService tokenService)
    {
        _tokenService = tokenService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    [HttpGet]
    public async Task<ActionResult<TokenListResponse>> GetTokens()
    {
        var userId = GetUserId();
        var tokens = await _tokenService.GetUserTokensAsync(userId);

        return Ok(new TokenListResponse
        {
            Tokens = tokens.Select(t => new TokenDto
            {
                Id = t.Id,
                Name = t.Name,
                TokenPrefix = t.TokenPrefix,
                TeamId = t.TeamId,
                TeamName = t.Team?.Name,
                LastUsedAt = t.LastUsedAt,
                CreatedAt = t.CreatedAt
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<ActionResult<CreateTokenResponse>> CreateToken([FromBody] CreateTokenRequest request)
    {
        var userId = GetUserId();

        try
        {
            var (token, apiToken) = await _tokenService.CreateTokenAsync(userId, request.Name, request.TeamId);

            return Ok(new CreateTokenResponse
            {
                Token = token,
                Id = apiToken.Id,
                Message = "Token created. Save it now - you won't be able to see it again!"
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<TokenDto>> UpdateTokenTeam(string id, [FromBody] UpdateTokenRequest request)
    {
        var userId = GetUserId();

        try
        {
            var token = await _tokenService.UpdateTokenTeamAsync(id, userId, request.TeamId);
            if (token == null)
                return NotFound(new { error = "Token not found" });

            return Ok(new TokenDto
            {
                Id = token.Id,
                Name = token.Name,
                TokenPrefix = token.TokenPrefix,
                TeamId = token.TeamId,
                TeamName = token.Team?.Name,
                LastUsedAt = token.LastUsedAt,
                CreatedAt = token.CreatedAt
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpDelete]
    public async Task<ActionResult> RevokeToken([FromQuery] string id)
    {
        var userId = GetUserId();
        var revoked = await _tokenService.RevokeTokenAsync(id, userId);

        if (!revoked)
        {
            return NotFound(new { error = "Token not found" });
        }

        return Ok(new { success = true });
    }
}
