/**
 * Hook command - processes hook events from LLM CLI tools.
 * This is called via `npx llmwhiteboard hook --cli <type>` by CLI hooks.
 *
 * Supports:
 * - Claude Code (--cli claude-code)
 * - Gemini CLI (--cli gemini-cli)
 */

import fs from "fs/promises";
import path from "path";
import { readConfig, getMachineId, readEncryptionKey, CONFIG_DIR } from "../lib/config.js";
import { encrypt, computeChecksum } from "../lib/crypto.js";
import { CliType, NormalizedHookContext } from "../lib/cli-adapter.js";
import { getAdapter } from "../lib/adapters/index.js";

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

async function tryReadTranscriptTitle(transcriptPath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(transcriptPath, "utf-8");
    return extractFirstUserMessage(content);
  } catch {
    return undefined;
  }
}

async function uploadTranscript(
  config: { apiUrl: string; token: string; encryption?: { enabled: boolean } },
  context: NormalizedHookContext,
  machineId: string
): Promise<boolean> {
  try {
    const transcriptPath = context.transcriptPath;

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
        localSessionId: context.sessionId,
        machineId,
        content: content.toString("base64"),
        isEncrypted,
        checksum,
        suggestedTitle,
        cliType: context.cliType,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: string };
      console.error(`LLM Whiteboard transcript upload failed: ${errorBody.error || response.status}`);
      return false;
    }

    // Update last sync time on success
    await setLastSyncTime(context.sessionId);
    return true;
  } catch (err) {
    console.error(`LLM Whiteboard transcript upload error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// Map normalized event types to API event types
const eventTypeMap: Record<string, string> = {
  session_start: "session_start",
  session_end: "session_end",
  user_prompt: "user_prompt",
  tool_use: "tool_use",
  tool_use_start: "tool_use_start",
  agent_stop: "stop",
  subagent_stop: "subagent_stop",
  context_compaction: "compaction",
  permission_request: "permission_request",
  notification: "message",
  model_request: "model_request",
  model_response: "model_response",
};

export async function hookCommand(cliType: CliType = "claude-code"): Promise<void> {
  try {
    const config = await readConfig();
    if (!config) {
      process.exit(0);
    }

    const input = await readStdin();
    if (!input.trim()) {
      process.exit(0);
    }

    // Get the appropriate adapter and parse the context
    const adapter = getAdapter(cliType);
    const context = adapter.parseHookContext(input);

    const machineId = await getMachineId();

    const eventType = eventTypeMap[context.type];
    if (!eventType) {
      process.exit(0);
    }

    // Try to get suggested title from transcript
    let suggestedTitle: string | undefined;
    if (context.type === "tool_use" || context.type === "agent_stop") {
      suggestedTitle = await tryReadTranscriptTitle(context.transcriptPath);
    }

    // Build event summary and metadata
    let eventSummary: string | undefined;
    let eventMetadata: Record<string, unknown> = {};

    if (context.type === "user_prompt") {
      const prompt = context.prompt || "";
      eventSummary = prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt;
      eventMetadata = { prompt };
      if (!suggestedTitle) {
        suggestedTitle = eventSummary;
      }
    } else if (context.type === "context_compaction") {
      eventSummary = context.compactionTrigger === "auto"
        ? "Auto-compaction triggered (context full)"
        : "Manual compaction triggered";
      if (context.compactionTrigger) eventMetadata.trigger = context.compactionTrigger;
    } else if (context.toolName) {
      eventSummary = `Used ${context.toolName}`;
      if (context.toolInput) eventMetadata.input = context.toolInput;
    } else {
      eventSummary = context.message;
    }

    const payload = {
      localSessionId: context.sessionId,
      projectPath: context.cwd,
      machineId,
      suggestedTitle,
      cliType: context.cliType,
      event: {
        type: eventType,
        toolName: context.toolName,
        summary: eventSummary,
        metadata: eventMetadata,
      },
      timestamp: context.timestamp,
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
      // Always upload on session end
      context.type === "session_end" ||
      // Always upload on context compaction (before context gets summarized)
      context.type === "context_compaction" ||
      // Upload on agent stop if enough time has passed (throttled)
      (context.type === "agent_stop" &&
        shouldUploadTranscript(await getLastSyncTime(context.sessionId), DEFAULT_SYNC_INTERVAL_SECONDS));

    if (shouldUpload) {
      await uploadTranscript(config, context, machineId);
    }
  } catch (err) {
    console.error(`LLM Whiteboard hook error: ${err instanceof Error ? err.message : err}`);
  }
}
