/**
 * Hook command - processes hook events from Claude Code.
 * This is called via `npx llmwhiteboard hook` by Claude Code hooks.
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import { readConfig, getMachineId, readEncryptionKey, CONFIG_DIR } from "../lib/config.js";
import { encrypt, computeChecksum } from "../lib/crypto.js";

// Default sync interval in seconds (upload transcript at most this often on Stop events)
const DEFAULT_SYNC_INTERVAL_SECONDS = 60;

// File to track last upload times per session
const LAST_SYNC_FILE = path.join(CONFIG_DIR, "last-sync.json");

interface LastSyncData {
  [sessionId: string]: number; // timestamp in ms
}

async function getLastSyncTime(sessionId: string): Promise<number> {
  try {
    const data = await fs.readFile(LAST_SYNC_FILE, "utf-8");
    const syncData: LastSyncData = JSON.parse(data);
    return syncData[sessionId] || 0;
  } catch {
    return 0;
  }
}

async function setLastSyncTime(sessionId: string): Promise<void> {
  let syncData: LastSyncData = {};
  try {
    const data = await fs.readFile(LAST_SYNC_FILE, "utf-8");
    syncData = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }
  syncData[sessionId] = Date.now();
  await fs.writeFile(LAST_SYNC_FILE, JSON.stringify(syncData));
}

function shouldUploadTranscript(lastSyncTime: number, intervalSeconds: number): boolean {
  const elapsed = Date.now() - lastSyncTime;
  return elapsed >= intervalSeconds * 1000;
}

interface HookContext {
  hook_event_name: "PreToolUse" | "PostToolUse" | "Notification" | "Stop" | "SessionStart" | "SessionEnd" | "PreCompact";
  session_id: string;
  cwd: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: { stdout?: string; stderr?: string };
  message?: string;
  transcript_path?: string;
  trigger?: "manual" | "auto";
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function extractFirstUserMessage(transcriptContent: string): string | undefined {
  try {
    const lines = transcriptContent.split("\n").filter(line => line.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "user" && entry.message?.content) {
          const content = entry.message.content;
          if (typeof content === "string" && content.trim()) {
            const trimmed = content.trim();
            return trimmed.length > 100 ? trimmed.substring(0, 97) + "..." : trimmed;
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined;
}

function getTranscriptPath(cwd: string, sessionId: string): string {
  // Convert path separators to dashes (: \ / -> -)
  // Using charCodeAt because regex escaping is unreliable for backslashes
  const projectFolder = cwd.split("").map(c => {
    const code = c.charCodeAt(0);
    if (code === 58 || code === 92 || code === 47) return "-"; // : \ /
    return c;
  }).join("").replace(/^-+/, "");
  return path.join(os.homedir(), ".claude", "projects", projectFolder, `${sessionId}.jsonl`);
}

async function tryReadTranscriptTitle(cwd: string, sessionId: string): Promise<string | undefined> {
  try {
    const transcriptPath = getTranscriptPath(cwd, sessionId);
    const content = await fs.readFile(transcriptPath, "utf-8");
    return extractFirstUserMessage(content);
  } catch {
    return undefined;
  }
}

async function uploadTranscript(
  config: { apiUrl: string; token: string; encryption?: { enabled: boolean } },
  context: HookContext,
  machineId: string
): Promise<boolean> {
  try {
    // Use provided transcript_path or calculate it
    const transcriptPath = context.transcript_path || getTranscriptPath(context.cwd, context.session_id);

    let content: Buffer;
    try {
      content = await fs.readFile(transcriptPath);
    } catch {
      // Transcript file doesn't exist yet
      return false;
    }

    const rawContent = content.toString("utf-8");
    let isEncrypted = false;

    const suggestedTitle = extractFirstUserMessage(rawContent);

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
        localSessionId: context.session_id,
        machineId,
        content: content.toString("base64"),
        isEncrypted,
        checksum,
        suggestedTitle,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: string };
      console.error(`LLM Whiteboard transcript upload failed: ${errorBody.error || response.status}`);
      return false;
    }

    // Update last sync time on success
    await setLastSyncTime(context.session_id);
    return true;
  } catch (err) {
    console.error(`LLM Whiteboard transcript upload error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function hookCommand(): Promise<void> {
  try {
    const config = await readConfig();
    if (!config) {
      process.exit(0);
    }

    const input = await readStdin();
    if (!input.trim()) {
      process.exit(0);
    }

    const context: HookContext = JSON.parse(input);
    const machineId = await getMachineId();

    const eventTypeMap: Record<string, string> = {
      SessionStart: "session_start",
      SessionEnd: "session_end",
      PostToolUse: "tool_use",
      Stop: "stop",
      Notification: "message",
      PreCompact: "compaction",
    };

    const eventType = eventTypeMap[context.hook_event_name];
    if (!eventType) {
      process.exit(0);
    }

    let suggestedTitle: string | undefined;
    if (context.hook_event_name === "PostToolUse" || context.hook_event_name === "Stop") {
      suggestedTitle = await tryReadTranscriptTitle(context.cwd, context.session_id);
    }

    let eventSummary: string | undefined;
    if (context.hook_event_name === "PreCompact") {
      eventSummary = context.trigger === "auto"
        ? "Auto-compaction triggered (context full)"
        : "Manual compaction triggered";
    } else if (context.tool_name) {
      eventSummary = `Used ${context.tool_name}`;
    } else {
      eventSummary = context.message;
    }

    const payload = {
      localSessionId: context.session_id,
      projectPath: context.cwd,
      machineId,
      suggestedTitle,
      event: {
        type: eventType,
        toolName: context.tool_name,
        summary: eventSummary,
        metadata: {
          ...(context.tool_input && { input: context.tool_input }),
          ...(context.trigger && { trigger: context.trigger }),
        },
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${config.apiUrl}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: string };
      console.error(`LLM Whiteboard sync failed: ${errorBody.error || response.status}`);
    }

    // Upload transcript based on event type
    const shouldUpload =
      // Always upload on SessionEnd
      context.hook_event_name === "SessionEnd" ||
      // Always upload on PreCompact (before context gets summarized)
      context.hook_event_name === "PreCompact" ||
      // Upload on Stop if enough time has passed (throttled)
      (context.hook_event_name === "Stop" &&
        shouldUploadTranscript(await getLastSyncTime(context.session_id), DEFAULT_SYNC_INTERVAL_SECONDS));

    if (shouldUpload) {
      await uploadTranscript(config, context, machineId);
    }
  } catch (err) {
    console.error(`LLM Whiteboard hook error: ${err instanceof Error ? err.message : err}`);
  }
}
