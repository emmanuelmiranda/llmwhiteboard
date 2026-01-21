#!/usr/bin/env node

/**
 * This script is called by Claude Code hooks to sync session events.
 * It reads the hook context from stdin and sends it to the LLM Whiteboard API.
 */

import fs from "fs/promises";
import path from "path";
import { readConfig, getMachineId, readEncryptionKey } from "./lib/config.js";
import { encrypt, computeChecksum } from "./lib/crypto.js";

interface HookContext {
  hook_event_name: "PreToolUse" | "PostToolUse" | "Notification" | "Stop" | "SessionStart" | "SessionEnd" | "PreCompact";
  session_id: string;
  cwd: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: { stdout?: string; stderr?: string };
  message?: string;
  transcript_path?: string;
  trigger?: "manual" | "auto"; // For PreCompact events
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  try {
    const config = await readConfig();
    if (!config) {
      // Not configured, silently exit
      process.exit(0);
    }

    const input = await readStdin();
    if (!input.trim()) {
      process.exit(0);
    }

    const context: HookContext = JSON.parse(input);
    const machineId = await getMachineId();

    // Map hook type to event type
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
      // Ignore hooks we don't care about
      process.exit(0);
    }

    // Extract suggested title from first user message
    // Claude Code passes the initial prompt in the message field on SessionStart
    let suggestedTitle: string | undefined;
    if (context.hook_event_name === "SessionStart" && context.message) {
      // Truncate to reasonable length for title
      suggestedTitle = context.message.length > 100
        ? context.message.substring(0, 97) + "..."
        : context.message;
    }

    // Build event summary based on type
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

    // Build the sync payload
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

    // Send to API
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

    // On session end, upload the full transcript
    if (context.hook_event_name === "SessionEnd" && context.transcript_path) {
      await uploadTranscript(config, context, machineId);
    }
  } catch (err) {
    // Silently fail to not interrupt Claude Code
    console.error(`LLM Whiteboard hook error: ${err instanceof Error ? err.message : err}`);
  }
}

async function uploadTranscript(
  config: { apiUrl: string; token: string; encryption?: { enabled: boolean } },
  context: HookContext,
  machineId: string
) {
  try {
    if (!context.transcript_path) return;

    let content: Buffer = await fs.readFile(context.transcript_path);
    let isEncrypted = false;

    // Encrypt if enabled
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
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: string };
      console.error(`LLM Whiteboard transcript upload failed: ${errorBody.error || response.status}`);
    }
  } catch (err) {
    console.error(`LLM Whiteboard transcript upload error: ${err instanceof Error ? err.message : err}`);
  }
}

main();
