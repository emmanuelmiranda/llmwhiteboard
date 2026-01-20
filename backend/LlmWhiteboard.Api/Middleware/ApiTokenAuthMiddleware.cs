using System.Security.Claims;
using LlmWhiteboard.Api.Services;

namespace LlmWhiteboard.Api.Middleware;

public class ApiTokenAuthMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly string[] SyncPaths = { "/api/sync" };

    public ApiTokenAuthMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITokenService tokenService)
    {
        // Only handle API token auth for sync endpoints
        var path = context.Request.Path.Value?.ToLower() ?? "";
        var isSyncEndpoint = SyncPaths.Any(p => path.StartsWith(p));

        if (isSyncEndpoint && !context.User.Identity?.IsAuthenticated == true)
        {
            var authHeader = context.Request.Headers.Authorization.FirstOrDefault();

            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                var token = authHeader["Bearer ".Length..];

                // Check if it's an API token (starts with lwb_sk_)
                if (token.StartsWith("lwb_sk_"))
                {
                    var (valid, userId, tokenId) = await tokenService.ValidateTokenAsync(token);

                    if (valid && userId != null)
                    {
                        var claims = new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, userId),
                            new Claim("TokenId", tokenId ?? ""),
                            new Claim("AuthType", "ApiToken")
                        };

                        var identity = new ClaimsIdentity(claims, "ApiToken");
                        context.User = new ClaimsPrincipal(identity);
                    }
                }
            }
        }

        await _next(context);
    }
}
