using LlmWhiteboard.Api.Dtos;

namespace LlmWhiteboard.Api.Services;

public interface ISessionNotificationService
{
    /// <summary>
    /// Notify when a new session is created
    /// </summary>
    Task NotifySessionCreatedAsync(string userId, SessionDto session);

    /// <summary>
    /// Notify when a session is updated
    /// </summary>
    Task NotifySessionUpdatedAsync(string userId, string sessionId, SessionDto session);

    /// <summary>
    /// Notify when a session is deleted
    /// </summary>
    Task NotifySessionDeletedAsync(string userId, string sessionId);

    /// <summary>
    /// Notify when a new event is added to a session
    /// </summary>
    Task NotifyNewEventAsync(string userId, string sessionId, SessionEventDto eventDto);
}
