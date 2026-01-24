using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Hubs;
using LlmWhiteboard.Api.Models;
using Microsoft.AspNetCore.SignalR;

namespace LlmWhiteboard.Api.Services;

public class SessionNotificationService : ISessionNotificationService
{
    private readonly IHubContext<SessionHub> _hubContext;
    private readonly IHubContext<PublicSessionHub> _publicHubContext;

    public SessionNotificationService(
        IHubContext<SessionHub> hubContext,
        IHubContext<PublicSessionHub> publicHubContext)
    {
        _hubContext = hubContext;
        _publicHubContext = publicHubContext;
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

    public async Task NotifyPublicSessionUpdatedAsync(string userId, string sessionId, Session session)
    {
        // Create filtered DTOs for both visibility levels
        var fullDto = new PublicSessionDto
        {
            Id = session.Id,
            Title = session.Title,
            Status = session.Status.ToString(),
            CliType = session.CliType,
            EventCount = session.Events?.Count ?? 0,
            LastActivityAt = session.LastActivityAt,
            CreatedAt = session.CreatedAt,
            ProjectPath = session.ProjectPath,
            Description = session.Description,
            Tags = session.Tags,
            MachineName = session.Machine?.Name
        };

        var activityOnlyDto = new PublicSessionDto
        {
            Id = session.Id,
            Title = session.Title,
            Status = session.Status.ToString(),
            CliType = session.CliType,
            EventCount = session.Events?.Count ?? 0,
            LastActivityAt = session.LastActivityAt,
            CreatedAt = session.CreatedAt
        };

        // Notify public groups - viewers will receive based on their visibility level
        // For simplicity, we send activity-only to session groups (most restrictive by default)
        // The client can request full data via API if they have Full visibility
        var tasks = new[]
        {
            _publicHubContext.Clients.Group($"public:user:{userId}")
                .SendAsync("PublicSessionUpdated", activityOnlyDto),
            _publicHubContext.Clients.Group($"public:session:{sessionId}")
                .SendAsync("PublicSessionUpdated", activityOnlyDto)
        };

        await Task.WhenAll(tasks);
    }

    public async Task NotifyPublicNewEventAsync(string userId, string sessionId, SessionEvent evt)
    {
        // Create filtered DTOs for activity-only mode
        var activityOnlyDto = new PublicEventDto
        {
            Id = evt.Id,
            SessionId = evt.SessionId,
            EventType = evt.EventType,
            ToolName = evt.ToolName,
            CreatedAt = evt.CreatedAt
        };

        // Notify public groups with activity-only data
        var tasks = new[]
        {
            _publicHubContext.Clients.Group($"public:user:{userId}")
                .SendAsync("PublicNewEvent", activityOnlyDto),
            _publicHubContext.Clients.Group($"public:session:{sessionId}")
                .SendAsync("PublicNewEvent", activityOnlyDto)
        };

        await Task.WhenAll(tasks);
    }
}
