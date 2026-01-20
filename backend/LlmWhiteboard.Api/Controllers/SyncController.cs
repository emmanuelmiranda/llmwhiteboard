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

    public SyncController(ISessionService sessionService, IMachineService machineService)
    {
        _sessionService = sessionService;
        _machineService = machineService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    /// <summary>
    /// Receive sync events from Claude Code hooks (CLI)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SyncResponse>> Sync([FromBody] SyncPayload payload)
    {
        var userId = GetUserId();

        // Ensure machine exists
        var machine = await _machineService.GetOrCreateMachineAsync(userId, payload.MachineId);

        // Get or create session
        var session = await _sessionService.GetOrCreateSessionAsync(
            userId,
            machine.Id,
            payload.LocalSessionId,
            payload.ProjectPath);

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
        }

        // Add event
        await _sessionService.AddEventAsync(
            session.Id,
            payload.Event.Type,
            payload.Event.ToolName,
            payload.Event.Summary,
            payload.Event.Metadata);

        return Ok(new SyncResponse
        {
            Success = true,
            SessionId = session.Id
        });
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
            ""); // Project path should already exist

        // Decode content
        var content = Convert.FromBase64String(request.Content);

        // Verify checksum
        var computedChecksum = Convert.ToHexString(SHA256.HashData(content)).ToLower();
        if (computedChecksum != request.Checksum.ToLower())
        {
            return BadRequest(new { error = "Checksum mismatch" });
        }

        // Save transcript
        await _sessionService.UpsertTranscriptAsync(
            session.Id,
            content,
            request.IsEncrypted,
            request.Checksum);

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
            Content = Convert.ToBase64String(session.Transcript.Content),
            IsEncrypted = session.Transcript.IsEncrypted,
            Checksum = session.Transcript.Checksum,
            SizeBytes = session.Transcript.SizeBytes
        });
    }

    /// <summary>
    /// List sessions (CLI)
    /// </summary>
    [HttpGet("sessions")]
    public async Task<ActionResult<SessionListResponse>> ListSessions(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        var userId = GetUserId();

        SessionStatus? statusEnum = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SessionStatus>(status, true, out var parsed))
        {
            statusEnum = parsed;
        }

        var (sessions, total) = await _sessionService.ListSessionsAsync(userId, new SessionListQuery
        {
            Search = search,
            Status = statusEnum,
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
                Machine = s.Machine != null ? new MachineDto
                {
                    Id = s.Machine.Id,
                    MachineId = s.Machine.MachineId,
                    Name = s.Machine.Name
                } : null,
                HasTranscript = s.Transcript != null,
                IsEncrypted = s.Transcript?.IsEncrypted ?? false,
                EventCount = s.Events.Count,
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
