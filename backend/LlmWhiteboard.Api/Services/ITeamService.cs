using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Services;

public interface ITeamService
{
    Task<Team> CreateTeamAsync(string userId, CreateTeamRequest request);
    Task<TeamMember> JoinTeamAsync(string userId, string joinCode);
    Task<List<Team>> GetUserTeamsAsync(string userId);
    Task<Team?> GetTeamDetailAsync(string teamId, string userId);
    Task<(List<TeamSessionDto> Sessions, int Total)> GetTeamSessionsAsync(string teamId, string userId, int limit, int offset, string? memberId = null);
    Task<(List<TeamActivityEventDto> Events, int Total)> GetTeamActivityAsync(string teamId, string userId, int limit, int offset, string? memberId = null);
    Task SetSessionPrivacyAsync(string sessionId, string userId, bool isPrivate);
    Task<Team> UpdateTeamAsync(string teamId, string userId, UpdateTeamRequest request);
    Task RemoveMemberAsync(string teamId, string userId, string targetUserId);
    Task<string> RegenerateJoinCodeAsync(string teamId, string userId);
    Task DeleteTeamAsync(string teamId, string userId);
    Task LeaveTeamAsync(string teamId, string userId);
    Task<List<string>> GetUserTeamIdsAsync(string userId);
}
