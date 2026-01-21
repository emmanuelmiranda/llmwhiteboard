using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Services;

public interface ISessionService
{
    Task<Session> GetOrCreateSessionAsync(string userId, string machineId, string localSessionId, string projectPath);
    Task<Session?> GetSessionAsync(string sessionId, string userId);
    Task<(List<Session> Sessions, int Total, Dictionary<string, int> EventCounts)> ListSessionsAsync(string userId, SessionListQuery query);
    Task<Session> UpdateSessionAsync(string sessionId, string userId, SessionUpdateDto update);
    Task<bool> DeleteSessionAsync(string sessionId, string userId);
    Task<SessionEvent> AddEventAsync(string sessionId, string eventType, string? toolName, string? summary, object? metadata);
    Task<List<SessionEvent>> GetEventsAsync(string userId, int limit, int offset, string? sessionId = null);
    Task<(List<SessionEvent> Events, int Total)> GetSessionEventsAsync(string sessionId, string userId, int limit, int offset);
    Task UpsertTranscriptAsync(string sessionId, byte[] content, bool isEncrypted, string checksum);
    Task<SessionTranscript?> GetTranscriptAsync(string sessionId, string userId);
    Task IncrementCompactionCountAsync(string sessionId, long? tokensUsed = null);
    Task<TimeSpan?> GetElapsedTimeSinceStartAsync(string sessionId);

    // Snapshot methods
    Task SavePeriodicSnapshotAsync(string sessionId, byte[] content, bool isEncrypted, string checksum);
    Task ProcessCompactionAsync(string sessionId);
    Task<List<TranscriptSnapshot>> GetSnapshotsAsync(string sessionId, string userId);
    Task<TranscriptSnapshot?> GetSnapshotByIdAsync(string snapshotId, string userId);
}

public class SessionListQuery
{
    public string? Search { get; set; }
    public SessionStatus? Status { get; set; }
    public int Limit { get; set; } = 50;
    public int Offset { get; set; } = 0;
}
