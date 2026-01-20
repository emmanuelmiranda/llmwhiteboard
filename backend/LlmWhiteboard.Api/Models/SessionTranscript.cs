using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class SessionTranscript
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string SessionId { get; set; } = null!;

    [Required]
    public byte[] Content { get; set; } = null!;

    public bool IsEncrypted { get; set; }

    [Required]
    public string Checksum { get; set; } = null!;

    public int SizeBytes { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Session Session { get; set; } = null!;
}
