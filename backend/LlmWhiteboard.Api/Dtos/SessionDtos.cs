using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Dtos;

public class SessionDto
{
    public string Id { get; set; } = null!;
    public string LocalSessionId { get; set; } = null!;
    public string ProjectPath { get; set; } = null!;
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = null!;
    public List<string> Tags { get; set; } = new();
    public MachineDto? Machine { get; set; }
    public bool HasTranscript { get; set; }
    public bool IsEncrypted { get; set; }
    public int EventCount { get; set; }
    /// <summary>
    /// Number of times this session has been auto-compacted
    /// </summary>
    public int CompactionCount { get; set; }
    /// <summary>
    /// Estimated total tokens used (indicator of context rot)
    /// </summary>
    public long TotalTokensUsed { get; set; }
    public DateTime LastActivityAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SessionDetailDto : SessionDto
{
    public List<SessionEventDto> Events { get; set; } = new();
    public TranscriptInfoDto? Transcript { get; set; }
}

public class SessionListResponse
{
    public List<SessionDto> Sessions { get; set; } = new();
    public int Total { get; set; }
    public int Limit { get; set; }
    public int Offset { get; set; }
}

public class SessionUpdateDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public SessionStatus? Status { get; set; }
    public List<string>? Tags { get; set; }
}

public class SessionEventDto
{
    public string Id { get; set; } = null!;
    public string SessionId { get; set; } = null!;
    public string EventType { get; set; } = null!;
    public string? ToolName { get; set; }
    public string? Summary { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MachineDto
{
    public string Id { get; set; } = null!;
    public string MachineId { get; set; } = null!;
    public string? Name { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public int SessionCount { get; set; }
}

public class TranscriptInfoDto
{
    public string Id { get; set; } = null!;
    public bool IsEncrypted { get; set; }
    public int SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class MachineListResponse
{
    public List<MachineDto> Machines { get; set; } = new();
}

public class EventListResponse
{
    public List<SessionEventDto> Events { get; set; } = new();
}

public class SessionEventsResponse
{
    public List<SessionEventDto> Events { get; set; } = new();
    public int Total { get; set; }
    public int Limit { get; set; }
    public int Offset { get; set; }
}

public class SnapshotDto
{
    public string Id { get; set; } = null!;
    public string SessionId { get; set; } = null!;
    public int CompactionCycle { get; set; }
    /// <summary>
    /// Type: PostCompaction, Checkpoint, Delta
    /// </summary>
    public string Type { get; set; } = null!;
    public int SizeBytes { get; set; }
    /// <summary>
    /// Approximate context percentage when snapshot was taken (0 for post-compaction, ~80 for checkpoint, 100 for delta)
    /// </summary>
    public int? ContextPercentage { get; set; }
    public bool IsEncrypted { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SnapshotListResponse
{
    public List<SnapshotDto> Snapshots { get; set; } = new();
}
