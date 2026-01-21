// Session status enum (matches C# backend - PascalCase)
export type SessionStatus = "Active" | "Paused" | "Completed" | "Archived";

// CLI type enum (claude-code, gemini-cli, etc.)
export type CliType = "claude-code" | "gemini-cli" | string;
