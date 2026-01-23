using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Dtos;

public class LoginRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    public string Password { get; set; } = null!;
}

public class SignupRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = null!;

    public string? Name { get; set; }
}

public class AuthResponse
{
    public string Token { get; set; } = null!;
    public UserDto User { get; set; } = null!;
}

public class UserDto
{
    public string Id { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string? Name { get; set; }
    public string? Image { get; set; }
}

public class GitHubAuthUrlResponse
{
    public string Url { get; set; } = null!;
    public string State { get; set; } = null!;
}

public class GitHubCallbackRequest
{
    [Required]
    public string Code { get; set; } = null!;

    [Required]
    public string State { get; set; } = null!;

    [Required]
    public string RedirectUri { get; set; } = null!;
}

public class AuthProvidersResponse
{
    public bool Email { get; set; }
    public bool GitHub { get; set; }
}
