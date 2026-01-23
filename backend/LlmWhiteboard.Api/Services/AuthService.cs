using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LlmWhiteboard.Api.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<User?> ValidateCredentialsAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
            return null;

        if (!VerifyPassword(password, user.PasswordHash))
            return null;

        return user;
    }

    public async Task<User> CreateUserAsync(string email, string password, string? name = null)
    {
        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existingUser != null)
            throw new InvalidOperationException("User already exists");

        var user = new User
        {
            Email = email,
            Name = name,
            PasswordHash = HashPassword(password)
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return user;
    }

    public async Task<User?> GetUserByIdAsync(string userId)
    {
        return await _db.Users.FindAsync(userId);
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        return await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<User> FindOrCreateOAuthUserAsync(string provider, string providerAccountId, string email, string? name, string? avatarUrl)
    {
        // 1. Check if OAuthAccount exists → return linked user
        var existingOAuth = await _db.OAuthAccounts
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.Provider == provider && o.ProviderAccountId == providerAccountId);

        if (existingOAuth != null)
        {
            // Update avatar if changed
            if (avatarUrl != null && existingOAuth.User.Image != avatarUrl)
            {
                existingOAuth.User.Image = avatarUrl;
                existingOAuth.User.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            return existingOAuth.User;
        }

        // 2. Check if User exists with email → link OAuth account to existing user
        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (existingUser != null)
        {
            var oauthAccount = new Models.OAuthAccount
            {
                UserId = existingUser.Id,
                Provider = provider,
                ProviderAccountId = providerAccountId
            };
            _db.OAuthAccounts.Add(oauthAccount);

            // Update avatar if not set
            if (existingUser.Image == null && avatarUrl != null)
            {
                existingUser.Image = avatarUrl;
                existingUser.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return existingUser;
        }

        // 3. Create new User + OAuthAccount
        var newUser = new Models.User
        {
            Email = email,
            Name = name,
            Image = avatarUrl,
            EmailVerified = DateTime.UtcNow  // OAuth emails are verified by provider
        };
        _db.Users.Add(newUser);

        var newOAuthAccount = new Models.OAuthAccount
        {
            UserId = newUser.Id,
            Provider = provider,
            ProviderAccountId = providerAccountId
        };
        _db.OAuthAccounts.Add(newOAuthAccount);

        await _db.SaveChangesAsync();
        return newUser;
    }

    public string GenerateJwtToken(User user)
    {
        var key = _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var issuer = _config["Jwt:Issuer"];
        var audience = _config["Jwt:Audience"];
        var expiryDays = int.Parse(_config["Jwt:ExpiryInDays"] ?? "7");

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expiryDays),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, 12);
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}
