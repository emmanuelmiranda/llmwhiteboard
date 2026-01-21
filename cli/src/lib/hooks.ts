import fs from "fs/promises";
import path from "path";
import os from "os";
import { readConfig } from "./config.js";

const GLOBAL_CLAUDE_CONFIG_DIR = path.join(os.homedir(), ".claude");
const GLOBAL_HOOKS_FILE = path.join(GLOBAL_CLAUDE_CONFIG_DIR, "settings.json");

function getHooksFile(projectPath?: string): { dir: string; file: string } {
  if (projectPath) {
    const dir = path.join(projectPath, ".claude");
    return { dir, file: path.join(dir, "settings.local.json") };
  }
  return { dir: GLOBAL_CLAUDE_CONFIG_DIR, file: GLOBAL_HOOKS_FILE };
}

// New Claude Code hook format
interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string }>;
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookEntry[];
    PostToolUse?: HookEntry[];
    Notification?: HookEntry[];
    Stop?: HookEntry[];
    SessionStart?: HookEntry[];
    SessionEnd?: HookEntry[];
  };
  [key: string]: unknown;
}

async function readClaudeSettings(projectPath?: string): Promise<ClaudeSettings> {
  try {
    const { file } = getHooksFile(projectPath);
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeClaudeSettings(settings: ClaudeSettings, projectPath?: string): Promise<void> {
  const { dir, file } = getHooksFile(projectPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(settings, null, 2));
}

function getHookCommand(): string {
  return "npx llmwhiteboard-hook";
}

function createHookEntry(command: string, matcher?: string): HookEntry {
  const entry: HookEntry = {
    hooks: [{ type: "command", command }]
  };
  if (matcher !== undefined) {
    entry.matcher = matcher;
  }
  return entry;
}

function hasLlmWhiteboardHook(hooks: HookEntry[]): boolean {
  return hooks.some(h =>
    h.hooks?.some(hook => hook.command?.includes("llmwhiteboard"))
  );
}

function removeLlmWhiteboardHooks(hooks: HookEntry[]): HookEntry[] {
  return hooks.filter(h =>
    !h.hooks?.some(hook => hook.command?.includes("llmwhiteboard"))
  );
}

export async function installHooks(projectPath?: string): Promise<void> {
  const settings = await readClaudeSettings(projectPath);
  const hookCommand = getHookCommand();

  if (!settings.hooks) {
    settings.hooks = {};
  }

  // PostToolUse needs a matcher, others don't
  const hookConfigs = [
    { type: "PostToolUse" as const, matcher: "*" },
    { type: "Stop" as const, matcher: undefined },
    { type: "SessionStart" as const, matcher: undefined },
    { type: "SessionEnd" as const, matcher: undefined },
  ];

  for (const { type: hookType, matcher } of hookConfigs) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = [];
    }

    // Remove any existing llmwhiteboard hooks
    settings.hooks[hookType] = removeLlmWhiteboardHooks(settings.hooks[hookType]!);

    // Add our hook
    settings.hooks[hookType]!.push(createHookEntry(hookCommand, matcher));
  }

  await writeClaudeSettings(settings, projectPath);
}

export async function uninstallHooks(projectPath?: string): Promise<void> {
  const settings = await readClaudeSettings(projectPath);

  if (settings.hooks) {
    const hookTypes = ["PostToolUse", "Stop", "SessionStart", "SessionEnd"] as const;
    for (const hookType of hookTypes) {
      if (Array.isArray(settings.hooks[hookType])) {
        settings.hooks[hookType] = removeLlmWhiteboardHooks(settings.hooks[hookType]!);
      }
    }
  }

  await writeClaudeSettings(settings, projectPath);
}

export async function areHooksInstalled(projectPath?: string): Promise<boolean> {
  const settings = await readClaudeSettings(projectPath);

  if (!settings.hooks) return false;

  const hookTypes = ["PostToolUse", "Stop", "SessionStart", "SessionEnd"] as const;

  for (const hookType of hookTypes) {
    const hooks = settings.hooks[hookType];
    if (!hooks || !hasLlmWhiteboardHook(hooks)) {
      return false;
    }
  }

  return true;
}

export function getHooksFilePath(projectPath?: string): string {
  return getHooksFile(projectPath).file;
}
