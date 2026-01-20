using System.ComponentModel.DataAnnotations;

namespace LlmWhiteboard.Api.Dtos;

public class SyncPayload
{
    [Required]
    public string LocalSessionId { get; set; } = null!;

    [Required]
    public string ProjectPath { get; set; } = null!;

    [Required]
    public string MachineId { get; set; } = null!;

    [Required]
    public SyncEvent Event { get; set; } = null!;

    [Required]
    public string Timestamp { get; set; } = null!;
}

public class SyncEvent
{
    [Required]
    public string Type { get; set; } = null!;

    public string? ToolName { get; set; }
    public string? Summary { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
}

public class SyncResponse
{
    public bool Success { get; set; }
    public string? SessionId { get; set; }
}

public class TranscriptUploadRequest
{
    [Required]
    public string LocalSessionId { get; set; } = null!;

    [Required]
    public string MachineId { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!; // Base64 encoded

    public bool IsEncrypted { get; set; }

    [Required]
    public string Checksum { get; set; } = null!;
}

public class TranscriptUploadResponse
{
    public bool Success { get; set; }
    public string? SessionId { get; set; }
    public int SizeBytes { get; set; }
}

public class TranscriptDownloadResponse
{
    public string SessionId { get; set; } = null!;
    public string LocalSessionId { get; set; } = null!;
    public string ProjectPath { get; set; } = null!;
    public string? MachineId { get; set; }
    public string Content { get; set; } = null!; // Base64 encoded
    public bool IsEncrypted { get; set; }
    public string Checksum { get; set; } = null!;
    public int SizeBytes { get; set; }
}
