import fs from "fs/promises";
import path from "path";
import os from "os";
import { readConfig } from "./config.js";

const CLAUDE_CONFIG_DIR = path.join(os.homedir(), ".claude");
const HOOKS_FILE = path.join(CLAUDE_CONFIG_DIR, "settings.json");

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: string[];
    PostToolUse?: string[];
    Notification?: string[];
    Stop?: string[];
    SessionStart?: string[];
    SessionEnd?: string[];
  };
  [key: string]: unknown;
}

async function readClaudeSettings(): Promise<ClaudeSettings> {
  try {
    const data = await fs.readFile(HOOKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeClaudeSettings(settings: ClaudeSettings): Promise<void> {
  await fs.mkdir(CLAUDE_CONFIG_DIR, { recursive: true });
  await fs.writeFile(HOOKS_FILE, JSON.stringify(settings, null, 2));
}

function getHookScript(): string {
  // The hook script that will be called by Claude Code
  return `npx llmwhiteboard-hook`;
}

export async function installHooks(): Promise<void> {
  const settings = await readClaudeSettings();
  const hookScript = getHookScript();

  if (!settings.hooks) {
    settings.hooks = {};
  }

  const hookTypes = ["PostToolUse", "Stop", "SessionStart", "SessionEnd"] as const;

  for (const hookType of hookTypes) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = [];
    }

    // Remove any existing llmwhiteboard hooks
    settings.hooks[hookType] = settings.hooks[hookType]!.filter(
      (h) => !h.includes("llmwhiteboard")
    );

    // Add our hook
    settings.hooks[hookType]!.push(hookScript);
  }

  await writeClaudeSettings(settings);
}

export async function uninstallHooks(): Promise<void> {
  const settings = await readClaudeSettings();

  if (settings.hooks) {
    for (const hookType of Object.keys(settings.hooks) as (keyof typeof settings.hooks)[]) {
      if (Array.isArray(settings.hooks[hookType])) {
        settings.hooks[hookType] = settings.hooks[hookType]!.filter(
          (h) => !h.includes("llmwhiteboard")
        );
      }
    }
  }

  await writeClaudeSettings(settings);
}

export async function areHooksInstalled(): Promise<boolean> {
  const settings = await readClaudeSettings();

  if (!settings.hooks) return false;

  const hookTypes = ["PostToolUse", "Stop", "SessionStart", "SessionEnd"] as const;

  for (const hookType of hookTypes) {
    const hooks = settings.hooks[hookType];
    if (!hooks || !hooks.some((h) => h.includes("llmwhiteboard"))) {
      return false;
    }
  }

  return true;
}
