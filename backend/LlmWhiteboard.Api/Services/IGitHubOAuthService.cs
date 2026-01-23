namespace LlmWhiteboard.Api.Services;

public interface IGitHubOAuthService
{
    bool IsConfigured { get; }
    string? ClientId { get; }
    (string Url, string State) GetAuthorizationUrl(string redirectUri);
    Task<string> ExchangeCodeForTokenAsync(string code, string redirectUri);
    Task<GitHubUserProfile> GetUserProfileAsync(string accessToken);
    Task<string?> GetPrimaryEmailAsync(string accessToken);
    Task<GitHubDeviceCodeInfo> RequestDeviceCodeAsync();
}

public class GitHubDeviceCodeInfo
{
    public string DeviceCode { get; set; } = null!;
    public string UserCode { get; set; } = null!;
    public string VerificationUri { get; set; } = null!;
    public int ExpiresIn { get; set; }
    public int Interval { get; set; }
}

public class GitHubUserProfile
{
    public string Id { get; set; } = null!;
    public string? Login { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? AvatarUrl { get; set; }
}
