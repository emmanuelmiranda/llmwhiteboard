using LlmWhiteboard.Api.Data;
using LlmWhiteboard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LlmWhiteboard.Api.Services;

public class MachineService : IMachineService
{
    private readonly AppDbContext _db;

    public MachineService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Machine> GetOrCreateMachineAsync(string userId, string machineId)
    {
        var machine = await _db.Machines
            .FirstOrDefaultAsync(m => m.UserId == userId && m.MachineId == machineId);

        if (machine != null)
        {
            machine.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return machine;
        }

        machine = new Machine
        {
            UserId = userId,
            MachineId = machineId,
            LastSeenAt = DateTime.UtcNow
        };

        _db.Machines.Add(machine);
        await _db.SaveChangesAsync();

        return machine;
    }

    public async Task<List<Machine>> GetUserMachinesAsync(string userId)
    {
        return await _db.Machines
            .Where(m => m.UserId == userId)
            .Include(m => m.Sessions)
            .OrderByDescending(m => m.LastSeenAt)
            .ToListAsync();
    }

    public async Task UpdateLastSeenAsync(string machineId)
    {
        var machine = await _db.Machines.FindAsync(machineId);
        if (machine != null)
        {
            machine.LastSeenAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<Machine?> UpdateMachineNameAsync(string id, string userId, string? name)
    {
        var machine = await _db.Machines
            .FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId);

        if (machine == null)
            return null;

        machine.Name = name;
        await _db.SaveChangesAsync();

        return machine;
    }
}
