using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace LlmWhiteboard.Api.Services;

public class SessionNotificationService : ISessionNotificationService
{
    private readonly IHubContext<SessionHub> _hubContext;

    public SessionNotificationService(IHubContext<SessionHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifySessionCreatedAsync(string userId, SessionDto session)
    {
        // Notify user group
        await _hubContext.Clients.Group($"user:{userId}")
            .SendAsync("SessionCreated", session);
    }

    public async Task NotifySessionUpdatedAsync(string userId, string sessionId, SessionDto session)
    {
        // Notify user group and session group
        var tasks = new[]
        {
            _hubContext.Clients.Group($"user:{userId}")
                .SendAsync("SessionUpdated", session),
            _hubContext.Clients.Group($"session:{sessionId}")
                .SendAsync("SessionUpdated", session)
        };

        await Task.WhenAll(tasks);
    }

    public async Task NotifySessionDeletedAsync(string userId, string sessionId)
    {
        // Notify user group and session group
        var tasks = new[]
        {
            _hubContext.Clients.Group($"user:{userId}")
                .SendAsync("SessionDeleted", sessionId),
            _hubContext.Clients.Group($"session:{sessionId}")
                .SendAsync("SessionDeleted", sessionId)
        };

        await Task.WhenAll(tasks);
    }

    public async Task NotifyNewEventAsync(string userId, string sessionId, SessionEventDto eventDto)
    {
        // Notify user group and session group
        var tasks = new[]
        {
            _hubContext.Clients.Group($"user:{userId}")
                .SendAsync("NewEvent", eventDto),
            _hubContext.Clients.Group($"session:{sessionId}")
                .SendAsync("NewEvent", eventDto)
        };

        await Task.WhenAll(tasks);
    }
}
