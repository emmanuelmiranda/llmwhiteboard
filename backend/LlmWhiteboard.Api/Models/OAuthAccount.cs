using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class OAuthAccount
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string UserId { get; set; } = null!;

    [Required]
    public string Provider { get; set; } = null!;  // "github"

    [Required]
    public string ProviderAccountId { get; set; } = null!;  // GitHub user ID

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public User User { get; set; } = null!;
}
