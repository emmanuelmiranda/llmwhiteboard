using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class Team
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    public string OwnerId { get; set; } = null!;

    [Required]
    public string JoinCode { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User Owner { get; set; } = null!;
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
}
