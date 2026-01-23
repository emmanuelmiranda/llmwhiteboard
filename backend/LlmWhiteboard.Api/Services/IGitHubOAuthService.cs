namespace LlmWhiteboard.Api.Services;

public interface IGitHubOAuthService
{
    bool IsConfigured { get; }
    (string Url, string State) GetAuthorizationUrl(string redirectUri);
    Task<string> ExchangeCodeForTokenAsync(string code, string redirectUri);
    Task<GitHubUserProfile> GetUserProfileAsync(string accessToken);
    Task<string?> GetPrimaryEmailAsync(string accessToken);
}

public class GitHubUserProfile
{
    public string Id { get; set; } = null!;
    public string? Login { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? AvatarUrl { get; set; }
}
