/**
 * Sync command - manually upload transcript for current or specified session
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import { readConfig, getMachineId, readEncryptionKey } from "../lib/config.js";
import { encrypt, computeChecksum } from "../lib/crypto.js";

interface SyncOptions {
  session?: string;
  all?: boolean;
}

function getProjectFolder(cwd: string): string {
  return cwd.split("").map(c => {
    const code = c.charCodeAt(0);
    if (code === 58 || code === 92 || code === 47) return "-";
    return c;
  }).join("").replace(/^-+/, "");
}

async function findSessions(cwd: string): Promise<Array<{ sessionId: string; path: string; mtime: Date }>> {
  const projectFolder = getProjectFolder(cwd);
  const projectDir = path.join(os.homedir(), ".claude", "projects", projectFolder);

  try {
    const files = await fs.readdir(projectDir);
    const sessions: Array<{ sessionId: string; path: string; mtime: Date }> = [];

    for (const file of files) {
      if (file.endsWith(".jsonl")) {
        const filePath = path.join(projectDir, file);
        const stat = await fs.stat(filePath);
        sessions.push({
          sessionId: file.replace(".jsonl", ""),
          path: filePath,
          mtime: stat.mtime,
        });
      }
    }

    // Sort by most recent first
    return sessions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return [];
  }
}

async function uploadTranscript(
  config: { apiUrl: string; token: string; encryption?: { enabled: boolean } },
  sessionId: string,
  transcriptPath: string,
  machineId: string
): Promise<boolean> {
  let content: Buffer = await fs.readFile(transcriptPath);
  let isEncrypted = false;

  // Extract title from first user message
  const rawContent = content.toString("utf-8");
  let suggestedTitle: string | undefined;
  try {
    const lines = rawContent.split("\n").filter(line => line.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "user" && entry.message?.content) {
          const text = entry.message.content;
          if (typeof text === "string" && text.trim()) {
            const trimmed = text.trim();
            suggestedTitle = trimmed.length > 100 ? trimmed.substring(0, 97) + "..." : trimmed;
            break;
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Ignore parsing errors
  }

  if (config.encryption?.enabled) {
    const key = await readEncryptionKey();
    if (key) {
      content = encrypt(content, key) as Buffer;
      isEncrypted = true;
    }
  }

  const checksum = computeChecksum(content);

  const response = await fetch(`${config.apiUrl}/api/sync/transcript`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      localSessionId: sessionId,
      machineId,
      content: content.toString("base64"),
      isEncrypted,
      checksum,
      suggestedTitle,
    }),
  });

  return response.ok;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(chalk.red("Not configured. Run 'npx llmwhiteboard init' first."));
    process.exit(1);
  }

  const machineId = await getMachineId();
  const cwd = process.cwd();

  // Find sessions for current directory
  const sessions = await findSessions(cwd);

  if (sessions.length === 0) {
    console.log(chalk.yellow("No Claude Code sessions found for this directory."));
    console.log(chalk.dim(`Looking in: ~/.claude/projects/${getProjectFolder(cwd)}/`));
    return;
  }

  let sessionsToSync: typeof sessions = [];

  if (options.session) {
    // Sync specific session
    const session = sessions.find(s => s.sessionId === options.session || s.sessionId.startsWith(options.session!));
    if (!session) {
      console.error(chalk.red(`Session not found: ${options.session}`));
      console.log(chalk.dim("Available sessions:"));
      sessions.slice(0, 5).forEach(s => {
        console.log(chalk.dim(`  ${s.sessionId} (${s.mtime.toLocaleString()})`));
      });
      return;
    }
    sessionsToSync = [session];
  } else if (options.all) {
    // Sync all sessions
    sessionsToSync = sessions;
  } else {
    // Sync most recent session
    sessionsToSync = [sessions[0]];
  }

  const spinner = ora(`Syncing ${sessionsToSync.length} session(s)...`).start();

  let successCount = 0;
  for (const session of sessionsToSync) {
    try {
      spinner.text = `Syncing ${session.sessionId.slice(0, 8)}...`;
      const success = await uploadTranscript(config, session.sessionId, session.path, machineId);
      if (success) {
        successCount++;
      }
    } catch (err) {
      // Continue with other sessions
    }
  }

  if (successCount === sessionsToSync.length) {
    spinner.succeed(`Synced ${successCount} session(s)`);
  } else if (successCount > 0) {
    spinner.warn(`Synced ${successCount}/${sessionsToSync.length} session(s)`);
  } else {
    spinner.fail("Failed to sync sessions");
  }
}
