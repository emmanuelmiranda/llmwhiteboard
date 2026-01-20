using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace LlmWhiteboard.Api.Models;

public class SessionEvent
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string SessionId { get; set; } = null!;

    [Required]
    public string EventType { get; set; } = null!;

    public string? ToolName { get; set; }

    public string? Summary { get; set; }

    public JsonDocument? Metadata { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Session Session { get; set; } = null!;
}
