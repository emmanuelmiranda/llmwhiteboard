/**
 * Hook Installation
 *
 * Manages hook installation and uninstallation for supported CLI tools.
 * Uses the adapter pattern to support multiple CLI tools (Claude Code, Gemini CLI).
 */

import { CliType, CliAdapter, HookEntry } from "./cli-adapter.js";
import { getAdapter, detectInstalledClis, getAllCliTypes } from "./adapters/index.js";

/**
 * Check if our hooks are installed in the given settings
 */
function hasLlmWhiteboardHook(hooks: HookEntry[]): boolean {
  return hooks.some((h) =>
    h.hooks?.some((hook) => hook.command?.includes("llmwhiteboard"))
  );
}

/**
 * Remove our hooks from a hook array
 */
function removeLlmWhiteboardHooks(hooks: HookEntry[]): HookEntry[] {
  return hooks.filter(
    (h) => !h.hooks?.some((hook) => hook.command?.includes("llmwhiteboard"))
  );
}

/**
 * Deep merge two objects
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Get the hook command for a specific CLI type
 */
function getHookCommand(cliType: CliType): string {
  return `npx llmwhiteboard hook --cli ${cliType}`;
}

/**
 * Install hooks for a specific CLI
 */
export async function installHooksForCli(
  cliType: CliType,
  scope: "user" | "project" = "user",
  projectPath?: string
): Promise<void> {
  const adapter = getAdapter(cliType);
  const hookCommand = getHookCommand(cliType);
  const hookConfig = adapter.getHookConfig(hookCommand);

  // Read current settings
  const settings = await adapter.readSettings(scope, projectPath);

  // Ensure hooks object exists
  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }

  const hooksObj = settings.hooks as Record<string, HookEntry[]>;

  // Add our hooks for each hook type
  for (const [hookType, hookEntries] of Object.entries(hookConfig.hooks)) {
    if (!Array.isArray(hooksObj[hookType])) {
      hooksObj[hookType] = [];
    }

    // Remove any existing llmwhiteboard hooks
    hooksObj[hookType] = removeLlmWhiteboardHooks(hooksObj[hookType]);

    // Add new hooks
    hooksObj[hookType].push(...(hookEntries as HookEntry[]));
  }

  // Apply additional settings (e.g., experimental flags for Gemini)
  let finalSettings = settings;
  if (hookConfig.additionalSettings) {
    finalSettings = deepMerge(settings, hookConfig.additionalSettings);
  }

  // Write settings back
  await adapter.writeSettings(finalSettings, scope, projectPath);
}

/**
 * Uninstall hooks for a specific CLI
 */
export async function uninstallHooksForCli(
  cliType: CliType,
  scope: "user" | "project" = "user",
  projectPath?: string
): Promise<void> {
  const adapter = getAdapter(cliType);

  // Read current settings
  const settings = await adapter.readSettings(scope, projectPath);

  if (!settings.hooks || typeof settings.hooks !== "object") {
    return;
  }

  const hooksObj = settings.hooks as Record<string, HookEntry[]>;
  const defaultHooks = adapter.getDefaultHooks();

  // Remove our hooks from each hook type
  for (const hookType of defaultHooks) {
    if (Array.isArray(hooksObj[hookType])) {
      hooksObj[hookType] = removeLlmWhiteboardHooks(hooksObj[hookType]);
    }
  }

  // Write settings back
  await adapter.writeSettings(settings, scope, projectPath);
}

/**
 * Check if hooks are installed for a specific CLI
 */
export async function areHooksInstalledForCli(
  cliType: CliType,
  scope: "user" | "project" = "user",
  projectPath?: string
): Promise<boolean> {
  const adapter = getAdapter(cliType);
  const settings = await adapter.readSettings(scope, projectPath);

  if (!settings.hooks || typeof settings.hooks !== "object") {
    return false;
  }

  const hooksObj = settings.hooks as Record<string, HookEntry[]>;
  const defaultHooks = adapter.getDefaultHooks();

  // Check if all default hooks are installed
  for (const hookType of defaultHooks) {
    const hooks = hooksObj[hookType];
    if (!hooks || !hasLlmWhiteboardHook(hooks)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the settings file path for a specific CLI
 */
export function getHooksFilePath(
  cliType: CliType,
  scope: "user" | "project" = "user",
  projectPath?: string
): string {
  const adapter = getAdapter(cliType);
  return adapter.getSettingsPath(scope, projectPath);
}

// ============================================================================
// Legacy API (for backwards compatibility with existing code)
// These functions default to Claude Code behavior
// ============================================================================

/**
 * Install hooks for Claude Code (legacy API)
 */
export async function installHooks(projectPath?: string): Promise<void> {
  const scope = projectPath ? "project" : "user";
  await installHooksForCli("claude-code", scope, projectPath);
}

/**
 * Uninstall hooks for Claude Code (legacy API)
 */
export async function uninstallHooks(projectPath?: string): Promise<void> {
  const scope = projectPath ? "project" : "user";
  await uninstallHooksForCli("claude-code", scope, projectPath);
}

/**
 * Check if hooks are installed for Claude Code (legacy API)
 */
export async function areHooksInstalled(projectPath?: string): Promise<boolean> {
  const scope = projectPath ? "project" : "user";
  return areHooksInstalledForCli("claude-code", scope, projectPath);
}

// ============================================================================
// Multi-CLI functions
// ============================================================================

/**
 * Install hooks for multiple CLIs
 */
export async function installHooksForClis(
  cliTypes: CliType[],
  scope: "user" | "project" = "user",
  projectPath?: string
): Promise<Map<CliType, boolean>> {
  const results = new Map<CliType, boolean>();

  for (const cliType of cliTypes) {
    try {
      await installHooksForCli(cliType, scope, projectPath);
      results.set(cliType, true);
    } catch {
      results.set(cliType, false);
    }
  }

  return results;
}

/**
 * Uninstall hooks for all installed CLIs
 */
export async function uninstallAllHooks(
  scope: "user" | "project" = "user",
  projectPath?: string
): Promise<void> {
  const installedClis = await detectInstalledClis();

  for (const cliType of installedClis) {
    try {
      await uninstallHooksForCli(cliType, scope, projectPath);
    } catch {
      // Ignore errors, continue with other CLIs
    }
  }
}

/**
 * Get hook status for all CLIs
 */
export async function getHooksStatus(
  scope: "user" | "project" = "user",
  projectPath?: string
): Promise<Map<CliType, { installed: boolean; cliInstalled: boolean }>> {
  const results = new Map<CliType, { installed: boolean; cliInstalled: boolean }>();

  for (const cliType of getAllCliTypes()) {
    const adapter = getAdapter(cliType);
    const cliInstalled = await adapter.isInstalled();
    let installed = false;

    if (cliInstalled) {
      installed = await areHooksInstalledForCli(cliType, scope, projectPath);
    }

    results.set(cliType, { installed, cliInstalled });
  }

  return results;
}

// Re-export types and utilities
export { detectInstalledClis, getAdapter, getAllCliTypes } from "./adapters/index.js";
export type { CliType } from "./cli-adapter.js";
