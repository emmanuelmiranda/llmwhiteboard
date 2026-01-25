using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Dtos;

public class CreateShareRequest
{
    /// <summary>
    /// Session ID for Session scope shares. Required when Scope is Session.
    /// </summary>
    public string? SessionId { get; set; }

    public ShareScope Scope { get; set; } = ShareScope.Session;

    public ShareVisibility Visibility { get; set; } = ShareVisibility.Full;

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
}

public class CreateShareResponse
{
    public string Id { get; set; } = null!;
    public string Token { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string Message { get; set; } = null!;
}

public class ShareTokenDto
{
    public string Id { get; set; } = null!;
    public string? SessionId { get; set; }
    public string Scope { get; set; } = null!;
    public string Visibility { get; set; } = null!;
    public string Token { get; set; } = null!;
    public string? Name { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? MaxViewers { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastAccessedAt { get; set; }
    public int AccessCount { get; set; }
}

public class ShareListResponse
{
    public List<ShareTokenDto> Shares { get; set; } = new();
}

public class ValidateShareResponse
{
    public bool Valid { get; set; }
    public string? Scope { get; set; }
    public string? Visibility { get; set; }
    public string? SessionId { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
}

/// <summary>
/// Session DTO filtered for public access based on visibility level
/// </summary>
public class PublicSessionDto
{
    public string Id { get; set; } = null!;
    public string? Title { get; set; }
    public string Status { get; set; } = null!;
    public string CliType { get; set; } = null!;
    public int EventCount { get; set; }
    public DateTime LastActivityAt { get; set; }
    public DateTime CreatedAt { get; set; }

    // Full visibility only
    public string? ProjectPath { get; set; }
    public string? Description { get; set; }
    public List<string>? Tags { get; set; }
    public string? MachineName { get; set; }
}

/// <summary>
/// Event DTO filtered for public access based on visibility level
/// </summary>
public class PublicEventDto
{
    public string Id { get; set; } = null!;
    public string SessionId { get; set; } = null!;
    public string EventType { get; set; } = null!;
    public string? ToolName { get; set; }
    public DateTime CreatedAt { get; set; }

    // Full visibility only
    public string? Summary { get; set; }
    public object? Metadata { get; set; }
}

public class PublicSessionListResponse
{
    public List<PublicSessionDto> Sessions { get; set; } = new();
    public int Total { get; set; }
}

public class PublicEventsResponse
{
    public List<PublicEventDto> Events { get; set; } = new();
    public int Total { get; set; }
    public int Limit { get; set; }
    public int Offset { get; set; }
}
