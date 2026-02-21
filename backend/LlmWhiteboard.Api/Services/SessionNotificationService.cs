using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Hubs;
using LlmWhiteboard.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Services;

public class SessionNotificationService : ISessionNotificationService
{
    private readonly IHubContext<SessionHub> _hubContext;
    private readonly IHubContext<PublicSessionHub> _publicHubContext;
    private readonly AppDbContext _db;

    public SessionNotificationService(
        IHubContext<SessionHub> hubContext,
        IHubContext<PublicSessionHub> publicHubContext,
        AppDbContext db)
    {
        _hubContext = hubContext;
        _publicHubContext = publicHubContext;
        _db = db;
    }

    public async Task NotifySessionCreatedAsync(string userId, SessionDto session)
    {
        // Notify user group
        await _hubContext.Clients.Group($"user:{userId}")
            .SendAsync("SessionCreated", session);

        // Notify team groups (new sessions default to non-private, but check anyway)
        var dbSession = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == session.Id);
        if (dbSession != null && !dbSession.IsPrivate)
        {
            await NotifyTeamGroupsAsync(userId, "TeamSessionCreated", session);
        }
    }

    public async Task NotifySessionUpdatedAsync(string userId, string sessionId, SessionDto session)
    {
        // Notify user group and session group
        var tasks = new List<Task>
        {
            _hubContext.Clients.Group($"user:{userId}")
                .SendAsync("SessionUpdated", session),
            _hubContext.Clients.Group($"session:{sessionId}")
                .SendAsync("SessionUpdated", session)
        };

        // Check if the session is private before notifying team groups
        var dbSession = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (dbSession != null && !dbSession.IsPrivate)
        {
            tasks.Add(NotifyTeamGroupsAsync(userId, "TeamSessionUpdated", session));
        }

        await Task.WhenAll(tasks);
    }

    public async Task NotifySessionDeletedAsync(string userId, string sessionId)
    {
        // Notify user group and session group
        var tasks = new List<Task>
        {
            _hubContext.Clients.Group($"user:{userId}")
                .SendAsync("SessionDeleted", sessionId),
            _hubContext.Clients.Group($"session:{sessionId}")
                .SendAsync("SessionDeleted", sessionId)
        };

        // Notify team groups about deletion (always notify so team views can remove the session)
        tasks.Add(NotifyTeamGroupsAsync(userId, "TeamSessionDeleted", sessionId));

        await Task.WhenAll(tasks);
    }

    public async Task NotifyNewEventAsync(string userId, string sessionId, SessionEventDto eventDto)
    {
        // Notify user group and session group
        var tasks = new List<Task>
        {
            _hubContext.Clients.Group($"user:{userId}")
                .SendAsync("NewEvent", eventDto),
            _hubContext.Clients.Group($"session:{sessionId}")
                .SendAsync("NewEvent", eventDto)
        };

        // Check if the session is private before notifying team groups
        var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null && !session.IsPrivate)
        {
            tasks.Add(NotifyTeamGroupsAsync(userId, "TeamNewEvent", eventDto));
        }

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

    /// <summary>
    /// Send a notification to all team groups that contain the given user.
    /// </summary>
    private async Task NotifyTeamGroupsAsync(string userId, string method, object data)
    {
        var teamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        if (teamIds.Count == 0)
        {
            return;
        }

        var tasks = teamIds.Select(teamId =>
            _hubContext.Clients.Group($"team:{teamId}")
                .SendAsync(method, data));

        await Task.WhenAll(tasks);
    }
}
