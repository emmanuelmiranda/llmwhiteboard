using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Dtos;

public class CreateTokenRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;
}

public class CreateTokenResponse
{
    public string Token { get; set; } = null!;
    public string Id { get; set; } = null!;
    public string Message { get; set; } = null!;
}

public class TokenDto
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string TokenPrefix { get; set; } = null!;
    public DateTime? LastUsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TokenListResponse
{
    public List<TokenDto> Tokens { get; set; } = new();
}
