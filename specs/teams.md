# Feature: Teams

## Status
Draft

## Summary
Add team functionality to LLM Whiteboard so that multiple users can collaborate under a shared team umbrella. Currently, only individual sessions can be shared via share tokens (one session or one user's feed at a time). This feature introduces the concept of a Team: a named group of users who can see all team members' sessions and activity in a unified view, with the ability to filter by member.

## Motivation
- **Why:** Currently sharing is limited to a single session or a single user's feed via a share token link. There is no way to aggregate activity across multiple users working on related projects.
- **Problem solved:** Teams working together on a codebase have no way to see each other's LLM coding sessions in one place. Each person must share individually, and viewers can only see one person's activity at a time.
- **User-facing benefits:**
  - Create a team and invite colleagues by generating a join link/code.
  - See all team members' sessions in a single unified dashboard.
  - Filter sessions and activity by team member.
  - Real-time updates for all team member activity via existing SignalR infrastructure.

## Detailed Design

### User Experience

#### Creating a Team
1. User navigates to a new "Teams" section in the dashboard sidebar.
2. Clicks "Create Team" button.
3. Enters a team name (required) and optional description.
4. The team is created with the user as the owner.
5. A join code is generated (e.g., `lwb_team_<random>`) that can be shared with others.

#### Joining a Team
1. User receives a join code from the team owner.
2. User navigates to "Teams" section and clicks "Join Team."
3. Enters the join code.
4. Upon validation, the user is added as a member and sees the team in their Teams list.

#### Team Dashboard
1. Clicking on a team shows a team dashboard page.
2. The dashboard displays:
   - Team name and description.
   - List of members (with avatars/names).
   - A unified session list showing all sessions from all members, sorted by most recent activity.
   - Each session card shows the member name/avatar alongside the session info.
3. A member filter dropdown/sidebar allows filtering sessions to a single member.
4. Real-time updates: new sessions and events from any member appear live.

#### Session Privacy
- By default, all sessions are visible to team members.
- A user can mark any of their sessions as **private**, which hides it from all team dashboards.
- This is toggled via a privacy icon/button on the session card or within the session detail view.
- Private sessions still appear in the user's own personal dashboard — they're only hidden from team views.
- The privacy toggle is per-session, not per-team (a private session is hidden from all teams the user belongs to).

#### Team Management
- The team owner can:
  - Rename the team or update its description.
  - Remove members.
  - Regenerate the join code (invalidating the old one).
  - Delete the team.
- Any member can leave a team.

### Technical Approach

#### Database Schema (New Tables)

**Teams table:**
| Column | Type | Notes |
|--------|------|-------|
| Id | text PK | GUID |
| Name | text NOT NULL | Team display name |
| Description | text NULL | Optional description |
| OwnerId | text NOT NULL FK->Users.Id | Creator/owner |
| JoinCode | text NOT NULL UNIQUE | Join code for invitations |
| CreatedAt | timestamptz NOT NULL | |
| UpdatedAt | timestamptz NOT NULL | |

**TeamMembers table (join table):**
| Column | Type | Notes |
|--------|------|-------|
| Id | text PK | GUID |
| TeamId | text NOT NULL FK->Teams.Id | |
| UserId | text NOT NULL FK->Users.Id | |
| Role | text NOT NULL | "Owner" or "Member" |
| JoinedAt | timestamptz NOT NULL | |

Unique constraint on (TeamId, UserId).

The migration also adds a `IsPrivate` boolean column to the existing `Sessions` table (default `false`). Private sessions are excluded from all team session/activity queries.

#### Database Migration
New file: `db/migrations/V8__add_teams.sql`

#### Backend Models (C#)
New files:
- `backend/LlmWhiteboard.Api/Models/Team.cs` - Team entity with navigation properties to TeamMembers, Owner (User).
- `backend/LlmWhiteboard.Api/Models/TeamMember.cs` - TeamMember join entity with navigation properties to Team and User.

#### DbContext Changes
File: `backend/LlmWhiteboard.Api/Data/AppDbContext.cs`
- Add `DbSet<Team> Teams` and `DbSet<TeamMember> TeamMembers`.
- Add entity configurations in `OnModelCreating` for indexes and relationships.

#### Backend DTOs
New file: `backend/LlmWhiteboard.Api/Dtos/TeamDtos.cs`
- `CreateTeamRequest` (Name, Description)
- `CreateTeamResponse` (Id, Name, JoinCode)
- `JoinTeamRequest` (JoinCode)
- `TeamDto` (Id, Name, Description, OwnerName, MemberCount, JoinCode [owner only], CreatedAt)
- `TeamDetailDto` extends TeamDto with Members list
- `TeamMemberDto` (Id, UserId, Name, Email, Image, Role, JoinedAt)
- `TeamSessionDto` extends existing `SessionDto` with `MemberName`, `MemberImage` fields
- `TeamSessionListResponse` (Sessions, Total, Limit, Offset)
- `UpdateTeamRequest` (Name?, Description?)
- `TeamListResponse` (Teams list)

#### Backend Service
New files:
- `backend/LlmWhiteboard.Api/Services/ITeamService.cs`
- `backend/LlmWhiteboard.Api/Services/TeamService.cs`

Methods:
- `CreateTeamAsync(userId, request)` - Creates team, adds user as Owner member.
- `JoinTeamAsync(userId, joinCode)` - Validates code, adds user as Member.
- `GetUserTeamsAsync(userId)` - Returns all teams the user is in.
- `GetTeamDetailAsync(teamId, userId)` - Returns team with member list (validates membership).
- `GetTeamSessionsAsync(teamId, userId, query)` - Returns all non-private sessions from all team members, with optional `memberId` filter. Validates that requesting user is a member.
- `SetSessionPrivacyAsync(sessionId, userId, isPrivate)` - Toggles the private flag on a session (owner only).
- `GetTeamActivityAsync(teamId, userId, limit, offset, memberId?)` - Returns recent events across all team member sessions.
- `UpdateTeamAsync(teamId, userId, request)` - Owner only: update name/description.
- `RemoveMemberAsync(teamId, userId, targetUserId)` - Owner can remove members; members can remove themselves.
- `RegenerateJoinCodeAsync(teamId, userId)` - Owner only: generates new join code.
- `DeleteTeamAsync(teamId, userId)` - Owner only: deletes team and all memberships.
- `LeaveTeamAsync(teamId, userId)` - Member leaves team (owner cannot leave, must delete or transfer).

#### Backend Controller
New file: `backend/LlmWhiteboard.Api/Controllers/TeamsController.cs`

Endpoints (all `[Authorize]`):
- `POST /api/teams` - Create team
- `GET /api/teams` - List user's teams
- `GET /api/teams/{id}` - Get team detail with members
- `PATCH /api/teams/{id}` - Update team (owner only)
- `DELETE /api/teams/{id}` - Delete team (owner only)
- `POST /api/teams/{id}/join` - Join team with code (or `POST /api/teams/join`)
- `DELETE /api/teams/{id}/members/{userId}` - Remove member (owner or self)
- `POST /api/teams/{id}/regenerate-code` - Regenerate join code (owner only)
- `GET /api/teams/{id}/sessions` - List team sessions (with optional `?memberId=` filter)
- `GET /api/teams/{id}/activity` - List team activity/events (with optional `?memberId=` filter)
- `PATCH /api/sessions/{id}/privacy` - Toggle session privacy (`{ "isPrivate": true/false }`)

#### SignalR Changes
File: `backend/LlmWhiteboard.Api/Hubs/SessionHub.cs`
- On connect, also join groups for each team the user belongs to: `team:{teamId}`.
- When events are sent to `user:{userId}` group, also broadcast to all teams containing that user.

File: `backend/LlmWhiteboard.Api/Services/SessionNotificationService.cs`
- Modify `NotifyNewEventAsync` and `NotifySessionUpdatedAsync` to also send notifications to team groups that contain the session's user.

#### Frontend - API Client
File: `src/lib/api-client.ts`
- Add methods: `createTeam`, `getTeams`, `getTeamDetail`, `joinTeam`, `updateTeam`, `deleteTeam`, `removeMember`, `regenerateJoinCode`, `getTeamSessions`, `getTeamActivity`.
- Add types: `Team`, `TeamDetail`, `TeamMember`, `TeamSession`, etc.

#### Frontend - New Pages
- `src/app/(dashboard)/teams/page.tsx` - Teams list page showing all user's teams with "Create Team" and "Join Team" buttons.
- `src/app/(dashboard)/teams/[id]/page.tsx` - Team detail/dashboard page showing unified session list, member list, member filter.

#### Frontend - New Components
- `src/components/team-create-dialog.tsx` - Dialog for creating a new team.
- `src/components/team-join-dialog.tsx` - Dialog for joining a team with a code.
- `src/components/team-members-panel.tsx` - Sidebar/panel showing team members, used for filtering.
- `src/components/team-settings-dialog.tsx` - Dialog for team owner settings (rename, regenerate code, delete).

#### Frontend - Navigation
File: `src/components/dashboard-nav.tsx`
- Add "Teams" link to the sidebar navigation, between Sessions and Timeline (or as appropriate).

### File Changes Summary

**New files (backend):**
1. `db/migrations/V8__add_teams.sql` - Database migration
2. `backend/LlmWhiteboard.Api/Models/Team.cs` - Team model
3. `backend/LlmWhiteboard.Api/Models/TeamMember.cs` - TeamMember model
4. `backend/LlmWhiteboard.Api/Dtos/TeamDtos.cs` - Team DTOs
5. `backend/LlmWhiteboard.Api/Services/ITeamService.cs` - Team service interface
6. `backend/LlmWhiteboard.Api/Services/TeamService.cs` - Team service implementation
7. `backend/LlmWhiteboard.Api/Controllers/TeamsController.cs` - Team API controller

**Modified files (backend):**
8. `backend/LlmWhiteboard.Api/Data/AppDbContext.cs` - Add Team/TeamMember DbSets and config
9. `backend/LlmWhiteboard.Api/Program.cs` - Register ITeamService
10. `backend/LlmWhiteboard.Api/Hubs/SessionHub.cs` - Join team groups on connect
11. `backend/LlmWhiteboard.Api/Services/SessionNotificationService.cs` - Broadcast to team groups

**New files (frontend):**
12. `src/app/(dashboard)/teams/page.tsx` - Teams list page
13. `src/app/(dashboard)/teams/[id]/page.tsx` - Team detail page
14. `src/components/team-create-dialog.tsx` - Create team dialog
15. `src/components/team-join-dialog.tsx` - Join team dialog
16. `src/components/team-members-panel.tsx` - Members panel with filtering
17. `src/components/team-settings-dialog.tsx` - Team settings (owner)

**Modified files (frontend):**
18. `src/lib/api-client.ts` - Add team API methods and types
19. `src/components/dashboard-nav.tsx` - Add Teams nav link

## Edge Cases & Error Handling

1. **Joining with invalid code** - Return 404 "Team not found or invalid join code."
2. **Joining a team user is already in** - Return 409 "Already a member of this team."
3. **Owner tries to leave** - Return 400 "Team owner cannot leave. Transfer ownership or delete the team."
4. **Removing a member who is not in the team** - Return 404.
5. **Non-owner tries to update/delete team or remove others** - Return 403 Forbidden.
6. **Team with 0 members** - Should not happen (owner is always a member). If team is deleted, all memberships cascade.
7. **User views team sessions but a member has 0 sessions** - That member simply has no rows; no error.
8. **User deleted from system** - Cascade delete removes their TeamMember rows. If they were the owner, the team should either be deleted or ownership transferred. For simplicity in v1: cascade delete the team when the owner user is deleted.
9. **Join code collision** - Extremely unlikely with random generation, but the unique constraint will catch it. Retry on collision.
10. **Max team size** - Not enforced in v1, but the schema supports adding a `MaxMembers` column later.
11. **Empty member filter** - Show all members' sessions (default behavior).
12. **All sessions marked private** - A member with all private sessions simply shows no sessions in team views; no error.

## Out of Scope

- **Public team sharing** - Teams are private to authenticated members. No public share token for teams in v1.
- **Team roles beyond Owner/Member** - No Admin role in v1.
- **Ownership transfer** - Owner cannot transfer ownership in v1; they must delete the team.
- **Team-level permissions** - All members see all sessions. No per-session visibility control within teams in v1.
- **Team invitations via email** - Only join codes for v1; no email invite flow.
- **Cross-team analytics** - No aggregated metrics across teams.
- **Notification preferences per team** - All team notifications use existing SignalR infrastructure.

## Open Questions

1. Should there be a limit on how many teams a user can create or join?
2. Should join codes expire after a certain time or number of uses?
3. Should we show team member online/offline status in the member panel?

## Spec Review

**Reviewer:** Spec Reviewer Agent
**Date:** 2026-02-21
**Verdict:** Approved

### Strengths
- Spec is well-grounded in the actual codebase, referencing real files, models, and patterns.
- The database schema design is clean and follows existing conventions (text PKs with GUIDs, timestamptz, same FK patterns as ShareTokens).
- File change list is thorough and realistic.
- Edge cases are well-considered, especially cascade delete behavior and join code collisions.
- Clear delineation of what is out of scope for v1.

### Issues Found
1. **[Minor]** - The join endpoint `POST /api/teams/{id}/join` requires knowing the team ID, but the join flow says the user only has the join code. The endpoint should be `POST /api/teams/join` with the code in the body, not requiring the team ID in the URL. The spec mentions this alternative "(or `POST /api/teams/join`)" but should commit to the code-only approach since the user won't know the team ID.
2. **[Minor]** - The SignalR section says to join team groups on connect in `SessionHub.cs`, which requires a DB query on every WebSocket connection. This is acceptable for v1, but should note that the `SessionHub.OnConnectedAsync` will need `ITeamService` injected or a direct DB query.
3. **[Minor]** - The `ISessionNotificationService` changes need to look up team memberships for each user when broadcasting. This adds a DB query per notification. The spec should note this and suggest caching team memberships if performance becomes an issue.

### Missing Items
- The `User` model (`Models/User.cs`) should get a navigation property `ICollection<TeamMember> TeamMembers` for consistency with the existing pattern (similar to how `User` has `ICollection<ShareToken> ShareTokens`).
- The `SessionNotificationService` currently only takes `IHubContext<SessionHub>` and `IHubContext<PublicSessionHub>`. It will also need access to team membership data (either via `ITeamService` or `AppDbContext`) to determine which team groups to broadcast to.

### Recommendations
- Use `POST /api/teams/join` (without team ID) as the canonical join endpoint.
- Add the `User.TeamMembers` navigation property to the spec's file changes list.
- For the SessionNotificationService, inject `AppDbContext` directly (it already exists in similar services) to query team memberships when broadcasting.
- All three recommendations above are minor and can be addressed during implementation without revising the spec.
