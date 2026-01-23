using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;

namespace LlmWhiteboard.Api.Services;

public class GitHubOAuthService : IGitHubOAuthService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string? _clientId;
    private readonly string? _clientSecret;

    public bool IsConfigured => !string.IsNullOrEmpty(_clientId) && !string.IsNullOrEmpty(_clientSecret);
    public string? ClientId => _clientId;

    public GitHubOAuthService(IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _httpClientFactory = httpClientFactory;
        _clientId = config["GitHub:ClientId"];
        _clientSecret = config["GitHub:ClientSecret"];
    }

    public (string Url, string State) GetAuthorizationUrl(string redirectUri)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("GitHub OAuth is not configured");

        var state = GenerateState();
        var url = $"https://github.com/login/oauth/authorize" +
            $"?client_id={Uri.EscapeDataString(_clientId!)}" +
            $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
            $"&scope=read:user%20user:email" +
            $"&state={Uri.EscapeDataString(state)}";

        return (url, state);
    }

    public async Task<string> ExchangeCodeForTokenAsync(string code, string redirectUri)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("GitHub OAuth is not configured");

        var client = _httpClientFactory.CreateClient("GitHub");
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _clientId!,
            ["client_secret"] = _clientSecret!,
            ["code"] = code,
            ["redirect_uri"] = redirectUri
        });

        var response = await client.PostAsync("https://github.com/login/oauth/access_token", content);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        if (doc.RootElement.TryGetProperty("error", out var error))
        {
            var errorDescription = doc.RootElement.TryGetProperty("error_description", out var desc)
                ? desc.GetString()
                : error.GetString();
            throw new InvalidOperationException($"GitHub OAuth error: {errorDescription}");
        }

        return doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("No access token in response");
    }

    public async Task<GitHubUserProfile> GetUserProfileAsync(string accessToken)
    {
        var client = _httpClientFactory.CreateClient("GitHub");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("LlmWhiteboard", "1.0"));

        var response = await client.GetAsync("https://api.github.com/user");
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        return new GitHubUserProfile
        {
            Id = root.GetProperty("id").GetInt64().ToString(),
            Login = root.TryGetProperty("login", out var login) ? login.GetString() : null,
            Name = root.TryGetProperty("name", out var name) && name.ValueKind != JsonValueKind.Null ? name.GetString() : null,
            Email = root.TryGetProperty("email", out var email) && email.ValueKind != JsonValueKind.Null ? email.GetString() : null,
            AvatarUrl = root.TryGetProperty("avatar_url", out var avatar) ? avatar.GetString() : null
        };
    }

    public async Task<string?> GetPrimaryEmailAsync(string accessToken)
    {
        var client = _httpClientFactory.CreateClient("GitHub");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("LlmWhiteboard", "1.0"));

        var response = await client.GetAsync("https://api.github.com/user/emails");
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        foreach (var emailObj in doc.RootElement.EnumerateArray())
        {
            var isPrimary = emailObj.TryGetProperty("primary", out var primary) && primary.GetBoolean();
            var isVerified = emailObj.TryGetProperty("verified", out var verified) && verified.GetBoolean();

            if (isPrimary && isVerified && emailObj.TryGetProperty("email", out var email))
            {
                return email.GetString();
            }
        }

        // Fall back to any verified email
        foreach (var emailObj in doc.RootElement.EnumerateArray())
        {
            var isVerified = emailObj.TryGetProperty("verified", out var verified) && verified.GetBoolean();

            if (isVerified && emailObj.TryGetProperty("email", out var email))
            {
                return email.GetString();
            }
        }

        return null;
    }

    public async Task<GitHubDeviceCodeInfo> RequestDeviceCodeAsync()
    {
        if (!IsConfigured)
            throw new InvalidOperationException("GitHub OAuth is not configured");

        var client = _httpClientFactory.CreateClient("GitHub");
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _clientId!,
            ["scope"] = "read:user user:email"
        });

        var response = await client.PostAsync("https://github.com/login/device/code", content);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("error", out var error))
        {
            var errorDescription = root.TryGetProperty("error_description", out var desc)
                ? desc.GetString()
                : error.GetString();
            throw new InvalidOperationException($"GitHub device code error: {errorDescription}");
        }

        return new GitHubDeviceCodeInfo
        {
            DeviceCode = root.GetProperty("device_code").GetString()!,
            UserCode = root.GetProperty("user_code").GetString()!,
            VerificationUri = root.GetProperty("verification_uri").GetString()!,
            ExpiresIn = root.GetProperty("expires_in").GetInt32(),
            Interval = root.GetProperty("interval").GetInt32()
        };
    }

    private static string GenerateState()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }
}
