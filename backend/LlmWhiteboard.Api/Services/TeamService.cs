using System.Security.Cryptography;
using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Services;

public class TeamService : ITeamService
{
    private const string JoinCodePrefix = "lwb_team_";
    private readonly AppDbContext _db;

    public TeamService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Team> CreateTeamAsync(string userId, CreateTeamRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Team name is required.");
        }

        var joinCode = GenerateJoinCode();

        var team = new Team
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            OwnerId = userId,
            JoinCode = joinCode
        };

        _db.Teams.Add(team);

        // Add the creator as an Owner member
        var member = new TeamMember
        {
            TeamId = team.Id,
            UserId = userId,
            Role = "Owner"
        };

        _db.TeamMembers.Add(member);
        await _db.SaveChangesAsync();

        return team;
    }

    public async Task<TeamMember> JoinTeamAsync(string userId, string joinCode)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.JoinCode == joinCode);

        if (team == null)
        {
            throw new KeyNotFoundException("Team not found or invalid join code.");
        }

        // Check if already a member
        var existingMember = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == team.Id && tm.UserId == userId);

        if (existingMember != null)
        {
            throw new InvalidOperationException("Already a member of this team.");
        }

        var member = new TeamMember
        {
            TeamId = team.Id,
            UserId = userId,
            Role = "Member"
        };

        _db.TeamMembers.Add(member);
        await _db.SaveChangesAsync();

        return member;
    }

    public async Task<List<Team>> GetUserTeamsAsync(string userId)
    {
        return await _db.Teams
            .Include(t => t.Owner)
            .Include(t => t.Members)
            .Where(t => t.Members.Any(m => m.UserId == userId))
            .OrderByDescending(t => t.UpdatedAt)
            .ToListAsync();
    }

    public async Task<Team?> GetTeamDetailAsync(string teamId, string userId)
    {
        var team = await _db.Teams
            .Include(t => t.Owner)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            return null;
        }

        // Verify membership
        if (!team.Members.Any(m => m.UserId == userId))
        {
            return null;
        }

        return team;
    }

    public async Task<(List<TeamSessionDto> Sessions, int Total)> GetTeamSessionsAsync(
        string teamId, string userId, int limit, int offset, string? memberId = null)
    {
        // Verify membership
        var isMember = await _db.TeamMembers
            .AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId);

        if (!isMember)
        {
            throw new UnauthorizedAccessException("Not a member of this team.");
        }

        // Get all member user IDs for the team
        var memberQuery = _db.TeamMembers
            .Where(tm => tm.TeamId == teamId);

        if (!string.IsNullOrEmpty(memberId))
        {
            memberQuery = memberQuery.Where(tm => tm.UserId == memberId);
        }

        var memberUserIds = await memberQuery
            .Select(tm => tm.UserId)
            .ToListAsync();

        // Query non-private sessions from team members whose token is scoped to this team
        var baseQuery = _db.Sessions
            .Include(s => s.ApiToken)
            .Where(s => memberUserIds.Contains(s.UserId) && !s.IsPrivate)
            .Where(s => s.ApiTokenId != null && s.ApiToken != null && s.ApiToken.TeamId == teamId);

        var total = await baseQuery.CountAsync();

        var sessions = await baseQuery
            .Include(s => s.User)
            .Include(s => s.Machine)
            .OrderByDescending(s => s.LastActivityAt)
            .Skip(offset)
            .Take(Math.Min(limit, 100))
            .ToListAsync();

        var sessionIds = sessions.Select(s => s.Id).ToList();

        // Load event counts
        var eventCounts = await _db.SessionEvents
            .Where(e => sessionIds.Contains(e.SessionId))
            .GroupBy(e => e.SessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count);

        // Load last event for each session
        var lastEvents = await _db.SessionEvents
            .Where(e => sessionIds.Contains(e.SessionId))
            .GroupBy(e => e.SessionId)
            .Select(g => g.OrderByDescending(e => e.CreatedAt).First())
            .ToDictionaryAsync(
                e => e.SessionId,
                e => new LastEventInfo
                {
                    EventType = e.EventType,
                    ToolName = e.ToolName,
                    CreatedAt = e.CreatedAt
                });

        // Load transcript metadata
        var transcriptInfo = await _db.SessionTranscripts
            .Where(t => sessionIds.Contains(t.SessionId))
            .Select(t => new { t.SessionId, t.SizeBytes, t.IsEncrypted })
            .ToDictionaryAsync(x => x.SessionId, x => new { x.SizeBytes, x.IsEncrypted });

        var dtos = sessions.Select(s =>
        {
            var hasTranscript = transcriptInfo.ContainsKey(s.Id);
            return new TeamSessionDto
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
                HasTranscript = hasTranscript,
                IsEncrypted = hasTranscript && transcriptInfo[s.Id].IsEncrypted,
                TranscriptSizeBytes = hasTranscript ? transcriptInfo[s.Id].SizeBytes : 0,
                EventCount = eventCounts.GetValueOrDefault(s.Id, 0),
                CompactionCount = s.CompactionCount,
                TotalTokensUsed = s.TotalTokensUsed,
                LastActivityAt = s.LastActivityAt,
                CreatedAt = s.CreatedAt,
                LastEventType = lastEvents.GetValueOrDefault(s.Id)?.EventType,
                LastEventToolName = lastEvents.GetValueOrDefault(s.Id)?.ToolName,
                LastEventAt = lastEvents.GetValueOrDefault(s.Id)?.CreatedAt,
                MemberName = s.User.Name ?? s.User.Email,
                MemberImage = s.User.Image
            };
        }).ToList();

        return (dtos, total);
    }

    public async Task<(List<TeamActivityEventDto> Events, int Total)> GetTeamActivityAsync(
        string teamId, string userId, int limit, int offset, string? memberId = null)
    {
        // Verify membership
        var isMember = await _db.TeamMembers
            .AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId);

        if (!isMember)
        {
            throw new UnauthorizedAccessException("Not a member of this team.");
        }

        // Get member user IDs
        var memberQuery = _db.TeamMembers
            .Where(tm => tm.TeamId == teamId);

        if (!string.IsNullOrEmpty(memberId))
        {
            memberQuery = memberQuery.Where(tm => tm.UserId == memberId);
        }

        var memberUserIds = await memberQuery
            .Select(tm => tm.UserId)
            .ToListAsync();

        // Query events from non-private sessions of team members whose token is scoped to this team
        var baseQuery = _db.SessionEvents
            .Include(e => e.Session)
                .ThenInclude(s => s.User)
            .Include(e => e.Session)
                .ThenInclude(s => s.ApiToken)
            .Where(e => memberUserIds.Contains(e.Session.UserId) && !e.Session.IsPrivate)
            .Where(e => e.Session.ApiTokenId != null && e.Session.ApiToken != null && e.Session.ApiToken.TeamId == teamId);

        var total = await baseQuery.CountAsync();

        var events = await baseQuery
            .OrderByDescending(e => e.CreatedAt)
            .Skip(offset)
            .Take(Math.Min(limit, 500))
            .ToListAsync();

        var dtos = events.Select(e => new TeamActivityEventDto
        {
            Id = e.Id,
            SessionId = e.SessionId,
            SessionTitle = e.Session.Title,
            EventType = e.EventType,
            ToolName = e.ToolName,
            Summary = e.Summary,
            Metadata = e.Metadata != null
                ? System.Text.Json.JsonSerializer.Deserialize<object>(e.Metadata.RootElement.GetRawText())
                : null,
            CreatedAt = e.CreatedAt,
            MemberName = e.Session.User.Name ?? e.Session.User.Email,
            MemberImage = e.Session.User.Image
        }).ToList();

        return (dtos, total);
    }

    public async Task SetSessionPrivacyAsync(string sessionId, string userId, bool isPrivate)
    {
        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null)
        {
            throw new KeyNotFoundException("Session not found.");
        }

        session.IsPrivate = isPrivate;
        session.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    public async Task<Team> UpdateTeamAsync(string teamId, string userId, UpdateTeamRequest request)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            throw new KeyNotFoundException("Team not found.");
        }

        if (team.OwnerId != userId)
        {
            throw new UnauthorizedAccessException("Only the team owner can update the team.");
        }

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Team name cannot be empty.");
            }
            team.Name = request.Name.Trim();
        }

        if (request.Description != null)
        {
            team.Description = request.Description.Trim();
        }

        team.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return team;
    }

    public async Task RemoveMemberAsync(string teamId, string userId, string targetUserId)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            throw new KeyNotFoundException("Team not found.");
        }

        // Owner can remove anyone; members can only remove themselves
        if (team.OwnerId != userId && userId != targetUserId)
        {
            throw new UnauthorizedAccessException("Only the team owner can remove other members.");
        }

        // Cannot remove the owner
        if (targetUserId == team.OwnerId)
        {
            throw new InvalidOperationException("Team owner cannot be removed. Transfer ownership or delete the team.");
        }

        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == targetUserId);

        if (member == null)
        {
            throw new KeyNotFoundException("Member not found in this team.");
        }

        // Unscope any API tokens the removed user had assigned to this team
        var tokensToUnscope = await _db.ApiTokens
            .Where(t => t.UserId == targetUserId && t.TeamId == teamId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var t in tokensToUnscope)
        {
            t.TeamId = null;
        }

        _db.TeamMembers.Remove(member);
        await _db.SaveChangesAsync();
    }

    public async Task<string> RegenerateJoinCodeAsync(string teamId, string userId)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            throw new KeyNotFoundException("Team not found.");
        }

        if (team.OwnerId != userId)
        {
            throw new UnauthorizedAccessException("Only the team owner can regenerate the join code.");
        }

        team.JoinCode = GenerateJoinCode();
        team.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return team.JoinCode;
    }

    public async Task DeleteTeamAsync(string teamId, string userId)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            throw new KeyNotFoundException("Team not found.");
        }

        if (team.OwnerId != userId)
        {
            throw new UnauthorizedAccessException("Only the team owner can delete the team.");
        }

        _db.Teams.Remove(team);
        await _db.SaveChangesAsync();
    }

    public async Task LeaveTeamAsync(string teamId, string userId)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            throw new KeyNotFoundException("Team not found.");
        }

        if (team.OwnerId == userId)
        {
            throw new InvalidOperationException("Team owner cannot leave. Transfer ownership or delete the team.");
        }

        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == userId);

        if (member == null)
        {
            throw new KeyNotFoundException("Not a member of this team.");
        }

        // Unscope any API tokens the leaving user had assigned to this team
        var tokensToUnscope = await _db.ApiTokens
            .Where(t => t.UserId == userId && t.TeamId == teamId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var t in tokensToUnscope)
        {
            t.TeamId = null;
        }

        _db.TeamMembers.Remove(member);
        await _db.SaveChangesAsync();
    }

    public async Task<List<string>> GetUserTeamIdsAsync(string userId)
    {
        return await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();
    }

    private static string GenerateJoinCode()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(16);
        return $"{JoinCodePrefix}{Convert.ToHexString(randomBytes).ToLower()}";
    }
}
