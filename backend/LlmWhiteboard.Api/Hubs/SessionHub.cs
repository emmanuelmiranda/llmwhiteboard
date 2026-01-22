using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LlmWhiteboard.Api.Hubs;

[Authorize]
public class SessionHub : Hub
{
    private string GetUserId() =>
        Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new HubException("User not authenticated");

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        // Add user to their personal group for user-wide updates
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user:{userId}");
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribe to session-specific updates
    /// </summary>
    public async Task JoinSession(string sessionId)
    {
        var userId = GetUserId();
        // Add to session-specific group
        await Groups.AddToGroupAsync(Context.ConnectionId, $"session:{sessionId}");
    }

    /// <summary>
    /// Unsubscribe from session-specific updates
    /// </summary>
    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session:{sessionId}");
    }
}
