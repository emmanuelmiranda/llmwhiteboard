using LlmWhiteboard.Api.Models;

namespace LlmWhiteboard.Api.Services;

public interface IMachineService
{
    Task<Machine> GetOrCreateMachineAsync(string userId, string machineId);
    Task<List<Machine>> GetUserMachinesAsync(string userId);
    Task UpdateLastSeenAsync(string machineId);
    Task<Machine?> UpdateMachineNameAsync(string id, string userId, string? name);
    Task<bool> DeleteMachineAsync(string id, string userId);
}
