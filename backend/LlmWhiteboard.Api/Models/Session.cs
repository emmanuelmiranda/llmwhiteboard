using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public enum SessionStatus
{
    Active,
    Paused,
    Completed,
    Archived
}

public class Session
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string UserId { get; set; } = null!;

    public string? MachineId { get; set; }

    [Required]
    public string LocalSessionId { get; set; } = null!;

    [Required]
    public string ProjectPath { get; set; } = null!;

    public string? Title { get; set; }

    public string? Description { get; set; }

    public SessionStatus Status { get; set; } = SessionStatus.Active;

    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// The CLI tool that created this session (claude-code, gemini-cli, etc.)
    /// </summary>
    public string CliType { get; set; } = "claude-code";

    /// <summary>
    /// Number of times this session has been auto-compacted (context summarized)
    /// </summary>
    public int CompactionCount { get; set; } = 0;

    /// <summary>
    /// Estimated total tokens used in this session (for context rot indicator)
    /// </summary>
    public long TotalTokensUsed { get; set; } = 0;

    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
    public Machine? Machine { get; set; }
    public ICollection<SessionEvent> Events { get; set; } = new List<SessionEvent>();
    public SessionTranscript? Transcript { get; set; }
    public ICollection<TranscriptSnapshot> Snapshots { get; set; } = new List<TranscriptSnapshot>();
}
