using System.Security.Claims;
using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PublicController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IShareTokenService _shareTokenService;

    public PublicController(AppDbContext db, IShareTokenService shareTokenService)
    {
        _db = db;
        _shareTokenService = shareTokenService;
    }

    private string? GetShareUserId() =>
        User.FindFirstValue("ShareUserId");

    private string? GetShareSessionId() =>
        User.FindFirstValue("ShareSessionId");

    private ShareScope? GetShareScope()
    {
        var scopeStr = User.FindFirstValue("ShareScope");
        if (string.IsNullOrEmpty(scopeStr)) return null;
        return Enum.TryParse<ShareScope>(scopeStr, out var scope) ? scope : null;
    }

    private ShareVisibility? GetShareVisibility()
    {
        var visStr = User.FindFirstValue("ShareVisibility");
        if (string.IsNullOrEmpty(visStr)) return null;
        return Enum.TryParse<ShareVisibility>(visStr, out var vis) ? vis : null;
    }

    private bool IsAuthorized()
    {
        return User.FindFirstValue("AuthType") == "ShareToken";
    }

    /// <summary>
    /// Validate share token and return scope/visibility info
    /// </summary>
    [HttpGet("validate")]
    public async Task<ActionResult<ValidateShareResponse>> ValidateToken([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
        {
            return Ok(new ValidateShareResponse { Valid = false });
        }

        var shareToken = await _shareTokenService.ValidateTokenAsync(token);

        if (shareToken == null)
        {
            return Ok(new ValidateShareResponse { Valid = false });
        }

        return Ok(new ValidateShareResponse
        {
            Valid = true,
            Scope = shareToken.Scope.ToString(),
            Visibility = shareToken.Visibility.ToString(),
            SessionId = shareToken.SessionId,
            UserId = shareToken.UserId,
            UserName = shareToken.User?.Name
        });
    }

    /// <summary>
    /// Get user's sessions (UserFeed scope only)
    /// </summary>
    [HttpGet("feed")]
    public async Task<ActionResult<PublicSessionListResponse>> GetFeed([FromQuery] int limit = 50)
    {
        if (!IsAuthorized())
        {
            return Unauthorized(new { error = "Invalid share token" });
        }

        var scope = GetShareScope();
        var visibility = GetShareVisibility();
        var shareUserId = GetShareUserId();

        if (scope != ShareScope.UserFeed || string.IsNullOrEmpty(shareUserId))
        {
            return Forbid();
        }

        var sessions = await _db.Sessions
            .Include(s => s.Machine)
            .Where(s => s.UserId == shareUserId)
            .OrderByDescending(s => s.LastActivityAt)
            .Take(limit)
            .ToListAsync();

        var total = await _db.Sessions.CountAsync(s => s.UserId == shareUserId);

        // Get event counts
        var sessionIds = sessions.Select(s => s.Id).ToList();
        var eventCounts = await _db.SessionEvents
            .Where(e => sessionIds.Contains(e.SessionId))
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count);

        return Ok(new PublicSessionListResponse
        {
            Sessions = sessions.Select(s => MapToPublicDto(s, visibility ?? ShareVisibility.ActivityOnly, eventCounts.GetValueOrDefault(s.Id, 0))).ToList(),
            Total = total
        });
    }

    /// <summary>
    /// Get session detail
    /// </summary>
    [HttpGet("session/{id}")]
    public async Task<ActionResult<PublicSessionDto>> GetSession(string id)
    {
        if (!IsAuthorized())
        {
            return Unauthorized(new { error = "Invalid share token" });
        }

        var scope = GetShareScope();
        var visibility = GetShareVisibility();
        var shareUserId = GetShareUserId();
        var shareSessionId = GetShareSessionId();

        // Validate access
        if (scope == ShareScope.Session && shareSessionId != id)
        {
            return Forbid();
        }

        var session = await _db.Sessions
            .Include(s => s.Machine)
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == shareUserId);

        if (session == null)
        {
            return NotFound(new { error = "Session not found" });
        }

        var eventCount = await _db.SessionEvents.CountAsync(e => e.SessionId == id);

        return Ok(MapToPublicDto(session, visibility ?? ShareVisibility.ActivityOnly, eventCount));
    }

    /// <summary>
    /// Get session events (paginated)
    /// </summary>
    [HttpGet("session/{id}/events")]
    public async Task<ActionResult<PublicEventsResponse>> GetSessionEvents(
        string id,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        if (!IsAuthorized())
        {
            return Unauthorized(new { error = "Invalid share token" });
        }

        var scope = GetShareScope();
        var visibility = GetShareVisibility();
        var shareUserId = GetShareUserId();
        var shareSessionId = GetShareSessionId();

        // Validate access
        if (scope == ShareScope.Session && shareSessionId != id)
        {
            return Forbid();
        }

        // Verify session ownership
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == shareUserId);

        if (session == null)
        {
            return NotFound(new { error = "Session not found" });
        }

        var events = await _db.SessionEvents
            .Where(e => e.SessionId == id)
            .OrderByDescending(e => e.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        var total = await _db.SessionEvents.CountAsync(e => e.SessionId == id);

        return Ok(new PublicEventsResponse
        {
            Events = events.Select(e => MapToPublicEventDto(e, visibility ?? ShareVisibility.ActivityOnly)).ToList(),
            Total = total,
            Limit = limit,
            Offset = offset
        });
    }

    private static PublicSessionDto MapToPublicDto(Session session, ShareVisibility visibility, int eventCount)
    {
        var dto = new PublicSessionDto
        {
            Id = session.Id,
            Title = session.Title,
            Status = session.Status.ToString(),
            CliType = session.CliType,
            EventCount = eventCount,
            LastActivityAt = session.LastActivityAt,
            CreatedAt = session.CreatedAt
        };

        // Include sensitive data only in Full visibility mode
        if (visibility == ShareVisibility.Full)
        {
            dto.ProjectPath = session.ProjectPath;
            dto.Description = session.Description;
            dto.Tags = session.Tags;
            dto.MachineName = session.Machine?.Name;
        }

        return dto;
    }

    private static PublicEventDto MapToPublicEventDto(SessionEvent evt, ShareVisibility visibility)
    {
        var dto = new PublicEventDto
        {
            Id = evt.Id,
            SessionId = evt.SessionId,
            EventType = evt.EventType,
            ToolName = evt.ToolName,
            CreatedAt = evt.CreatedAt
        };

        // Include sensitive data only in Full visibility mode
        if (visibility == ShareVisibility.Full)
        {
            dto.Summary = evt.Summary;
            dto.Metadata = evt.Metadata != null
                ? System.Text.Json.JsonSerializer.Deserialize<object>(evt.Metadata.RootElement.GetRawText())
                : null;
        }

        return dto;
    }
}
