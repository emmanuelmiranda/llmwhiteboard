/**
 * Gemini CLI Adapter
 *
 * Implements the CliAdapter interface for Gemini CLI.
 * Handles all Gemini CLI specific logic for hooks, settings, and transcripts.
 *
 * Note: Gemini CLI hooks are currently experimental and require explicit opt-in.
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  CliAdapter,
  CliType,
  NormalizedEventType,
  NormalizedHookContext,
  HookConfiguration,
  HookEntry,
} from "../cli-adapter.js";

// Gemini CLI hook event names
type GeminiHookEvent =
  | "SessionStart"
  | "SessionEnd"
  | "BeforeAgent"
  | "AfterAgent"
  | "BeforeTool"
  | "AfterTool"
  | "BeforeModel"
  | "AfterModel"
  | "BeforeToolSelection"
  | "Notification"
  | "PreCompress";

// Gemini CLI stdin context
interface GeminiHookContext {
  hook_event_name: GeminiHookEvent;
  session_id: string;
  cwd: string;
  transcript_path?: string;
  timestamp?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  prompt?: string;
  prompt_response?: string;
  llm_request?: unknown;
  llm_response?: unknown;
  trigger?: "manual" | "auto";
  reason?: "exit" | "clear" | "logout" | "prompt_input_exit" | "other";
  notification_type?: string;
  message?: string;
}

export class GeminiCliAdapter implements CliAdapter {
  readonly name: CliType = "gemini-cli";
  readonly displayName = "Gemini CLI";

  private readonly configDir = path.join(os.homedir(), ".gemini");

  async isInstalled(): Promise<boolean> {
    try {
      await fs.access(this.configDir);
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    // Could try running `gemini --version` but that requires spawning a process
    return null;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  getSettingsPath(scope: "user" | "project", projectPath?: string): string {
    if (scope === "project" && projectPath) {
      return path.join(projectPath, ".gemini", "settings.json");
    }
    return path.join(this.configDir, "settings.json");
  }

  getTranscriptPath(projectPath: string, sessionId: string): string {
    // Gemini uses a hash of the project path for the tmp directory
    const projectHash = this.hashProjectPath(projectPath);
    return path.join(this.configDir, "tmp", projectHash, "chats", `${sessionId}.json`);
  }

  private hashProjectPath(projectPath: string): string {
    return crypto.createHash("md5").update(projectPath).digest("hex").slice(0, 16);
  }

  getSupportedHooks(): string[] {
    return [
      "SessionStart",
      "SessionEnd",
      "BeforeAgent",
      "AfterAgent",
      "BeforeTool",
      "AfterTool",
      "BeforeModel",
      "AfterModel",
      "BeforeToolSelection",
      "Notification",
      "PreCompress",
    ];
  }

  getDefaultHooks(): string[] {
    // Hooks enabled by default for syncing
    // PreCompress fires on manual (/compress) or auto (context threshold) compression
    return [
      "SessionStart",
      "SessionEnd",
      "BeforeAgent",
      "AfterAgent",
      "AfterTool",
      "PreCompress",
    ];
  }

  getHookConfig(hookCommand: string): HookConfiguration {
    const hooks: Record<string, HookEntry[]> = {};

    for (const hookName of this.getDefaultHooks()) {
      hooks[hookName] = [this.createHookEntry(hookCommand)];
    }

    return {
      hooks,
      // Gemini CLI requires explicit opt-in for hooks
      additionalSettings: {
        hooks: {
          enabled: true,
        },
      },
      isExperimental: true,
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

  getResumeCommand(sessionId: string, _projectPath?: string): string {
    return `gemini --resume ${sessionId}`;
  }

  getListSessionsCommand(): string {
    return "gemini --list-sessions";
  }

  parseHookContext(stdin: string): NormalizedHookContext {
    const raw: GeminiHookContext = JSON.parse(stdin);
    const eventType = this.mapEventType(raw.hook_event_name);

    // Calculate transcript path if not provided
    const transcriptPath =
      raw.transcript_path || this.getTranscriptPath(raw.cwd, raw.session_id);

    return {
      type: eventType,
      sessionId: raw.session_id,
      transcriptPath,
      cwd: raw.cwd || process.cwd(),
      timestamp: raw.timestamp || new Date().toISOString(),
      toolName: raw.tool_name,
      toolInput: raw.tool_input,
      toolResponse: raw.tool_response,
      prompt: raw.prompt,
      promptResponse: raw.prompt_response,
      sessionReason: raw.reason,
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
      BeforeAgent: "user_prompt",
      AfterAgent: "agent_stop",
      BeforeTool: "tool_use_start",
      AfterTool: "tool_use",
      BeforeModel: "model_request",
      AfterModel: "model_response",
      PreCompress: "context_compaction",
      Notification: "notification",
    };
    return mapping[hookName] || "notification";
  }
}
