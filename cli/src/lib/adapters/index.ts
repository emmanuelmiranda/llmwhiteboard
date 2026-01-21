/**
 * CLI Adapters
 *
 * Factory functions and utilities for working with CLI adapters.
 */

import { CliAdapter, CliType } from "../cli-adapter.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { GeminiCliAdapter } from "./gemini-cli.js";

// Singleton instances
const adapters: Record<CliType, CliAdapter> = {
  "claude-code": new ClaudeCodeAdapter(),
  "gemini-cli": new GeminiCliAdapter(),
};

/**
 * Get an adapter by CLI type
 */
export function getAdapter(cliType: CliType): CliAdapter {
  const adapter = adapters[cliType];
  if (!adapter) {
    throw new Error(`Unknown CLI type: ${cliType}`);
  }
  return adapter;
}

/**
 * Get all available adapters
 */
export function getAllAdapters(): CliAdapter[] {
  return Object.values(adapters);
}

/**
 * Get all CLI types
 */
export function getAllCliTypes(): CliType[] {
  return Object.keys(adapters) as CliType[];
}

/**
 * Detect which CLI tools are installed
 */
export async function detectInstalledClis(): Promise<CliType[]> {
  const installed: CliType[] = [];

  for (const [cliType, adapter] of Object.entries(adapters)) {
    if (await adapter.isInstalled()) {
      installed.push(cliType as CliType);
    }
  }

  return installed;
}

/**
 * Check if a specific CLI is installed
 */
export async function isCliInstalled(cliType: CliType): Promise<boolean> {
  const adapter = getAdapter(cliType);
  return adapter.isInstalled();
}

// Re-export adapters
export { ClaudeCodeAdapter } from "./claude-code.js";
export { GeminiCliAdapter } from "./gemini-cli.js";
