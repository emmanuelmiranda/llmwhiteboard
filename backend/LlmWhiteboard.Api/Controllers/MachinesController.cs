using System.Security.Claims;
using LlmWhiteboard.Api.Dtos;
using LlmWhiteboard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LlmWhiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MachinesController : ControllerBase
{
    private readonly IMachineService _machineService;

    public MachinesController(IMachineService machineService)
    {
        _machineService = machineService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();

    [HttpGet]
    public async Task<ActionResult<MachineListResponse>> ListMachines()
    {
        var userId = GetUserId();
        var machines = await _machineService.GetUserMachinesAsync(userId);

        return Ok(new MachineListResponse
        {
            Machines = machines.Select(m => new MachineDto
            {
                Id = m.Id,
                MachineId = m.MachineId,
                Name = m.Name,
                LastSeenAt = m.LastSeenAt,
                SessionCount = m.Sessions.Count
            }).ToList()
        });
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<MachineDto>> UpdateMachine(string id, [FromBody] MachineUpdateDto update)
    {
        var userId = GetUserId();
        var machine = await _machineService.UpdateMachineNameAsync(id, userId, update.Name);

        if (machine == null)
        {
            return NotFound(new { error = "Machine not found" });
        }

        return Ok(new MachineDto
        {
            Id = machine.Id,
            MachineId = machine.MachineId,
            Name = machine.Name,
            LastSeenAt = machine.LastSeenAt,
            SessionCount = machine.Sessions?.Count ?? 0
        });
    }
}

public class MachineUpdateDto
{
    public string? Name { get; set; }
}
