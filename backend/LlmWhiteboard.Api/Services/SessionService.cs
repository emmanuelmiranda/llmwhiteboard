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

    public async Task<Session> GetOrCreateSessionAsync(string userId, string machineId, string localSessionId, string projectPath, string? cliType = null)
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
            // Update cliType if provided and not already set (in case of migration from old client)
            if (!string.IsNullOrEmpty(cliType) && session.CliType == "claude-code" && cliType != "claude-code")
            {
                session.CliType = cliType;
            }
            await _db.SaveChangesAsync();
            return session;
        }

        session = new Session
        {
            UserId = userId,
            MachineId = machineId,
            LocalSessionId = localSessionId,
            ProjectPath = projectPath,
            Status = SessionStatus.Active,
            CliType = cliType ?? "claude-code"
        };

        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        return session;
    }

    public async Task<Session?> GetSessionAsync(string sessionId, string userId)
    {
        // Don't include Events here - they're loaded separately via GetSessionEventsAsync for pagination
        return await _db.Sessions
            .Include(s => s.Machine)
            .Include(s => s.Transcript)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
    }

    public async Task<(List<Session> Sessions, int Total, Dictionary<string, int> EventCounts)> ListSessionsAsync(string userId, SessionListQuery query)
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

        if (!string.IsNullOrEmpty(query.CliType))
        {
            baseQuery = baseQuery.Where(s => s.CliType == query.CliType);
        }

        var total = await baseQuery.CountAsync();

        var sessions = await baseQuery
            .Include(s => s.Machine)
            .Include(s => s.Transcript)
            .OrderByDescending(s => s.LastActivityAt)
            .Skip(query.Offset)
            .Take(Math.Min(query.Limit, 100))
            .ToListAsync();

        // Load event counts efficiently with a separate query
        var sessionIds = sessions.Select(s => s.Id).ToList();
        var eventCounts = await _db.SessionEvents
            .Where(e => sessionIds.Contains(e.SessionId))
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count);

        return (sessions, total, eventCounts);
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

    public async Task<TimeSpan?> GetElapsedTimeSinceStartAsync(string sessionId)
    {
        // Find the most recent session_start event
        var sessionStartEvent = await _db.SessionEvents
            .Where(e => e.SessionId == sessionId && e.EventType == "session_start")
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();

        if (sessionStartEvent == null)
        {
            // Fall back to session creation time
            var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId);
            if (session == null) return null;
            return DateTime.UtcNow - session.CreatedAt;
        }

        return DateTime.UtcNow - sessionStartEvent.CreatedAt;
    }

    public async Task SavePeriodicSnapshotAsync(string sessionId, byte[] content, bool isEncrypted, string checksum)
    {
        var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return;

        var snapshot = new TranscriptSnapshot
        {
            SessionId = sessionId,
            CompactionCycle = session.CompactionCount,
            Type = SnapshotType.Periodic,
            Content = content,
            IsEncrypted = isEncrypted,
            Checksum = checksum,
            SizeBytes = content.Length
        };

        _db.TranscriptSnapshots.Add(snapshot);
        await _db.SaveChangesAsync();
    }

    public async Task ProcessCompactionAsync(string sessionId)
    {
        var session = await _db.Sessions
            .Include(s => s.Transcript)
            .FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return;

        var previousCycle = session.CompactionCount - 1;
        if (previousCycle < 0) return;

        // Get all periodic snapshots from the previous compaction cycle
        var periodicSnapshots = await _db.TranscriptSnapshots
            .Where(s => s.SessionId == sessionId &&
                        s.CompactionCycle == previousCycle &&
                        s.Type == SnapshotType.Periodic)
            .OrderBy(s => s.SizeBytes)
            .ToListAsync();

        if (periodicSnapshots.Count == 0) return;

        // Find the largest snapshot (pre-compaction state)
        var largestSnapshot = periodicSnapshots.Last();
        var maxSize = largestSnapshot.SizeBytes;

        // Find ~80% checkpoint (largest snapshot that's <= 80% of max size)
        var targetSize = (int)(maxSize * 0.8);
        var checkpointSnapshot = periodicSnapshots
            .Where(s => s.SizeBytes <= targetSize)
            .OrderByDescending(s => s.SizeBytes)
            .FirstOrDefault();

        // If no good 80% candidate, use the smallest one
        checkpointSnapshot ??= periodicSnapshots.First();

        // Create the 80% checkpoint snapshot
        var checkpoint = new TranscriptSnapshot
        {
            SessionId = sessionId,
            CompactionCycle = previousCycle,
            Type = SnapshotType.Checkpoint,
            Content = checkpointSnapshot.Content,
            IsEncrypted = checkpointSnapshot.IsEncrypted,
            Checksum = checkpointSnapshot.Checksum,
            SizeBytes = checkpointSnapshot.SizeBytes,
            ContextPercentage = maxSize > 0 ? (int)((checkpointSnapshot.SizeBytes * 100) / maxSize) : 0
        };
        _db.TranscriptSnapshots.Add(checkpoint);

        // Create the delta (difference from checkpoint to pre-compaction)
        // For now, store the full pre-compaction content with a marker
        // In the future, we could compute an actual diff
        if (largestSnapshot.Id != checkpointSnapshot.Id)
        {
            var delta = new TranscriptSnapshot
            {
                SessionId = sessionId,
                CompactionCycle = previousCycle,
                Type = SnapshotType.Delta,
                Content = largestSnapshot.Content,
                IsEncrypted = largestSnapshot.IsEncrypted,
                Checksum = largestSnapshot.Checksum,
                SizeBytes = largestSnapshot.SizeBytes,
                ContextPercentage = 100
            };
            _db.TranscriptSnapshots.Add(delta);
        }

        // Create post-compaction snapshot from current transcript (if available)
        if (session.Transcript != null)
        {
            var postCompaction = new TranscriptSnapshot
            {
                SessionId = sessionId,
                CompactionCycle = session.CompactionCount, // Current cycle (post-compaction)
                Type = SnapshotType.PostCompaction,
                Content = session.Transcript.Content,
                IsEncrypted = session.Transcript.IsEncrypted,
                Checksum = session.Transcript.Checksum,
                SizeBytes = session.Transcript.SizeBytes,
                ContextPercentage = 0
            };
            _db.TranscriptSnapshots.Add(postCompaction);
        }

        // Delete all periodic snapshots from the previous cycle
        _db.TranscriptSnapshots.RemoveRange(periodicSnapshots);

        await _db.SaveChangesAsync();
    }

    public async Task<List<TranscriptSnapshot>> GetSnapshotsAsync(string sessionId, string userId)
    {
        // Verify session belongs to user
        var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session == null) return new List<TranscriptSnapshot>();

        return await _db.TranscriptSnapshots
            .Where(s => s.SessionId == sessionId && s.Type != SnapshotType.Periodic)
            .OrderBy(s => s.CompactionCycle)
            .ThenBy(s => s.Type)
            .ToListAsync();
    }

    public async Task<TranscriptSnapshot?> GetSnapshotByIdAsync(string snapshotId, string userId)
    {
        return await _db.TranscriptSnapshots
            .Include(s => s.Session)
                .ThenInclude(s => s.Machine)
            .FirstOrDefaultAsync(s => s.Id == snapshotId && s.Session.UserId == userId);
    }
}
