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
