using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Models;
using LlmWhiteboard.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace LlmWhiteboard.Api.Tests;

/// <summary>
/// Test DbContext that works with InMemory provider by ignoring the JsonDocument property
/// </summary>
public class TestAppDbContext : AppDbContext
{
    public TestAppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Ignore the JsonDocument property that InMemory provider doesn't support
        modelBuilder.Entity<SessionEvent>()
            .Ignore(e => e.Metadata);
    }
}

public class TeamServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly TeamService _service;
    private readonly string _userId;
    private readonly string _otherUserId;

    public TeamServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _db = new TestAppDbContext(options);

        // Seed users
        _userId = Guid.NewGuid().ToString();
        _otherUserId = Guid.NewGuid().ToString();

        _db.Users.Add(new User
        {
            Id = _userId,
            Email = "owner@test.com",
            Name = "Owner User"
        });
        _db.Users.Add(new User
        {
            Id = _otherUserId,
            Email = "member@test.com",
            Name = "Member User"
        });
        _db.SaveChanges();

        _service = new TeamService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    // Helper to create a team and return it
    private async Task<Team> CreateTestTeamAsync()
    {
        return await _service.CreateTeamAsync(_userId, new CreateTeamRequest
        {
            Name = "Test Team",
            Description = "A team for testing"
        });
    }

    // Helper to create a session for a user
    private async Task<Session> CreateTestSessionAsync(string userId, bool isPrivate = false)
    {
        var session = new Session
        {
            UserId = userId,
            LocalSessionId = Guid.NewGuid().ToString(),
            ProjectPath = "/test/project",
            Title = "Test Session",
            IsPrivate = isPrivate
        };
        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();
        return session;
    }

    #region CreateTeamAsync

    [Fact]
    public async Task CreateTeamAsync_CreatesTeamWithCorrectProperties()
    {
        var team = await _service.CreateTeamAsync(_userId, new CreateTeamRequest
        {
            Name = "My Team",
            Description = "Team description"
        });

        Assert.Equal("My Team", team.Name);
        Assert.Equal("Team description", team.Description);
        Assert.Equal(_userId, team.OwnerId);
        Assert.StartsWith("lwb_team_", team.JoinCode);
    }

    [Fact]
    public async Task CreateTeamAsync_AddsCreatorAsOwnerMember()
    {
        var team = await CreateTestTeamAsync();

        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == team.Id && tm.UserId == _userId);

        Assert.NotNull(member);
        Assert.Equal("Owner", member.Role);
    }

    [Fact]
    public async Task CreateTeamAsync_ThrowsOnEmptyName()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.CreateTeamAsync(_userId, new CreateTeamRequest { Name = "  " }));
    }

    [Fact]
    public async Task CreateTeamAsync_TrimsWhitespace()
    {
        var team = await _service.CreateTeamAsync(_userId, new CreateTeamRequest
        {
            Name = "  My Team  ",
            Description = "  Description  "
        });

        Assert.Equal("My Team", team.Name);
        Assert.Equal("Description", team.Description);
    }

    #endregion

    #region JoinTeamAsync

    [Fact]
    public async Task JoinTeamAsync_AddsUserAsMember()
    {
        var team = await CreateTestTeamAsync();

        var member = await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        Assert.Equal("Member", member.Role);
        Assert.Equal(team.Id, member.TeamId);
        Assert.Equal(_otherUserId, member.UserId);
    }

    [Fact]
    public async Task JoinTeamAsync_ThrowsOnInvalidCode()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.JoinTeamAsync(_otherUserId, "invalid_code"));
    }

    [Fact]
    public async Task JoinTeamAsync_ThrowsWhenAlreadyMember()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.JoinTeamAsync(_otherUserId, team.JoinCode));
    }

    #endregion

    #region GetUserTeamsAsync

    [Fact]
    public async Task GetUserTeamsAsync_ReturnsOnlyUserTeams()
    {
        await CreateTestTeamAsync();

        var ownerTeams = await _service.GetUserTeamsAsync(_userId);
        var otherTeams = await _service.GetUserTeamsAsync(_otherUserId);

        Assert.Single(ownerTeams);
        Assert.Empty(otherTeams);
    }

    [Fact]
    public async Task GetUserTeamsAsync_ReturnsEmptyForNoTeams()
    {
        var teams = await _service.GetUserTeamsAsync(_otherUserId);
        Assert.Empty(teams);
    }

    #endregion

    #region GetTeamDetailAsync

    [Fact]
    public async Task GetTeamDetailAsync_ReturnsTeamForMember()
    {
        var team = await CreateTestTeamAsync();

        var detail = await _service.GetTeamDetailAsync(team.Id, _userId);

        Assert.NotNull(detail);
        Assert.Equal(team.Id, detail.Id);
        Assert.Single(detail.Members);
    }

    [Fact]
    public async Task GetTeamDetailAsync_ReturnsNullForNonMember()
    {
        var team = await CreateTestTeamAsync();

        var detail = await _service.GetTeamDetailAsync(team.Id, _otherUserId);

        Assert.Null(detail);
    }

    [Fact]
    public async Task GetTeamDetailAsync_ReturnsNullForNonExistentTeam()
    {
        var detail = await _service.GetTeamDetailAsync("nonexistent", _userId);
        Assert.Null(detail);
    }

    #endregion

    #region GetTeamSessionsAsync

    [Fact]
    public async Task GetTeamSessionsAsync_ReturnsSessionsFromAllMembers()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await CreateTestSessionAsync(_userId);
        await CreateTestSessionAsync(_otherUserId);

        var (sessions, total) = await _service.GetTeamSessionsAsync(team.Id, _userId, 50, 0);

        Assert.Equal(2, total);
        Assert.Equal(2, sessions.Count);
    }

    [Fact]
    public async Task GetTeamSessionsAsync_FiltersByMemberId()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await CreateTestSessionAsync(_userId);
        await CreateTestSessionAsync(_otherUserId);

        var (sessions, total) = await _service.GetTeamSessionsAsync(team.Id, _userId, 50, 0, _otherUserId);

        Assert.Equal(1, total);
        Assert.Single(sessions);
        Assert.Equal("Member User", sessions[0].MemberName);
    }

    [Fact]
    public async Task GetTeamSessionsAsync_ExcludesPrivateSessions()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await CreateTestSessionAsync(_userId);
        await CreateTestSessionAsync(_otherUserId, isPrivate: true);

        var (sessions, total) = await _service.GetTeamSessionsAsync(team.Id, _userId, 50, 0);

        Assert.Equal(1, total);
        Assert.Single(sessions);
    }

    [Fact]
    public async Task GetTeamSessionsAsync_ThrowsForNonMember()
    {
        var team = await CreateTestTeamAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.GetTeamSessionsAsync(team.Id, _otherUserId, 50, 0));
    }

    [Fact]
    public async Task GetTeamSessionsAsync_IncludesMemberInfo()
    {
        var team = await CreateTestTeamAsync();
        await CreateTestSessionAsync(_userId);

        var (sessions, _) = await _service.GetTeamSessionsAsync(team.Id, _userId, 50, 0);

        Assert.Single(sessions);
        Assert.Equal("Owner User", sessions[0].MemberName);
    }

    #endregion

    #region SetSessionPrivacyAsync

    [Fact]
    public async Task SetSessionPrivacyAsync_SetsPrivateTrue()
    {
        var session = await CreateTestSessionAsync(_userId);

        await _service.SetSessionPrivacyAsync(session.Id, _userId, true);

        var updated = await _db.Sessions.FindAsync(session.Id);
        Assert.True(updated!.IsPrivate);
    }

    [Fact]
    public async Task SetSessionPrivacyAsync_SetsPrivateFalse()
    {
        var session = await CreateTestSessionAsync(_userId, isPrivate: true);

        await _service.SetSessionPrivacyAsync(session.Id, _userId, false);

        var updated = await _db.Sessions.FindAsync(session.Id);
        Assert.False(updated!.IsPrivate);
    }

    [Fact]
    public async Task SetSessionPrivacyAsync_ThrowsForNonOwnedSession()
    {
        var session = await CreateTestSessionAsync(_userId);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.SetSessionPrivacyAsync(session.Id, _otherUserId, true));
    }

    [Fact]
    public async Task SetSessionPrivacyAsync_ThrowsForNonExistentSession()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.SetSessionPrivacyAsync("nonexistent", _userId, true));
    }

    #endregion

    #region UpdateTeamAsync

    [Fact]
    public async Task UpdateTeamAsync_UpdatesNameAndDescription()
    {
        var team = await CreateTestTeamAsync();

        var updated = await _service.UpdateTeamAsync(team.Id, _userId, new UpdateTeamRequest
        {
            Name = "New Name",
            Description = "New Description"
        });

        Assert.Equal("New Name", updated.Name);
        Assert.Equal("New Description", updated.Description);
    }

    [Fact]
    public async Task UpdateTeamAsync_ThrowsForNonOwner()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.UpdateTeamAsync(team.Id, _otherUserId, new UpdateTeamRequest { Name = "New" }));
    }

    [Fact]
    public async Task UpdateTeamAsync_ThrowsForNonExistentTeam()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.UpdateTeamAsync("nonexistent", _userId, new UpdateTeamRequest { Name = "New" }));
    }

    [Fact]
    public async Task UpdateTeamAsync_ThrowsForEmptyName()
    {
        var team = await CreateTestTeamAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.UpdateTeamAsync(team.Id, _userId, new UpdateTeamRequest { Name = "  " }));
    }

    #endregion

    #region RemoveMemberAsync

    [Fact]
    public async Task RemoveMemberAsync_OwnerCanRemoveMember()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await _service.RemoveMemberAsync(team.Id, _userId, _otherUserId);

        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == team.Id && tm.UserId == _otherUserId);
        Assert.Null(member);
    }

    [Fact]
    public async Task RemoveMemberAsync_MemberCanRemoveSelf()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await _service.RemoveMemberAsync(team.Id, _otherUserId, _otherUserId);

        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == team.Id && tm.UserId == _otherUserId);
        Assert.Null(member);
    }

    [Fact]
    public async Task RemoveMemberAsync_ThrowsWhenNonOwnerRemovesAnother()
    {
        var team = await CreateTestTeamAsync();

        // Add a third user
        var thirdUserId = Guid.NewGuid().ToString();
        _db.Users.Add(new User { Id = thirdUserId, Email = "third@test.com", Name = "Third" });
        await _db.SaveChangesAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);
        await _service.JoinTeamAsync(thirdUserId, team.JoinCode);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.RemoveMemberAsync(team.Id, _otherUserId, thirdUserId));
    }

    [Fact]
    public async Task RemoveMemberAsync_ThrowsWhenRemovingOwner()
    {
        var team = await CreateTestTeamAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.RemoveMemberAsync(team.Id, _userId, _userId));
    }

    [Fact]
    public async Task RemoveMemberAsync_ThrowsForNonExistentMember()
    {
        var team = await CreateTestTeamAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.RemoveMemberAsync(team.Id, _userId, _otherUserId));
    }

    #endregion

    #region LeaveTeamAsync

    [Fact]
    public async Task LeaveTeamAsync_RemovesMember()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await _service.LeaveTeamAsync(team.Id, _otherUserId);

        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == team.Id && tm.UserId == _otherUserId);
        Assert.Null(member);
    }

    [Fact]
    public async Task LeaveTeamAsync_ThrowsForOwner()
    {
        var team = await CreateTestTeamAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.LeaveTeamAsync(team.Id, _userId));
    }

    [Fact]
    public async Task LeaveTeamAsync_ThrowsForNonMember()
    {
        var team = await CreateTestTeamAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.LeaveTeamAsync(team.Id, _otherUserId));
    }

    #endregion

    #region RegenerateJoinCodeAsync

    [Fact]
    public async Task RegenerateJoinCodeAsync_GeneratesNewCode()
    {
        var team = await CreateTestTeamAsync();
        var originalCode = team.JoinCode;

        var newCode = await _service.RegenerateJoinCodeAsync(team.Id, _userId);

        Assert.NotEqual(originalCode, newCode);
        Assert.StartsWith("lwb_team_", newCode);
    }

    [Fact]
    public async Task RegenerateJoinCodeAsync_ThrowsForNonOwner()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.RegenerateJoinCodeAsync(team.Id, _otherUserId));
    }

    [Fact]
    public async Task RegenerateJoinCodeAsync_InvalidatesOldCode()
    {
        var team = await CreateTestTeamAsync();
        var oldCode = team.JoinCode;

        await _service.RegenerateJoinCodeAsync(team.Id, _userId);

        // The old code should no longer match any team
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.JoinTeamAsync(_otherUserId, oldCode));
    }

    #endregion

    #region DeleteTeamAsync

    [Fact]
    public async Task DeleteTeamAsync_RemovesTeamForOwner()
    {
        var team = await CreateTestTeamAsync();

        await _service.DeleteTeamAsync(team.Id, _userId);

        var deleted = await _db.Teams.FindAsync(team.Id);
        Assert.Null(deleted);
    }

    [Fact]
    public async Task DeleteTeamAsync_ThrowsForNonOwner()
    {
        var team = await CreateTestTeamAsync();
        await _service.JoinTeamAsync(_otherUserId, team.JoinCode);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.DeleteTeamAsync(team.Id, _otherUserId));
    }

    [Fact]
    public async Task DeleteTeamAsync_ThrowsForNonExistentTeam()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.DeleteTeamAsync("nonexistent", _userId));
    }

    #endregion

    #region GetUserTeamIdsAsync

    [Fact]
    public async Task GetUserTeamIdsAsync_ReturnsTeamIds()
    {
        var team = await CreateTestTeamAsync();

        var ids = await _service.GetUserTeamIdsAsync(_userId);

        Assert.Single(ids);
        Assert.Contains(team.Id, ids);
    }

    [Fact]
    public async Task GetUserTeamIdsAsync_ReturnsEmptyForNoTeams()
    {
        var ids = await _service.GetUserTeamIdsAsync(_otherUserId);
        Assert.Empty(ids);
    }

    #endregion
}
