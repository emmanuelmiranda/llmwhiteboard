using System.Security.Claims;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly ISessionService _sessionService;

    public SessionsController(ISessionService sessionService)
    {
        _sessionService = sessionService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    [HttpGet]
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
            Sessions = sessions.Select(s => MapToDto(s, eventCounts.GetValueOrDefault(s.Id, 0))).ToList(),
            Total = total,
            Limit = limit,
            Offset = offset
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SessionDetailDto>> GetSession(string id)
    {
        var userId = GetUserId();
        var session = await _sessionService.GetSessionAsync(id, userId);

        if (session == null)
        {
            return NotFound(new { error = "Session not found" });
        }

        return Ok(MapToDetailDto(session));
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<SessionDto>> UpdateSession(string id, [FromBody] SessionUpdateDto update)
    {
        var userId = GetUserId();

        try
        {
            var session = await _sessionService.UpdateSessionAsync(id, userId, update);
            return Ok(MapToDto(session));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Session not found" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteSession(string id)
    {
        var userId = GetUserId();
        var deleted = await _sessionService.DeleteSessionAsync(id, userId);

        if (!deleted)
        {
            return NotFound(new { error = "Session not found" });
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get paginated events for a session
    /// </summary>
    [HttpGet("{id}/events")]
    public async Task<ActionResult<SessionEventsResponse>> GetSessionEvents(
        string id,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        var userId = GetUserId();

        var (events, total) = await _sessionService.GetSessionEventsAsync(id, userId, limit, offset);

        return Ok(new SessionEventsResponse
        {
            Events = events.Select(e => new SessionEventDto
            {
                Id = e.Id,
                SessionId = e.SessionId,
                EventType = e.EventType,
                ToolName = e.ToolName,
                Summary = e.Summary,
                Metadata = e.Metadata != null ? System.Text.Json.JsonSerializer.Deserialize<object>(e.Metadata.RootElement.GetRawText()) : null,
                CreatedAt = e.CreatedAt
            }).ToList(),
            Total = total,
            Limit = limit,
            Offset = offset
        });
    }

    /// <summary>
    /// Get snapshots for a session (for time-travel resume)
    /// </summary>
    [HttpGet("{id}/snapshots")]
    public async Task<ActionResult<SnapshotListResponse>> GetSessionSnapshots(string id)
    {
        var userId = GetUserId();

        var snapshots = await _sessionService.GetSnapshotsAsync(id, userId);

        return Ok(new SnapshotListResponse
        {
            Snapshots = snapshots.Select(s => new SnapshotDto
            {
                Id = s.Id,
                SessionId = s.SessionId,
                CompactionCycle = s.CompactionCycle,
                Type = s.Type.ToString(),
                SizeBytes = s.SizeBytes,
                ContextPercentage = s.ContextPercentage,
                IsEncrypted = s.IsEncrypted,
                CreatedAt = s.CreatedAt
            }).ToList()
        });
    }

    private static SessionDto MapToDto(Session session, int? eventCount = null)
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

    private static SessionDetailDto MapToDetailDto(Session session)
    {
        // Events are loaded separately via GET /sessions/{id}/events for pagination
        return new SessionDetailDto
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
            CompactionCount = session.CompactionCount,
            TotalTokensUsed = session.TotalTokensUsed,
            LastActivityAt = session.LastActivityAt,
            CreatedAt = session.CreatedAt,
            Transcript = session.Transcript != null ? new TranscriptInfoDto
            {
                Id = session.Transcript.Id,
                IsEncrypted = session.Transcript.IsEncrypted,
                SizeBytes = session.Transcript.SizeBytes,
                UploadedAt = session.Transcript.UploadedAt
            } : null
        };
    }
}
