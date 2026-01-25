using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Models;

public enum ShareScope
{
    Session,
    UserFeed
}

public enum ShareVisibility
{
    Full,
    ActivityOnly
}

public class ShareToken
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string UserId { get; set; } = null!;

    /// <summary>
    /// Session ID for Session scope shares. Null for UserFeed scope.
    /// </summary>
    public string? SessionId { get; set; }

    public ShareScope Scope { get; set; } = ShareScope.Session;

    public ShareVisibility Visibility { get; set; } = ShareVisibility.Full;

    /// <summary>
    /// The full share token (stored plaintext since share links are meant to be shared)
    /// </summary>
    [Required]
    public string Token { get; set; } = null!;

    /// <summary>
    /// Optional friendly name for the share
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Optional expiration time. Null means no expiry.
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Optional max viewer limit. Not enforced in v1.
    /// </summary>
    public int? MaxViewers { get; set; }

    /// <summary>
    /// When the share was revoked. Null means active.
    /// </summary>
    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Last time the share link was accessed
    /// </summary>
    public DateTime? LastAccessedAt { get; set; }

    /// <summary>
    /// Number of times the share link has been accessed
    /// </summary>
    public int AccessCount { get; set; } = 0;

    // Navigation properties
    public User User { get; set; } = null!;
    public Session? Session { get; set; }
}
