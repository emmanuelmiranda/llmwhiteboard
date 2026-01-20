using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Services;

public interface IAuthService
{
    Task<User?> ValidateCredentialsAsync(string email, string password);
    Task<User> CreateUserAsync(string email, string password, string? name = null);
    Task<User?> GetUserByIdAsync(string userId);
    Task<User?> GetUserByEmailAsync(string email);
    string GenerateJwtToken(User user);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
}
