using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
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
}
