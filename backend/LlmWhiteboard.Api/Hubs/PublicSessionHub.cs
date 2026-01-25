using System.Security.Claims;
using LlmWhiteboard.Api.Models;
using Microsoft.AspNetCore.SignalR;

namespace LlmWhiteboard.Api.Hubs;

/// <summary>
/// Public SignalR hub for share link viewers.
/// No [Authorize] attribute - authentication is done via share token in middleware.
/// </summary>
public class PublicSessionHub : Hub
{
    private string? GetShareTokenId() =>
        Context.User?.FindFirstValue("ShareTokenId");

    private string? GetShareUserId() =>
        Context.User?.FindFirstValue("ShareUserId");

    private string? GetShareSessionId() =>
        Context.User?.FindFirstValue("ShareSessionId");

    private ShareScope? GetShareScope()
    {
        var scopeStr = Context.User?.FindFirstValue("ShareScope");
        if (string.IsNullOrEmpty(scopeStr)) return null;
        return Enum.TryParse<ShareScope>(scopeStr, out var scope) ? scope : null;
    }

    private ShareVisibility? GetShareVisibility()
    {
        var visStr = Context.User?.FindFirstValue("ShareVisibility");
        if (string.IsNullOrEmpty(visStr)) return null;
        return Enum.TryParse<ShareVisibility>(visStr, out var vis) ? vis : null;
    }

    public override async Task OnConnectedAsync()
    {
        var shareTokenId = GetShareTokenId();

        if (string.IsNullOrEmpty(shareTokenId))
        {
            // No valid share token - reject connection
            Context.Abort();
            return;
        }

        var scope = GetShareScope();
        var shareUserId = GetShareUserId();
        var shareSessionId = GetShareSessionId();

        if (scope == ShareScope.Session && !string.IsNullOrEmpty(shareSessionId))
        {
            // Join session-specific public group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"public:session:{shareSessionId}");
        }
        else if (scope == ShareScope.UserFeed && !string.IsNullOrEmpty(shareUserId))
        {
            // Join user feed public group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"public:user:{shareUserId}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var scope = GetShareScope();
        var shareUserId = GetShareUserId();
        var shareSessionId = GetShareSessionId();

        if (scope == ShareScope.Session && !string.IsNullOrEmpty(shareSessionId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"public:session:{shareSessionId}");
        }
        else if (scope == ShareScope.UserFeed && !string.IsNullOrEmpty(shareUserId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"public:user:{shareUserId}");
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribe to a specific session.
    /// For Session scope: silently ignored (already joined on connect)
    /// For UserFeed scope: joins the specific session group
    /// </summary>
    public async Task JoinSession(string sessionId)
    {
        var scope = GetShareScope();
        var shareSessionId = GetShareSessionId();

        // Session scope shares are already joined to their session on connect
        if (scope == ShareScope.Session)
        {
            // Silently ignore - already in the right group
            return;
        }

        // UserFeed scope can join individual sessions
        await Groups.AddToGroupAsync(Context.ConnectionId, $"public:session:{sessionId}");
    }

    /// <summary>
    /// Unsubscribe from a specific session
    /// </summary>
    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"public:session:{sessionId}");
    }
}
