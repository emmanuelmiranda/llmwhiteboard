# Test Plan: Teams

## Unit Tests (TeamService)

### Team Creation
- [ ] CreateTeamAsync creates a team with correct name, description, and owner
- [ ] CreateTeamAsync adds the creator as an "Owner" member
- [ ] CreateTeamAsync generates a join code with "lwb_team_" prefix
- [ ] CreateTeamAsync throws ArgumentException when name is empty/whitespace
- [ ] CreateTeamAsync trims whitespace from name and description

### Joining a Team
- [ ] JoinTeamAsync adds user as "Member" with valid join code
- [ ] JoinTeamAsync throws KeyNotFoundException for invalid join code
- [ ] JoinTeamAsync throws InvalidOperationException when user is already a member

### Listing Teams
- [ ] GetUserTeamsAsync returns only teams the user is a member of
- [ ] GetUserTeamsAsync returns empty list when user has no teams
- [ ] GetUserTeamsAsync includes owner and member count

### Team Detail
- [ ] GetTeamDetailAsync returns team with members when user is a member
- [ ] GetTeamDetailAsync returns null when user is not a member
- [ ] GetTeamDetailAsync returns null for non-existent team

### Team Sessions
- [ ] GetTeamSessionsAsync returns sessions from all team members
- [ ] GetTeamSessionsAsync filters by memberId when provided
- [ ] GetTeamSessionsAsync excludes private sessions (IsPrivate = true)
- [ ] GetTeamSessionsAsync throws UnauthorizedAccessException for non-members
- [ ] GetTeamSessionsAsync includes member name and image in response
- [ ] GetTeamSessionsAsync respects limit and offset pagination

### Team Activity
- [ ] GetTeamActivityAsync returns events from all team member sessions
- [ ] GetTeamActivityAsync filters by memberId when provided
- [ ] GetTeamActivityAsync excludes events from private sessions
- [ ] GetTeamActivityAsync throws UnauthorizedAccessException for non-members

### Session Privacy
- [ ] SetSessionPrivacyAsync sets IsPrivate to true for owned session
- [ ] SetSessionPrivacyAsync sets IsPrivate to false for owned session
- [ ] SetSessionPrivacyAsync throws KeyNotFoundException for non-owned session
- [ ] SetSessionPrivacyAsync throws KeyNotFoundException for non-existent session

### Team Update
- [ ] UpdateTeamAsync updates name and description for owner
- [ ] UpdateTeamAsync throws UnauthorizedAccessException for non-owner
- [ ] UpdateTeamAsync throws KeyNotFoundException for non-existent team
- [ ] UpdateTeamAsync throws ArgumentException for empty name

### Member Removal
- [ ] RemoveMemberAsync allows owner to remove a member
- [ ] RemoveMemberAsync allows member to remove themselves
- [ ] RemoveMemberAsync throws UnauthorizedAccessException when non-owner removes another
- [ ] RemoveMemberAsync throws InvalidOperationException when removing the owner
- [ ] RemoveMemberAsync throws KeyNotFoundException for non-existent member

### Leave Team
- [ ] LeaveTeamAsync removes the member from the team
- [ ] LeaveTeamAsync throws InvalidOperationException when owner tries to leave
- [ ] LeaveTeamAsync throws KeyNotFoundException for non-member

### Regenerate Join Code
- [ ] RegenerateJoinCodeAsync generates new code for owner
- [ ] RegenerateJoinCodeAsync throws UnauthorizedAccessException for non-owner
- [ ] RegenerateJoinCodeAsync invalidates the old code

### Delete Team
- [ ] DeleteTeamAsync removes team and all memberships (cascade) for owner
- [ ] DeleteTeamAsync throws UnauthorizedAccessException for non-owner
- [ ] DeleteTeamAsync throws KeyNotFoundException for non-existent team

## Integration Tests (API Controller)

### POST /api/teams
- [ ] Returns 200 with team ID, name, and join code on success
- [ ] Returns 400 when name is empty
- [ ] Returns 401 when not authenticated

### GET /api/teams
- [ ] Returns list of user's teams with member counts
- [ ] Returns empty list for user with no teams

### GET /api/teams/{id}
- [ ] Returns team detail with members for team member
- [ ] Returns 404 for non-member
- [ ] Returns 404 for non-existent team

### POST /api/teams/join
- [ ] Returns 200 with teamId on valid join code
- [ ] Returns 404 on invalid join code
- [ ] Returns 409 when already a member

### PATCH /api/teams/{id}
- [ ] Returns 200 with updated team for owner
- [ ] Returns 403 for non-owner

### DELETE /api/teams/{id}
- [ ] Returns 200 on success for owner
- [ ] Returns 403 for non-owner

### DELETE /api/teams/{id}/members/{userId}
- [ ] Returns 200 when owner removes member
- [ ] Returns 200 when member removes self
- [ ] Returns 403 when non-owner removes another
- [ ] Returns 400 when trying to remove owner

### POST /api/teams/{id}/leave
- [ ] Returns 200 for member leaving
- [ ] Returns 400 for owner trying to leave

### POST /api/teams/{id}/regenerate-code
- [ ] Returns 200 with new code for owner
- [ ] Returns 403 for non-owner

### GET /api/teams/{id}/sessions
- [ ] Returns paginated team sessions
- [ ] Respects memberId filter
- [ ] Excludes private sessions

### GET /api/teams/{id}/activity
- [ ] Returns paginated team activity events
- [ ] Respects memberId filter

### PATCH /api/sessions/{id}/privacy
- [ ] Returns 200 with isPrivate flag on success
- [ ] Returns 404 for non-owned session

## Edge Cases
- [ ] User with all sessions marked private shows no sessions in team view
- [ ] Team with single member (owner) works correctly
- [ ] Join code collision is handled by unique constraint (retry scenario)
- [ ] Deleting a user cascades to TeamMember removal; deleting owner cascades to team deletion
- [ ] Empty member filter shows all members' sessions
- [ ] Large team member count works with pagination

## Manual Testing Checklist
- [ ] Create a team and verify it appears in the teams list
- [ ] Copy and share the join code
- [ ] Join a team using a join code and verify the team appears
- [ ] View team dashboard with sessions from multiple members
- [ ] Filter sessions by a specific member
- [ ] Mark a session as private and verify it disappears from team view
- [ ] Unmark the private session and verify it reappears
- [ ] Owner: rename team and verify the change
- [ ] Owner: regenerate join code and verify old code stops working
- [ ] Owner: remove a member and verify they disappear from member list
- [ ] Member: leave team and verify navigation back to teams list
- [ ] Owner: delete team and verify it's gone for all members
- [ ] Verify real-time updates: new session from one member appears in another's team view
- [ ] Verify Teams nav link appears in dashboard navigation
