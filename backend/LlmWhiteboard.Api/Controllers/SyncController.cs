using System.Security.Claims;
using System.Security.Cryptography;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly ISessionService _sessionService;
    private readonly IMachineService _machineService;
    private readonly ISessionNotificationService _notificationService;

    public SyncController(
        ISessionService sessionService,
        IMachineService machineService,
        ISessionNotificationService notificationService)
    {
        _sessionService = sessionService;
        _machineService = machineService;
        _notificationService = notificationService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    /// <summary>
    /// Receive sync events from LLM CLI hooks (Claude Code, Gemini CLI, etc.)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SyncResponse>> Sync([FromBody] SyncPayload payload)
    {
        var userId = GetUserId();

        // Ensure machine exists
        var machine = await _machineService.GetOrCreateMachineAsync(userId, payload.MachineId);

        // Get or create session
        var sessionCreatedBefore = DateTime.UtcNow;
        var session = await _sessionService.GetOrCreateSessionAsync(
            userId,
            machine.Id,
            payload.LocalSessionId,
            payload.ProjectPath,
            payload.CliType);

        // Check if this is a newly created session (created within last 5 seconds)
        var isNewSession = session.CreatedAt >= sessionCreatedBefore.AddSeconds(-5);

        // Set title from suggested title if session has no title yet
        if (string.IsNullOrEmpty(session.Title) && !string.IsNullOrEmpty(payload.SuggestedTitle))
        {
            await _sessionService.UpdateSessionAsync(session.Id, userId, new SessionUpdateDto
            {
                Title = payload.SuggestedTitle
            });
        }

        // Update session status based on event type
        var eventType = payload.Event.Type.ToLower();
        var statusUpdate = eventType switch
        {
            "session_end" => SessionStatus.Paused,
            "session_start" => SessionStatus.Active,
            _ => (SessionStatus?)null
        };

        if (statusUpdate.HasValue)
        {
            await _sessionService.UpdateSessionAsync(session.Id, userId, new SessionUpdateDto
            {
                Status = statusUpdate.Value
            });
        }

        // Track compaction (auto-compact) events
        if (eventType == "compaction" || eventType == "auto_compact" || eventType == "context_compaction")
        {
            long? tokensUsed = null;
            if (payload.Event.Metadata?.TryGetValue("tokensUsed", out var tokens) == true)
            {
                if (tokens is long l) tokensUsed = l;
                else if (tokens is int i) tokensUsed = i;
                else if (tokens is double d) tokensUsed = (long)d;
            }
            await _sessionService.IncrementCompactionCountAsync(session.Id, tokensUsed);

            // Process compaction: create checkpoint & delta snapshots, cleanup periodic snapshots
            await _sessionService.ProcessCompactionAsync(session.Id);
        }

        // Enrich stop events with elapsed time since session start
        var eventSummary = payload.Event.Summary;
        var eventMetadata = payload.Event.Metadata;
        if (eventType == "stop")
        {
            var elapsedTime = await _sessionService.GetElapsedTimeSinceStartAsync(session.Id);
            if (elapsedTime.HasValue)
            {
                var elapsed = elapsedTime.Value;
                var elapsedStr = elapsed.TotalHours >= 1
                    ? $"{(int)elapsed.TotalHours}h {elapsed.Minutes}m"
                    : elapsed.TotalMinutes >= 1
                        ? $"{(int)elapsed.TotalMinutes}m {elapsed.Seconds}s"
                        : $"{elapsed.Seconds}s";
                eventSummary = $"Session paused after {elapsedStr}";
                eventMetadata = new Dictionary<string, object>(eventMetadata ?? new Dictionary<string, object>())
                {
                    ["elapsedSeconds"] = (int)elapsed.TotalSeconds
                };
            }
        }

        // Add event
        var newEvent = await _sessionService.AddEventAsync(
            session.Id,
            payload.Event.Type,
            payload.Event.ToolName,
            eventSummary,
            eventMetadata);

        // Send real-time notifications
        // Reload session to get updated data (including event count, last activity)
        var updatedSession = await _sessionService.GetSessionAsync(session.Id, userId);
        if (updatedSession != null)
        {
            var sessionDto = MapToSessionDto(updatedSession);

            if (isNewSession)
            {
                // Notify about new session
                await _notificationService.NotifySessionCreatedAsync(userId, sessionDto);
            }
            else
            {
                // Notify about session update (status change, title update, etc.)
                await _notificationService.NotifySessionUpdatedAsync(userId, session.Id, sessionDto);
            }

            // Notify about new event
            var eventDto = new SessionEventDto
            {
                Id = newEvent.Id,
                SessionId = newEvent.SessionId,
                EventType = newEvent.EventType,
                ToolName = newEvent.ToolName,
                Summary = newEvent.Summary,
                Metadata = newEvent.Metadata != null
                    ? System.Text.Json.JsonSerializer.Deserialize<object>(newEvent.Metadata.RootElement.GetRawText())
                    : null,
                CreatedAt = newEvent.CreatedAt
            };
            await _notificationService.NotifyNewEventAsync(userId, session.Id, eventDto);
        }

        return Ok(new SyncResponse
        {
            Success = true,
            SessionId = session.Id
        });
    }

    private static SessionDto MapToSessionDto(Session session, int? eventCount = null)
    {
        return new SessionDto
        {
            Id = session.Id,
            LocalSessionId = session.LocalSessionId,
            ProjectPath = session.ProjectPath,
            Title = session.Title,
            Description = session.Description,
            Status = session.Status.ToString(),
            Tags = session.Tags,
            CliType = session.CliType,
            Machine = session.Machine != null ? new MachineDto
            {
                Id = session.Machine.Id,
                MachineId = session.Machine.MachineId,
                Name = session.Machine.Name
            } : null,
            HasTranscript = session.Transcript != null,
            IsEncrypted = session.Transcript?.IsEncrypted ?? false,
            TranscriptSizeBytes = session.Transcript?.SizeBytes ?? 0,
            EventCount = eventCount ?? session.Events.Count,
            CompactionCount = session.CompactionCount,
            TotalTokensUsed = session.TotalTokensUsed,
            LastActivityAt = session.LastActivityAt,
            CreatedAt = session.CreatedAt
        };
    }

    /// <summary>
    /// Upload session transcript (CLI)
    /// </summary>
    [HttpPost("transcript")]
    public async Task<ActionResult<TranscriptUploadResponse>> UploadTranscript([FromBody] TranscriptUploadRequest request)
    {
        var userId = GetUserId();

        // Get machine
        var machine = await _machineService.GetOrCreateMachineAsync(userId, request.MachineId);

        // Find session
        var session = await _sessionService.GetOrCreateSessionAsync(
            userId,
            machine.Id,
            request.LocalSessionId,
            "", // Project path should already exist
            request.CliType);

        // Decode content
        var content = Convert.FromBase64String(request.Content);

        // Verify checksum
        var computedChecksum = Convert.ToHexString(SHA256.HashData(content)).ToLower();
        if (computedChecksum != request.Checksum.ToLower())
        {
            return BadRequest(new { error = "Checksum mismatch" });
        }

        // Save transcript (latest version)
        await _sessionService.UpsertTranscriptAsync(
            session.Id,
            content,
            request.IsEncrypted,
            request.Checksum);

        // Also save as periodic snapshot for compaction history
        await _sessionService.SavePeriodicSnapshotAsync(
            session.Id,
            content,
            request.IsEncrypted,
            request.Checksum);

        // Update session title if not set and suggested title provided
        if (string.IsNullOrEmpty(session.Title) && !string.IsNullOrEmpty(request.SuggestedTitle))
        {
            await _sessionService.UpdateSessionAsync(session.Id, userId, new SessionUpdateDto
            {
                Title = request.SuggestedTitle
            });
        }

        return Ok(new TranscriptUploadResponse
        {
            Success = true,
            SessionId = session.Id,
            SizeBytes = content.Length
        });
    }

    /// <summary>
    /// Download session transcript (CLI)
    /// </summary>
    [HttpGet("transcript/{sessionId}")]
    public async Task<ActionResult<TranscriptDownloadResponse>> DownloadTranscript(string sessionId)
    {
        var userId = GetUserId();

        var session = await _sessionService.GetSessionAsync(sessionId, userId);
        if (session == null)
        {
            return NotFound(new { error = "Session not found" });
        }

        if (session.Transcript == null)
        {
            return NotFound(new { error = "No transcript available" });
        }

        return Ok(new TranscriptDownloadResponse
        {
            SessionId = session.Id,
            LocalSessionId = session.LocalSessionId,
            ProjectPath = session.ProjectPath,
            MachineId = session.Machine?.MachineId,
            CliType = session.CliType,
            Content = Convert.ToBase64String(session.Transcript.Content),
            IsEncrypted = session.Transcript.IsEncrypted,
            Checksum = session.Transcript.Checksum,
            SizeBytes = session.Transcript.SizeBytes
        });
    }

    /// <summary>
    /// Download a specific snapshot (CLI)
    /// </summary>
    [HttpGet("snapshot/{snapshotId}")]
    public async Task<ActionResult<TranscriptDownloadResponse>> DownloadSnapshot(string snapshotId)
    {
        var userId = GetUserId();

        var snapshot = await _sessionService.GetSnapshotByIdAsync(snapshotId, userId);
        if (snapshot == null)
        {
            return NotFound(new { error = "Snapshot not found" });
        }

        return Ok(new TranscriptDownloadResponse
        {
            SessionId = snapshot.SessionId,
            LocalSessionId = snapshot.Session.LocalSessionId,
            ProjectPath = snapshot.Session.ProjectPath,
            MachineId = snapshot.Session.Machine?.MachineId,
            CliType = snapshot.Session.CliType,
            Content = Convert.ToBase64String(snapshot.Content),
            IsEncrypted = snapshot.IsEncrypted,
            Checksum = snapshot.Checksum,
            SizeBytes = snapshot.SizeBytes
        });
    }

    /// <summary>
    /// List sessions (CLI)
    /// </summary>
    [HttpGet("sessions")]
    public async Task<ActionResult<SessionListResponse>> ListSessions(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? cliType,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        var userId = GetUserId();

        SessionStatus? statusEnum = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SessionStatus>(status, true, out var parsed))
        {
            statusEnum = parsed;
        }

        var (sessions, total, eventCounts) = await _sessionService.ListSessionsAsync(userId, new SessionListQuery
        {
            Search = search,
            Status = statusEnum,
            CliType = cliType,
            Limit = limit,
            Offset = offset
        });

        return Ok(new SessionListResponse
        {
            Sessions = sessions.Select(s => new SessionDto
            {
                Id = s.Id,
                LocalSessionId = s.LocalSessionId,
                ProjectPath = s.ProjectPath,
                Title = s.Title,
                Description = s.Description,
                Status = s.Status.ToString(),
                Tags = s.Tags,
                CliType = s.CliType,
                Machine = s.Machine != null ? new MachineDto
                {
                    Id = s.Machine.Id,
                    MachineId = s.Machine.MachineId,
                    Name = s.Machine.Name
                } : null,
                HasTranscript = s.Transcript != null,
                IsEncrypted = s.Transcript?.IsEncrypted ?? false,
                EventCount = eventCounts.GetValueOrDefault(s.Id, 0),
                CompactionCount = s.CompactionCount,
                TotalTokensUsed = s.TotalTokensUsed,
                LastActivityAt = s.LastActivityAt,
                CreatedAt = s.CreatedAt
            }).ToList(),
            Total = total,
            Limit = limit,
            Offset = offset
        });
    }
}
