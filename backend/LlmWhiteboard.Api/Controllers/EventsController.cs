using System.Security.Claims;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly ISessionService _sessionService;

    public EventsController(ISessionService sessionService)
    {
        _sessionService = sessionService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    [HttpGet]
    public async Task<ActionResult<EventListResponse>> ListEvents(
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        [FromQuery] string? sessionId = null)
    {
        var userId = GetUserId();
        var events = await _sessionService.GetEventsAsync(userId, limit, offset, sessionId);

        return Ok(new EventListResponse
        {
            Events = events.Select(e => new SessionEventDto
            {
                Id = e.Id,
                SessionId = e.SessionId,
                EventType = e.EventType,
                ToolName = e.ToolName,
                Summary = e.Summary,
                CreatedAt = e.CreatedAt
            }).ToList()
        });
    }
}
