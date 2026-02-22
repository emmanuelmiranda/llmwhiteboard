namespace LlmWhiteboard.Api.Dtos;

public class CreateTeamRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
}

public class CreateTeamResponse
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string JoinCode { get; set; } = null!;
}

public class JoinTeamRequest
{
    public string JoinCode { get; set; } = null!;
}

public class UpdateTeamRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
}

public class TeamDto
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string OwnerName { get; set; } = null!;
    public int MemberCount { get; set; }
    /// <summary>
    /// Only populated when the requesting user is the team owner
    /// </summary>
    public string? JoinCode { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TeamDetailDto : TeamDto
{
    public List<TeamMemberDto> Members { get; set; } = new();
}

public class TeamMemberDto
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Image { get; set; }
    public string Role { get; set; } = null!;
    public DateTime JoinedAt { get; set; }
}

public class TeamSessionDto
{
    public string Id { get; set; } = null!;
    public string LocalSessionId { get; set; } = null!;
    public string ProjectPath { get; set; } = null!;
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = null!;
    public List<string> Tags { get; set; } = new();
    public string CliType { get; set; } = "claude-code";
    public MachineDto? Machine { get; set; }
    public bool HasTranscript { get; set; }
    public bool IsEncrypted { get; set; }
    public long TranscriptSizeBytes { get; set; }
    public int EventCount { get; set; }
    public int CompactionCount { get; set; }
    public long TotalTokensUsed { get; set; }
    public DateTime LastActivityAt { get; set; }
    public DateTime CreatedAt { get; set; }
    // Last event info for activity state
    public string? LastEventType { get; set; }
    public string? LastEventToolName { get; set; }
    public DateTime? LastEventAt { get; set; }
    // Team-specific fields
    public string MemberName { get; set; } = null!;
    public string? MemberImage { get; set; }
}

public class TeamSessionListResponse
{
    public List<TeamSessionDto> Sessions { get; set; } = new();
    public int Total { get; set; }
    public int Limit { get; set; }
    public int Offset { get; set; }
}

public class TeamListResponse
{
    public List<TeamDto> Teams { get; set; } = new();
}

public class TeamActivityResponse
{
    public List<TeamActivityEventDto> Events { get; set; } = new();
    public int Total { get; set; }
    public int Limit { get; set; }
    public int Offset { get; set; }
}

public class TeamActivityEventDto
{
    public string Id { get; set; } = null!;
    public string SessionId { get; set; } = null!;
    public string? SessionTitle { get; set; }
    public string EventType { get; set; } = null!;
    public string? ToolName { get; set; }
    public string? Summary { get; set; }
    public object? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }
    public string MemberName { get; set; } = null!;
    public string? MemberImage { get; set; }
}

public class SetSessionPrivacyRequest
{
    public bool IsPrivate { get; set; }
}
