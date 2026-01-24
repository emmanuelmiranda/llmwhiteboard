using System.Security.Claims;
using LlmWhiteboard.Api.Services;

namespace LlmWhiteboard.Api.Middleware;

public class ShareTokenAuthMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly string[] PublicPaths = { "/api/public", "/hubs/public" };

    public ShareTokenAuthMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IShareTokenService shareTokenService)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";
        var isPublicEndpoint = PublicPaths.Any(p => path.StartsWith(p));

        if (isPublicEndpoint && !context.User.Identity?.IsAuthenticated == true)
        {
            // Try to get token from query string first, then header
            var token = context.Request.Query["token"].FirstOrDefault()
                ?? context.Request.Headers["X-Share-Token"].FirstOrDefault();

            if (!string.IsNullOrEmpty(token) && token.StartsWith("lwb_sh_"))
            {
                var shareToken = await shareTokenService.ValidateTokenAsync(token);

                if (shareToken != null)
                {
                    // Record access (fire and forget to not block request)
                    _ = shareTokenService.RecordAccessAsync(shareToken.Id);

                    var claims = new List<Claim>
                    {
                        new("ShareTokenId", shareToken.Id),
                        new("ShareUserId", shareToken.UserId),
                        new("ShareScope", shareToken.Scope.ToString()),
                        new("ShareVisibility", shareToken.Visibility.ToString()),
                        new("AuthType", "ShareToken")
                    };

                    if (!string.IsNullOrEmpty(shareToken.SessionId))
                    {
                        claims.Add(new Claim("ShareSessionId", shareToken.SessionId));
                    }

                    var identity = new ClaimsIdentity(claims, "ShareToken");
                    context.User = new ClaimsPrincipal(identity);
                }
            }
        }

        await _next(context);
    }
}
