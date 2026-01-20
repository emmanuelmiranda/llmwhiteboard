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
}
