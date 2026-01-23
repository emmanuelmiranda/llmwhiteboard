/**
 * Claude Code Adapter
 *
 * Implements the CliAdapter interface for Claude Code.
 * Handles all Claude Code specific logic for hooks, settings, and transcripts.
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  CliAdapter,
  CliType,
  NormalizedEventType,
  NormalizedHookContext,
  HookConfiguration,
  HookEntry,
  sanitizePath,
} from "../cli-adapter.js";

// Claude Code hook event names
type ClaudeHookEvent =
  | "SessionStart"
  | "SessionEnd"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PermissionRequest"
  | "Stop"
  | "SubagentStop"
  | "PreCompact"
  | "Notification"
  | "Setup";

// Claude Code stdin context
interface ClaudeHookContext {
  hook_event_name: ClaudeHookEvent;
  session_id: string;
  cwd: string;
  transcript_path?: string;
  permission_mode?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  tool_use_id?: string;
  message?: string;
  notification_type?: string;
  trigger?: "manual" | "auto";
  source?: "startup" | "resume" | "clear" | "compact";
  reason?: string;
  prompt?: string;
  stop_hook_active?: boolean;
}

export class ClaudeCodeAdapter implements CliAdapter {
  readonly name: CliType = "claude-code";
  readonly displayName = "Claude Code";

  private readonly configDir = path.join(os.homedir(), ".claude");

  async isInstalled(): Promise<boolean> {
    try {
      await fs.access(this.configDir);
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    // Claude Code doesn't expose version in a standard way
    // Could try running `claude --version` but that requires spawning a process
    return null;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  getSettingsPath(scope: "user" | "project", projectPath?: string): string {
    if (scope === "project" && projectPath) {
      return path.join(projectPath, ".claude", "settings.local.json");
    }
    return path.join(this.configDir, "settings.json");
  }

  getTranscriptPath(projectPath: string, sessionId: string): string {
    const sanitized = sanitizePath(projectPath);
    // Remove leading dashes for the folder name
    const folderName = sanitized.replace(/^-+/, "");
    return path.join(this.configDir, "projects", folderName, `${sessionId}.jsonl`);
  }

  getSupportedHooks(): string[] {
    return [
      "SessionStart",
      "SessionEnd",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PermissionRequest",
      "Stop",
      "SubagentStop",
      "PreCompact",
      "Notification",
      "Setup",
    ];
  }

  getDefaultHooks(): string[] {
    // Hooks enabled by default for syncing
    return [
      "SessionStart",
      "SessionEnd",
      "UserPromptSubmit",
      "PreToolUse",  // For AskUserQuestion - detect when waiting for user input
      "PostToolUse",
      "PermissionRequest",  // Detect when waiting for permission approval
      "Stop",
      "PreCompact",
    ];
  }

  getHookConfig(hookCommand: string): HookConfiguration {
    const hooks: Record<string, HookEntry[]> = {};

    for (const hookName of this.getDefaultHooks()) {
      // PostToolUse needs a matcher to match all tools
      // PreToolUse only matches AskUserQuestion to detect when waiting for user input
      let matcher: string | undefined;
      if (hookName === "PostToolUse") {
        matcher = "*";
      } else if (hookName === "PreToolUse") {
        matcher = "AskUserQuestion";
      }
      hooks[hookName] = [this.createHookEntry(hookCommand, matcher)];
    }

    return {
      hooks,
      isExperimental: false,
    };
  }

  createHookEntry(command: string, matcher?: string): HookEntry {
    const entry: HookEntry = {
      hooks: [{ type: "command", command }],
    };
    if (matcher !== undefined) {
      entry.matcher = matcher;
    }
    return entry;
  }

  async readSettings(scope: "user" | "project", projectPath?: string): Promise<Record<string, unknown>> {
    try {
      const settingsPath = this.getSettingsPath(scope, projectPath);
      const data = await fs.readFile(settingsPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async writeSettings(settings: Record<string, unknown>, scope: "user" | "project", projectPath?: string): Promise<void> {
    const settingsPath = this.getSettingsPath(scope, projectPath);
    const dir = path.dirname(settingsPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  }

  getResumeCommand(sessionId: string, projectPath?: string): string {
    if (projectPath) {
      return `claude --resume ${sessionId} --directory "${projectPath}"`;
    }
    return `claude --resume ${sessionId}`;
  }

  getListSessionsCommand(): string | null {
    // Claude Code doesn't have a built-in list sessions command
    return null;
  }

  parseHookContext(stdin: string): NormalizedHookContext {
    const raw: ClaudeHookContext = JSON.parse(stdin);
    const eventType = this.mapEventType(raw.hook_event_name);

    // Calculate transcript path if not provided
    const transcriptPath =
      raw.transcript_path || this.getTranscriptPath(raw.cwd, raw.session_id);

    return {
      type: eventType,
      sessionId: raw.session_id,
      transcriptPath,
      cwd: raw.cwd || process.cwd(),
      timestamp: new Date().toISOString(),
      toolName: raw.tool_name,
      toolInput: raw.tool_input,
      toolResponse: raw.tool_response,
      prompt: raw.prompt,
      sessionReason: raw.reason || raw.source,
      compactionTrigger: raw.trigger,
      notificationType: raw.notification_type,
      message: raw.message,
      rawEvent: raw as unknown as Record<string, unknown>,
      cliType: this.name,
    };
  }

  mapEventType(hookName: string): NormalizedEventType {
    const mapping: Record<string, NormalizedEventType> = {
      SessionStart: "session_start",
      SessionEnd: "session_end",
      UserPromptSubmit: "user_prompt",
      PreToolUse: "tool_use_start",
      PostToolUse: "tool_use",
      PermissionRequest: "permission_request",
      Stop: "agent_stop",
      SubagentStop: "subagent_stop",
      PreCompact: "context_compaction",
      Notification: "notification",
    };
    return mapping[hookName] || "notification";
  }
}
