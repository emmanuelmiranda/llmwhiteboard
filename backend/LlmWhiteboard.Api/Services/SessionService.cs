using System.Text.Json;
using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Services;

public class SessionService : ISessionService
{
    private readonly AppDbContext _db;

    public SessionService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Session> GetOrCreateSessionAsync(string userId, string machineId, string localSessionId, string projectPath)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s =>
                s.UserId == userId &&
                s.MachineId == machineId &&
                s.LocalSessionId == localSessionId);

        if (session != null)
        {
            session.LastActivityAt = DateTime.UtcNow;
            session.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return session;
        }

        session = new Session
        {
            UserId = userId,
            MachineId = machineId,
            LocalSessionId = localSessionId,
            ProjectPath = projectPath,
            Status = SessionStatus.Active
        };

        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        return session;
    }

    public async Task<Session?> GetSessionAsync(string sessionId, string userId)
    {
        return await _db.Sessions
            .Include(s => s.Machine)
            .Include(s => s.Transcript)
            .Include(s => s.Events.OrderByDescending(e => e.CreatedAt).Take(500))
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
    }

    public async Task<(List<Session> Sessions, int Total)> ListSessionsAsync(string userId, SessionListQuery query)
    {
        var baseQuery = _db.Sessions
            .Where(s => s.UserId == userId);

        if (query.Status.HasValue)
        {
            baseQuery = baseQuery.Where(s => s.Status == query.Status.Value);
        }

        if (!string.IsNullOrEmpty(query.Search))
        {
            var search = query.Search.ToLower();
            baseQuery = baseQuery.Where(s =>
                (s.Title != null && s.Title.ToLower().Contains(search)) ||
                (s.Description != null && s.Description.ToLower().Contains(search)) ||
                s.ProjectPath.ToLower().Contains(search) ||
                s.Tags.Contains(query.Search));
        }

        var total = await baseQuery.CountAsync();

        var sessions = await baseQuery
            .Include(s => s.Machine)
            .Include(s => s.Transcript)
            .OrderByDescending(s => s.LastActivityAt)
            .Skip(query.Offset)
            .Take(Math.Min(query.Limit, 100))
            .ToListAsync();

        // Load event counts separately for efficiency
        var sessionIds = sessions.Select(s => s.Id).ToList();
        var eventCounts = await _db.SessionEvents
            .Where(e => sessionIds.Contains(e.SessionId))
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count);

        return (sessions, total);
    }

    public async Task<Session> UpdateSessionAsync(string sessionId, string userId, SessionUpdateDto update)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId)
            ?? throw new KeyNotFoundException("Session not found");

        if (update.Title != null)
            session.Title = update.Title;

        if (update.Description != null)
            session.Description = update.Description;

        if (update.Status.HasValue)
            session.Status = update.Status.Value;

        if (update.Tags != null)
            session.Tags = update.Tags;

        session.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return session;
    }

    public async Task<bool> DeleteSessionAsync(string sessionId, string userId)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null)
            return false;

        _db.Sessions.Remove(session);
        await _db.SaveChangesAsync();

        return true;
    }

    public async Task<SessionEvent> AddEventAsync(string sessionId, string eventType, string? toolName, string? summary, object? metadata)
    {
        var sessionEvent = new SessionEvent
        {
            SessionId = sessionId,
            EventType = eventType,
            ToolName = toolName,
            Summary = summary,
            Metadata = metadata != null ? JsonDocument.Parse(JsonSerializer.Serialize(metadata)) : null
        };

        _db.SessionEvents.Add(sessionEvent);
        await _db.SaveChangesAsync();

        return sessionEvent;
    }

    public async Task<List<SessionEvent>> GetEventsAsync(string userId, int limit, int offset, string? sessionId = null)
    {
        var query = _db.SessionEvents
            .Include(e => e.Session)
            .Where(e => e.Session.UserId == userId);

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(e => e.SessionId == sessionId);
        }

        return await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip(offset)
            .Take(Math.Min(limit, 500))
            .ToListAsync();
    }

    public async Task<(List<SessionEvent> Events, int Total)> GetSessionEventsAsync(string sessionId, string userId, int limit, int offset)
    {
        // Verify session belongs to user
        var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session == null)
        {
            return (new List<SessionEvent>(), 0);
        }

        var query = _db.SessionEvents.Where(e => e.SessionId == sessionId);

        var total = await query.CountAsync();

        var events = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        return (events, total);
    }

    public async Task UpsertTranscriptAsync(string sessionId, byte[] content, bool isEncrypted, string checksum)
    {
        var transcript = await _db.SessionTranscripts
            .FirstOrDefaultAsync(t => t.SessionId == sessionId);

        if (transcript == null)
        {
            transcript = new SessionTranscript
            {
                SessionId = sessionId,
                Content = content,
                IsEncrypted = isEncrypted,
                Checksum = checksum,
                SizeBytes = content.Length
            };
            _db.SessionTranscripts.Add(transcript);
        }
        else
        {
            transcript.Content = content;
            transcript.IsEncrypted = isEncrypted;
            transcript.Checksum = checksum;
            transcript.SizeBytes = content.Length;
            transcript.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }

    public async Task<SessionTranscript?> GetTranscriptAsync(string sessionId, string userId)
    {
        return await _db.SessionTranscripts
            .Include(t => t.Session)
            .FirstOrDefaultAsync(t => t.SessionId == sessionId && t.Session.UserId == userId);
    }

    public async Task IncrementCompactionCountAsync(string sessionId, long? tokensUsed = null)
    {
        var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return;

        session.CompactionCount++;
        if (tokensUsed.HasValue)
        {
            session.TotalTokensUsed += tokensUsed.Value;
        }
        session.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }
}
