using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public class User
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    public string? Name { get; set; }

    public string? Image { get; set; }

    public string? PasswordHash { get; set; }

    public DateTime? EmailVerified { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Session> Sessions { get; set; } = new List<Session>();
    public ICollection<ApiToken> ApiTokens { get; set; } = new List<ApiToken>();
    public ICollection<Machine> Machines { get; set; } = new List<Machine>();
    public ICollection<OAuthAccount> OAuthAccounts { get; set; } = new List<OAuthAccount>();
}
