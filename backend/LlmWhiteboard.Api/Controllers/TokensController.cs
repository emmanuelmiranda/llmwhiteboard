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
                LastUsedAt = t.LastUsedAt,
                CreatedAt = t.CreatedAt
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<ActionResult<CreateTokenResponse>> CreateToken([FromBody] CreateTokenRequest request)
    {
        var userId = GetUserId();
        var (token, apiToken) = await _tokenService.CreateTokenAsync(userId, request.Name);

        return Ok(new CreateTokenResponse
        {
            Token = token,
            Id = apiToken.Id,
            Message = "Token created. Save it now - you won't be able to see it again!"
        });
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
