/**
 * CLI Adapter Interface
 *
 * Provides an abstraction layer for different LLM CLI tools (Claude Code, Gemini CLI).
 * Each adapter knows how to:
 * - Detect if the CLI is installed
 * - Read/write settings files
 * - Install/uninstall hooks
 * - Parse hook context from stdin
 * - Generate resume commands
 */

import path from "path";
import os from "os";

// Supported CLI types
export type CliType = "claude-code" | "gemini-cli";

// Normalized event types that work across all CLIs
export type NormalizedEventType =
  | "session_start"
  | "session_end"
  | "user_prompt"
  | "tool_use"
  | "tool_use_start"
  | "agent_stop"
  | "subagent_stop"
  | "context_compaction"
  | "permission_request"
  | "notification"
  | "model_request"
  | "model_response";

// Normalized hook context that works across all CLIs
export interface NormalizedHookContext {
  type: NormalizedEventType;
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  timestamp: string;

  // Tool events
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResponse?: unknown;

  // Prompt events
  prompt?: string;
  promptResponse?: string;

  // Session events
  sessionReason?: string;

  // Compaction events
  compactionTrigger?: "manual" | "auto";

  // Notification events
  notificationType?: string;
  message?: string;

  // Raw data
  rawEvent: Record<string, unknown>;
  cliType: CliType;
}

// Hook configuration for a specific CLI
export interface HookConfiguration {
  // The hooks object to merge into settings
  hooks: Record<string, unknown>;
  // Additional settings that need to be set (e.g., experimental flags)
  additionalSettings?: Record<string, unknown>;
  // Whether hooks are experimental for this CLI
  isExperimental?: boolean;
}

// Hook entry format (varies by CLI but has common structure)
export interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string }>;
}

// CLI Adapter interface
export interface CliAdapter {
  // Identity
  readonly name: CliType;
  readonly displayName: string;

  // Detection
  isInstalled(): Promise<boolean>;
  getVersion(): Promise<string | null>;

  // Paths
  getSettingsPath(scope: "user" | "project", projectPath?: string): string;
  getTranscriptPath(projectPath: string, sessionId: string): string;
  getConfigDir(): string;

  // Hook configuration
  getSupportedHooks(): string[];
  getDefaultHooks(): string[];
  getHookConfig(hookCommand: string): HookConfiguration;
  createHookEntry(command: string, matcher?: string): HookEntry;

  // Settings manipulation
  readSettings(scope: "user" | "project", projectPath?: string): Promise<Record<string, unknown>>;
  writeSettings(settings: Record<string, unknown>, scope: "user" | "project", projectPath?: string): Promise<void>;

  // Resume
  getResumeCommand(sessionId: string, projectPath?: string): string;
  getListSessionsCommand(): string | null;

  // Parse hook stdin
  parseHookContext(stdin: string): NormalizedHookContext;

  // Event type mapping
  mapEventType(hookName: string): NormalizedEventType;
}

// Helper to sanitize paths for transcript storage
export function sanitizePath(inputPath: string): string {
  // Convert path separators to dashes (: \ / -> -)
  return inputPath
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code === 58 || code === 92 || code === 47) return "-"; // : \ /
      return c;
    })
    .join("");
}

// Helper to hash project path (used by Gemini CLI)
export function hashProjectPath(projectPath: string): string {
  // Simple hash for project path - Gemini uses this for transcript storage
  const crypto = require("crypto");
  return crypto.createHash("md5").update(projectPath).digest("hex").slice(0, 16);
}
