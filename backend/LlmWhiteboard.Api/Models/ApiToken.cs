using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class ApiToken
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string UserId { get; set; } = null!;

    [Required]
    public string Name { get; set; } = null!;

    [Required]
    public string TokenHash { get; set; } = null!;

    [Required]
    public string TokenPrefix { get; set; } = null!;

    public DateTime? LastUsedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? RevokedAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
}
