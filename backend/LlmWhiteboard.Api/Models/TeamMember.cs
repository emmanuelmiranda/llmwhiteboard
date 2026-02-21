using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class TeamMember
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string TeamId { get; set; } = null!;

    [Required]
    public string UserId { get; set; } = null!;

    [Required]
    public string Role { get; set; } = "Member";

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Team Team { get; set; } = null!;
    public User User { get; set; } = null!;
}
