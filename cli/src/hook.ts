#!/usr/bin/env node

/**
 * This script is called by Claude Code hooks to sync session events.
 * It reads the hook context from stdin and sends it to the LLM Whiteboard API.
 */

import fs from "fs/promises";
import * as fsSync from "fs";
import path from "path";
import os from "os";
import { readConfig, getMachineId, readEncryptionKey } from "./lib/config.js";
import { encrypt, computeChecksum } from "./lib/crypto.js";

interface HookContext {
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "Notification" | "Stop" | "SessionStart" | "SessionEnd" | "PreCompact";
  session_id: string;
  cwd: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: { stdout?: string; stderr?: string };
  message?: string;
  transcript_path?: string;
  trigger?: "manual" | "auto"; // For PreCompact events
  prompt?: string; // For UserPromptSubmit events
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

    // Debug: log all hook payloads to a file to diagnose issues
    const debugPath = path.join(os.homedir(), "llmwhiteboard-debug.log");
    const debugInfo = {
      timestamp: new Date().toISOString(),
      event: context.hook_event_name,
      hasPrompt: !!context.prompt,
      promptLength: context.prompt?.length || 0,
      promptPreview: context.prompt?.substring(0, 100) || "(none)",
      keys: Object.keys(context),
    };
    fsSync.appendFileSync(debugPath, JSON.stringify(debugInfo) + "\n");
    const machineId = await getMachineId();

    // Map hook type to event type
    const eventTypeMap: Record<string, string> = {
      UserPromptSubmit: "user_prompt",
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

    // Try to extract title from transcript for early events (PostToolUse, Stop)
    // This gets the title as soon as the user types their first message
    let suggestedTitle: string | undefined;
    if (context.hook_event_name === "PostToolUse" || context.hook_event_name === "Stop") {
      suggestedTitle = await tryReadTranscriptTitle(context.cwd, context.session_id);
    }

    // Build event summary based on type
    let eventSummary: string | undefined;
    let eventMetadata: Record<string, unknown> = {};

    if (context.hook_event_name === "UserPromptSubmit") {
      // Truncate prompt for summary, store full prompt in metadata
      const prompt = context.prompt || "";
      eventSummary = prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt;
      eventMetadata = { prompt };
      // Use prompt as suggested title if this is the first message
      if (!suggestedTitle) {
        suggestedTitle = eventSummary;
      }
    } else if (context.hook_event_name === "PreCompact") {
      eventSummary = context.trigger === "auto"
        ? "Auto-compaction triggered (context full)"
        : "Manual compaction triggered";
      if (context.trigger) eventMetadata.trigger = context.trigger;
    } else if (context.tool_name) {
      eventSummary = `Used ${context.tool_name}`;
      if (context.tool_input) eventMetadata.input = context.tool_input;
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
        metadata: eventMetadata,
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

function extractFirstUserMessage(transcriptContent: string): string | undefined {
  try {
    const lines = transcriptContent.split("\n").filter(line => line.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        // Claude Code format: type === "user" with message.content
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
  // Claude stores transcripts at ~/.claude/projects/<project-folder>/<session-id>.jsonl
  // Project folder is cwd with path separators replaced: D:\sources\foo -> D--sources-foo
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
    // Transcript may not exist yet or be unreadable
    return undefined;
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
    const rawContent = content.toString("utf-8");
    let isEncrypted = false;

    // Extract first user message for title (before encryption)
    const suggestedTitle = extractFirstUserMessage(rawContent);

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
        suggestedTitle,
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
