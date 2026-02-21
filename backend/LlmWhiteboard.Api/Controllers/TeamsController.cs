using System.Security.Claims;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TeamsController : ControllerBase
{
    private readonly ITeamService _teamService;

    public TeamsController(ITeamService teamService)
    {
        _teamService = teamService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    /// <summary>
    /// Create a new team
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CreateTeamResponse>> CreateTeam([FromBody] CreateTeamRequest request)
    {
        var userId = GetUserId();

        try
        {
            var team = await _teamService.CreateTeamAsync(userId, request);

            return Ok(new CreateTeamResponse
            {
                Id = team.Id,
                Name = team.Name,
                JoinCode = team.JoinCode
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// List user's teams
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<TeamListResponse>> GetTeams()
    {
        var userId = GetUserId();
        var teams = await _teamService.GetUserTeamsAsync(userId);

        return Ok(new TeamListResponse
        {
            Teams = teams.Select(t => new TeamDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                OwnerName = t.Owner.Name ?? t.Owner.Email,
                MemberCount = t.Members.Count,
                JoinCode = t.OwnerId == userId ? t.JoinCode : null,
                CreatedAt = t.CreatedAt
            }).ToList()
        });
    }

    /// <summary>
    /// Get team detail with members
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<TeamDetailDto>> GetTeamDetail(string id)
    {
        var userId = GetUserId();
        var team = await _teamService.GetTeamDetailAsync(id, userId);

        if (team == null)
        {
            return NotFound(new { error = "Team not found" });
        }

        return Ok(new TeamDetailDto
        {
            Id = team.Id,
            Name = team.Name,
            Description = team.Description,
            OwnerName = team.Owner.Name ?? team.Owner.Email,
            MemberCount = team.Members.Count,
            JoinCode = team.OwnerId == userId ? team.JoinCode : null,
            CreatedAt = team.CreatedAt,
            Members = team.Members.Select(m => new TeamMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                Name = m.User.Name,
                Email = m.User.Email,
                Image = m.User.Image,
                Role = m.Role,
                JoinedAt = m.JoinedAt
            }).OrderBy(m => m.Role == "Owner" ? 0 : 1).ThenBy(m => m.JoinedAt).ToList()
        });
    }

    /// <summary>
    /// Update team (owner only)
    /// </summary>
    [HttpPatch("{id}")]
    public async Task<ActionResult<TeamDto>> UpdateTeam(string id, [FromBody] UpdateTeamRequest request)
    {
        var userId = GetUserId();

        try
        {
            var team = await _teamService.UpdateTeamAsync(id, userId, request);

            return Ok(new TeamDto
            {
                Id = team.Id,
                Name = team.Name,
                Description = team.Description,
                OwnerName = team.Owner?.Name ?? "",
                CreatedAt = team.CreatedAt
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Team not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete team (owner only)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTeam(string id)
    {
        var userId = GetUserId();

        try
        {
            await _teamService.DeleteTeamAsync(id, userId);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Team not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Join a team using a join code (no team ID needed)
    /// </summary>
    [HttpPost("join")]
    public async Task<ActionResult> JoinTeam([FromBody] JoinTeamRequest request)
    {
        var userId = GetUserId();

        try
        {
            var member = await _teamService.JoinTeamAsync(userId, request.JoinCode);
            return Ok(new { success = true, teamId = member.TeamId });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Team not found or invalid join code." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Remove a member from a team (owner or self)
    /// </summary>
    [HttpDelete("{id}/members/{targetUserId}")]
    public async Task<ActionResult> RemoveMember(string id, string targetUserId)
    {
        var userId = GetUserId();

        try
        {
            await _teamService.RemoveMemberAsync(id, userId, targetUserId);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Leave a team (non-owner only)
    /// </summary>
    [HttpPost("{id}/leave")]
    public async Task<ActionResult> LeaveTeam(string id)
    {
        var userId = GetUserId();

        try
        {
            await _teamService.LeaveTeamAsync(id, userId);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Regenerate join code (owner only)
    /// </summary>
    [HttpPost("{id}/regenerate-code")]
    public async Task<ActionResult> RegenerateJoinCode(string id)
    {
        var userId = GetUserId();

        try
        {
            var newCode = await _teamService.RegenerateJoinCodeAsync(id, userId);
            return Ok(new { joinCode = newCode });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Team not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    /// <summary>
    /// List team sessions (with optional member filter)
    /// </summary>
    [HttpGet("{id}/sessions")]
    public async Task<ActionResult<TeamSessionListResponse>> GetTeamSessions(
        string id,
        [FromQuery] string? memberId,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        var userId = GetUserId();

        try
        {
            var (sessions, total) = await _teamService.GetTeamSessionsAsync(id, userId, limit, offset, memberId);

            return Ok(new TeamSessionListResponse
            {
                Sessions = sessions,
                Total = total,
                Limit = limit,
                Offset = offset
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    /// <summary>
    /// List team activity/events (with optional member filter)
    /// </summary>
    [HttpGet("{id}/activity")]
    public async Task<ActionResult<TeamActivityResponse>> GetTeamActivity(
        string id,
        [FromQuery] string? memberId,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        var userId = GetUserId();

        try
        {
            var (events, total) = await _teamService.GetTeamActivityAsync(id, userId, limit, offset, memberId);

            return Ok(new TeamActivityResponse
            {
                Events = events,
                Total = total,
                Limit = limit,
                Offset = offset
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }
}

/// <summary>
/// Separate controller for session privacy (scoped under /api/sessions)
/// </summary>
[ApiController]
[Route("api/sessions")]
[Authorize]
public class SessionPrivacyController : ControllerBase
{
    private readonly ITeamService _teamService;

    public SessionPrivacyController(ITeamService teamService)
    {
        _teamService = teamService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    /// <summary>
    /// Toggle session privacy
    /// </summary>
    [HttpPatch("{id}/privacy")]
    public async Task<ActionResult> SetSessionPrivacy(string id, [FromBody] SetSessionPrivacyRequest request)
    {
        var userId = GetUserId();

        try
        {
            await _teamService.SetSessionPrivacyAsync(id, userId, request.IsPrivate);
            return Ok(new { success = true, isPrivate = request.IsPrivate });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Session not found" });
        }
    }
}
