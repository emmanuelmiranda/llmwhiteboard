using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IGitHubOAuthService _gitHubOAuthService;
    private readonly ITokenService _tokenService;
    private readonly bool _emailEnabled;

    public AuthController(IAuthService authService, IGitHubOAuthService gitHubOAuthService, ITokenService tokenService, IConfiguration config)
    {
        _authService = authService;
        _gitHubOAuthService = gitHubOAuthService;
        _tokenService = tokenService;
        _emailEnabled = config.GetValue<bool>("Auth:EmailEnabled", false);
    }

    [HttpGet("providers")]
    public ActionResult<AuthProvidersResponse> GetProviders()
    {
        return Ok(new AuthProvidersResponse
        {
            Email = _emailEnabled,
            GitHub = _gitHubOAuthService.IsConfigured
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        if (!_emailEnabled)
        {
            return NotFound(new { error = "Email login is not enabled" });
        }

        var user = await _authService.ValidateCredentialsAsync(request.Email, request.Password);

        if (user == null)
        {
            return Unauthorized(new { error = "Invalid email or password" });
        }

        var token = _authService.GenerateJwtToken(user);

        return Ok(new AuthResponse
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.Name,
                Image = user.Image
            }
        });
    }

    [HttpPost("signup")]
    public async Task<ActionResult<AuthResponse>> Signup([FromBody] SignupRequest request)
    {
        if (!_emailEnabled)
        {
            return NotFound(new { error = "Email signup is not enabled" });
        }

        try
        {
            var user = await _authService.CreateUserAsync(request.Email, request.Password, request.Name);
            var token = _authService.GenerateJwtToken(user);

            return Ok(new AuthResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.Name,
                    Image = user.Image
                }
            });
        }
        catch (InvalidOperationException ex) when (ex.Message == "User already exists")
        {
            return Conflict(new { error = "User already exists" });
        }
    }

    [HttpGet("github/authorize")]
    public ActionResult<GitHubAuthUrlResponse> GetGitHubAuthUrl([FromQuery] string redirectUri)
    {
        if (!_gitHubOAuthService.IsConfigured)
        {
            return NotFound(new { error = "GitHub login is not configured" });
        }

        if (string.IsNullOrEmpty(redirectUri))
        {
            return BadRequest(new { error = "redirectUri is required" });
        }

        var (url, state) = _gitHubOAuthService.GetAuthorizationUrl(redirectUri);

        return Ok(new GitHubAuthUrlResponse
        {
            Url = url,
            State = state
        });
    }

    [HttpPost("github/callback")]
    public async Task<ActionResult<AuthResponse>> GitHubCallback([FromBody] GitHubCallbackRequest request)
    {
        if (!_gitHubOAuthService.IsConfigured)
        {
            return NotFound(new { error = "GitHub login is not configured" });
        }

        try
        {
            // Exchange code for access token
            var accessToken = await _gitHubOAuthService.ExchangeCodeForTokenAsync(request.Code, request.RedirectUri);

            // Get user profile
            var profile = await _gitHubOAuthService.GetUserProfileAsync(accessToken);

            // Get email (might be private)
            var email = profile.Email;
            if (string.IsNullOrEmpty(email))
            {
                email = await _gitHubOAuthService.GetPrimaryEmailAsync(accessToken);
            }

            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new { error = "Unable to retrieve email from GitHub. Please ensure your GitHub account has a verified email." });
            }

            // Find or create user
            var user = await _authService.FindOrCreateOAuthUserAsync(
                provider: "github",
                providerAccountId: profile.Id,
                email: email,
                name: profile.Name ?? profile.Login,
                avatarUrl: profile.AvatarUrl
            );

            var token = _authService.GenerateJwtToken(user);

            return Ok(new AuthResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.Name,
                    Image = user.Image
                }
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return BadRequest(new { error = $"Failed to communicate with GitHub: {ex.Message}" });
        }
    }

    [HttpPost("github/device-code")]
    public async Task<ActionResult<GitHubDeviceCodeResponse>> RequestDeviceCode()
    {
        if (!_gitHubOAuthService.IsConfigured)
        {
            return NotFound(new { error = "GitHub login is not configured" });
        }

        try
        {
            var deviceCode = await _gitHubOAuthService.RequestDeviceCodeAsync();

            return Ok(new GitHubDeviceCodeResponse
            {
                ClientId = _gitHubOAuthService.ClientId!,
                DeviceCode = deviceCode.DeviceCode,
                UserCode = deviceCode.UserCode,
                VerificationUri = deviceCode.VerificationUri,
                ExpiresIn = deviceCode.ExpiresIn,
                Interval = deviceCode.Interval
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return BadRequest(new { error = $"Failed to communicate with GitHub: {ex.Message}" });
        }
    }

    [HttpPost("github/device-token")]
    public async Task<ActionResult<GitHubDeviceTokenResponse>> ExchangeDeviceToken([FromBody] GitHubDeviceTokenRequest request)
    {
        if (!_gitHubOAuthService.IsConfigured)
        {
            return NotFound(new { error = "GitHub login is not configured" });
        }

        try
        {
            // Validate GitHub access token by fetching user profile
            var profile = await _gitHubOAuthService.GetUserProfileAsync(request.AccessToken);

            // Get email (might be private)
            var email = profile.Email;
            if (string.IsNullOrEmpty(email))
            {
                email = await _gitHubOAuthService.GetPrimaryEmailAsync(request.AccessToken);
            }

            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new { error = "Unable to retrieve email from GitHub. Please ensure your GitHub account has a verified email." });
            }

            // Find or create user
            var user = await _authService.FindOrCreateOAuthUserAsync(
                provider: "github",
                providerAccountId: profile.Id,
                email: email,
                name: profile.Name ?? profile.Login,
                avatarUrl: profile.AvatarUrl
            );

            // Create API token
            var tokenName = string.IsNullOrEmpty(request.MachineName)
                ? $"CLI ({DateTime.UtcNow:yyyy-MM-dd})"
                : $"CLI - {request.MachineName}";
            var (token, _) = await _tokenService.CreateTokenAsync(user.Id, tokenName);

            return Ok(new GitHubDeviceTokenResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Name = user.Name,
                    Image = user.Image
                }
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return BadRequest(new { error = $"Failed to communicate with GitHub: {ex.Message}" });
        }
    }
}
