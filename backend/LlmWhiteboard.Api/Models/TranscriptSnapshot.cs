using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public enum SnapshotType
{
    /// <summary>
    /// Fresh state right after compaction (0% context used)
    /// </summary>
    PostCompaction,

    /// <summary>
    /// Checkpoint at ~80% context capacity (resumable)
    /// </summary>
    Checkpoint,

    /// <summary>
    /// Delta from checkpoint to pre-compaction (view-only, for reference)
    /// </summary>
    Delta,

    /// <summary>
    /// Regular periodic upload (kept during active cycle, cleaned up after)
    /// </summary>
    Periodic
}

public class TranscriptSnapshot
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string SessionId { get; set; } = null!;

    /// <summary>
    /// Which compaction cycle this snapshot belongs to (0 = before first compaction)
    /// </summary>
    public int CompactionCycle { get; set; } = 0;

    public SnapshotType Type { get; set; }

    /// <summary>
    /// Transcript content (full or delta depending on Type)
    /// </summary>
    public byte[] Content { get; set; } = Array.Empty<byte>();

    public bool IsEncrypted { get; set; }

    public string Checksum { get; set; } = string.Empty;

    public int SizeBytes { get; set; }

    /// <summary>
    /// Approximate context usage percentage when this snapshot was taken
    /// </summary>
    public int? ContextPercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Session Session { get; set; } = null!;
}
