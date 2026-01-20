using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class Machine
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string UserId { get; set; } = null!;

    [Required]
    public string MachineId { get; set; } = null!;

    public string? Name { get; set; }

    public DateTime? LastSeenAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
    public ICollection<Session> Sessions { get; set; } = new List<Session>();
}
