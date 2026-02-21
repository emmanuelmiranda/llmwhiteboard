/**
 * LLM Whiteboard Sync Hook for OpenClaw
 *
 * Forwards OpenClaw events to LLM Whiteboard dashboard for visualization.
 *
 * Events captured:
 * - Agent runs (LLM inferences)
 * - Tool executions
 * - Session lifecycle
 * - Gateway operations (message routing)
 */

import type { InternalHookEvent } from '../../src/hooks/internal-hooks.js';

// Configuration from environment variables
const LLMWHITEBOARD_API_URL = process.env.LLMWHITEBOARD_API_URL || 'http://host.docker.internal:22001';
const LLMWHITEBOARD_TOKEN = process.env.LLMWHITEBOARD_TOKEN || '';

// Track active sessions
const activeSessions = new Map<string, {
  sessionId: string;
  startTime: Date;
  provider?: string;
  model?: string;
  messageChannel?: string;
  startEventSent: boolean; // Track if we've sent session_start for this session
}>();

// Track assistant responses per runId
const assistantResponses = new Map<string, {
  content: string;
  userMessage?: string;
}>();

/**
 * Map OpenClaw event types to llmwhiteboard event types
 */
function mapEventType(type: string, action: string): string {
  // Agent events
  if (type === 'agent') {
    if (action === 'bootstrap') return 'session_start';
    if (action === 'inference_start') return 'user_prompt';
    if (action === 'inference_end') return 'tool_use';
    if (action === 'tool_start') return 'tool_use_start';
    if (action === 'tool_end') return 'tool_use';
  }

  // Session events
  if (type === 'session') {
    if (action === 'start') return 'session_start';
    if (action === 'end') return 'session_end';
  }

  // Command events
  if (type === 'command') {
    return 'notification';
  }

  return 'notification';
}

/**
 * Extract or create a stable session ID from context
 * OpenClaw creates new sessionIds frequently, so we need a more stable identifier
 */
function extractSessionId(event: InternalHookEvent): string | null {
  const ctx = event.context;

  // For agent events, use the actual sessionId from context (stable per conversation)
  if (ctx.sessionId && typeof ctx.sessionId === 'string') {
    return ctx.sessionId as string;
  }

  // Fallback to sessionKey for other events
  return ctx.sessionKey as string || event.sessionKey || null;
}

/**
 * Extract provider and model from context
 */
function extractProviderModel(event: InternalHookEvent): { provider?: string; model?: string } {
  const ctx = event.context;
  return {
    provider: ctx.provider as string,
    model: ctx.model as string
  };
}

/**
 * Forward event to llmwhiteboard API
 */
async function forwardEvent(payload: {
  localSessionId: string;
  projectPath: string;
  machineId: string;
  cliType: string;
  event: {
    type: string;
    toolName?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: string;
}): Promise<void> {
  if (!LLMWHITEBOARD_TOKEN) {
    console.warn('[llmwhiteboard-sync] No LLMWHITEBOARD_TOKEN set, skipping sync');
    return;
  }

  try {
    const response = await fetch(`${LLMWHITEBOARD_API_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLMWHITEBOARD_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[llmwhiteboard-sync] API error: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('[llmwhiteboard-sync] Failed to forward event:', error);
  }
}

/**
 * Main hook handler
 */
export default async function handler(event: InternalHookEvent): Promise<void> {
  // Skip gateway events entirely - they're just infrastructure noise
  if (event.type === 'gateway') {
    return;
  }

  console.log(`[llmwhiteboard-sync] Event: ${event.type}:${event.action} sessionKey=${event.sessionKey}`);

  // Use sessionKey from event if sessionId not in context
  const sessionId = extractSessionId(event) || event.sessionKey;
  console.log(`[llmwhiteboard-sync] Resolved sessionId: ${sessionId} (context.sessionId=${event.context.sessionId})`);

  if (!sessionId) {
    console.log('[llmwhiteboard-sync] No sessionId, skipping');
    return;
  }

  const eventType = mapEventType(event.type, event.action);
  const { provider, model } = extractProviderModel(event);

  // Extract platform/channel - try multiple fields
  const messageChannel = (event.context.messageChannel as string) ||
                         (event.context.platform as string) ||
                         (event.context.channel as string);

  // Extract provider/model from config for bootstrap events
  let effectiveProvider = provider;
  let effectiveModel = model;

  if (event.type === 'agent' && event.action === 'bootstrap' && event.context.cfg) {
    const cfg = event.context.cfg as any;
    if (cfg.agents?.defaults?.model?.primary) {
      const primaryModel = cfg.agents.defaults.model.primary;
      // Parse "provider/model" format
      const parts = primaryModel.split('/');
      if (parts.length === 2) {
        effectiveProvider = parts[0];
        effectiveModel = parts[1];
        console.log(`[llmwhiteboard-sync] Extracted from config: ${effectiveProvider}/${effectiveModel}`);
      }
    }
  }

  // If still no provider/model, try from gateway config
  if (!effectiveProvider && event.context.cfg) {
    const cfg = event.context.cfg as any;
    const gatewayModel = cfg.agents?.defaults?.model?.primary || cfg.gateway?.model;
    if (gatewayModel && typeof gatewayModel === 'string') {
      const parts = gatewayModel.split('/');
      if (parts.length === 2) {
        effectiveProvider = parts[0];
        effectiveModel = parts[1];
      }
    }
  }

  // Track session info
  let sessionInfo = activeSessions.get(sessionId);
  let isNewSession = false;

  if (event.type === 'agent' && event.action === 'bootstrap') {
    if (!sessionInfo) {
      // New session - create entry
      isNewSession = true;
      sessionInfo = {
        sessionId,
        startTime: new Date(),
        provider: effectiveProvider,
        model: effectiveModel,
        messageChannel,
        startEventSent: false
      };
      activeSessions.set(sessionId, sessionInfo);
    } else {
      // Existing session - update provider/model if we got better info
      if (effectiveProvider) sessionInfo.provider = effectiveProvider;
      if (effectiveModel) sessionInfo.model = effectiveModel;
      if (messageChannel) sessionInfo.messageChannel = messageChannel;
    }
  }

  // Build metadata - ONLY include relevant fields, not entire context
  const metadata: Record<string, unknown> = {
    openclawEventType: event.type,
    openclawAction: event.action,
    provider: effectiveProvider || sessionInfo?.provider,
    model: effectiveModel || sessionInfo?.model,
    platform: messageChannel || sessionInfo?.messageChannel,
    timestamp: event.timestamp.toISOString(),
    sessionKey: event.sessionKey
  };

  // Include relevant context fields (selective, not everything)
  if (event.context.commandText) metadata.commandText = event.context.commandText;
  if (event.context.agentId) metadata.agentId = event.context.agentId;
  if (event.context.tool) metadata.tool = event.context.tool;
  if (event.context.toolName) metadata.toolName = event.context.toolName;

  // Extract tool name for different event types
  let toolName: string | undefined;

  if (event.type === 'command') {
    // Command events: show the command as the tool
    toolName = `command:${event.action}`;
  } else if (event.action.includes('tool')) {
    // Tool events
    toolName = event.context.tool as string || event.context.toolName as string;
  } else if (effectiveProvider && effectiveModel) {
    // Agent inference - use effective provider/model
    toolName = `${effectiveProvider}:${effectiveModel}`;
  }

  // Build summary
  let summary: string | undefined;
  if (event.messages && event.messages.length > 0) {
    summary = event.messages[0];
  } else if (event.context.commandText) {
    summary = `Command: ${event.context.commandText}`;
  } else if (event.type === 'agent' && event.action === 'bootstrap') {
    // For agent bootstrap, create a meaningful summary
    const agent = event.context.agentId || 'main';
    const platform = metadata.platform || 'unknown';
    summary = `Agent session started (${agent}) via ${platform}`;
  } else if (event.action) {
    summary = `${event.type}: ${event.action}`;
  }

  // For agent:bootstrap, only forward session_start if this is a new session
  if (event.type === 'agent' && event.action === 'bootstrap') {
    if (sessionInfo && sessionInfo.startEventSent) {
      console.log(`[llmwhiteboard-sync] Skipping duplicate session_start for ${sessionId.substring(0, 8)}...`);
      return; // Already sent session_start for this session
    }
    // Mark that we've sent the start event
    if (sessionInfo) {
      sessionInfo.startEventSent = true;
    }
  }

  console.log(`[llmwhiteboard-sync] → ${eventType} (${toolName || 'no tool'}) session=${sessionId.substring(0, 8)}...`);

  // Forward to llmwhiteboard
  await forwardEvent({
    localSessionId: sessionId,
    projectPath: event.context.workspaceDir as string || '/openclaw',
    machineId: process.env.HOSTNAME || 'openclaw-container',
    cliType: 'openclaw',
    event: {
      type: eventType,
      toolName,
      summary,
      metadata
    },
    timestamp: event.timestamp.toISOString()
  });

  // Cleanup finished sessions
  if (event.type === 'session' && event.action === 'end') {
    setTimeout(() => {
      activeSessions.delete(sessionId);
    }, 60000); // 1 minute
  }
}

/**
 * Subscribe to internal agent events for richer tracking
 */
let agentEventListenerRegistered = false;

async function subscribeToAgentEvents() {
  if (agentEventListenerRegistered) return;

  try {
    // Dynamically import agent events module
    const agentEventsModule = await import('/app/dist/infra/agent-events.js');
    const onAgentEvent = agentEventsModule.onAgentEvent;

    agentEventListenerRegistered = true;

    onAgentEvent(async (evt: any) => {
      // Log ALL events with full details for debugging
      console.log(`[llmwhiteboard-sync] 🔔 RAW EVENT: stream=${evt.stream}, runId=${evt.runId?.substring(0, 8) || 'N/A'}, phase=${evt.data?.phase || 'N/A'}, hasText=${!!evt.data?.text}, hasDelta=${!!evt.data?.delta}`);

      // For assistant events, log even more detail
      if (evt.stream === 'assistant' || (evt.data?.text && typeof evt.data.text === 'string')) {
        console.log(`[llmwhiteboard-sync] 🎯 TEXT EVENT: stream=${evt.stream}, text.length=${evt.data?.text?.length || 0}, delta.length=${evt.data?.delta?.length || 0}`);
      }

      if (!LLMWHITEBOARD_TOKEN) return;

      // Find the matching stable session ID from activeSessions
      // Agent events use evt.sessionKey which is like "agent:main:main"
      // We need to find the actual stable sessionId that was registered during bootstrap
      let sessionId: string | null = null;

      // Try to find session by looking through activeSessions for a match
      // In the future we could store a mapping, but for now check if there's only one active session
      if (activeSessions.size === 1) {
        // If there's only one active session, use it
        sessionId = Array.from(activeSessions.keys())[0];
      } else if (activeSessions.size > 1) {
        // Multiple sessions - try to find by sessionKey match or use most recent
        for (const [sid, info] of activeSessions.entries()) {
          // Use the most recently started session as a heuristic
          if (!sessionId || info.startTime > activeSessions.get(sessionId)!.startTime) {
            sessionId = sid;
          }
        }
      }

      // Fallback to evt.sessionKey if we couldn't find a match
      if (!sessionId) {
        sessionId = evt.sessionKey || `run:${evt.runId}`;
      }

      console.log(`[llmwhiteboard-sync] Agent event: ${evt.stream}:${evt.data.phase} runId=${evt.runId} → session=${sessionId.substring(0, 8)}...`);

      // Handle assistant stream events (accumulate response text)
      if (evt.stream === 'assistant') {
        const runData = assistantResponses.get(evt.runId) || { content: '' };

        console.log(`[llmwhiteboard-sync] 🎯 ASSISTANT EVENT! runId=${evt.runId.substring(0, 8)}, has text: ${!!evt.data.text}, text length: ${evt.data.text?.length || 0}`);

        // OpenClaw uses 'data.text' (full text so far) not 'data.content'
        // Each event has the complete response accumulated so far
        if (evt.data.text && typeof evt.data.text === 'string') {
          runData.content = evt.data.text; // Store the full text (already accumulated by OpenClaw)
          assistantResponses.set(evt.runId, runData);
          console.log(`[llmwhiteboard-sync] 💾 Stored ${runData.content.length} chars for run ${evt.runId.substring(0, 8)}`);
        }

        return; // Don't forward individual assistant chunks
      }

      // Map event stream and phase to llmwhiteboard event type
      let eventType: string;
      let toolName: string | undefined;
      let summary: string | undefined;

      // Debug: log full event data structure for lifecycle:end
      if (evt.stream === 'lifecycle' && evt.data.phase === 'end') {
        console.log(`[llmwhiteboard-sync] 📋 evt.data keys:`, Object.keys(evt.data));
        console.log(`[llmwhiteboard-sync] 📋 evt.data.phase:`, evt.data.phase);
        console.log(`[llmwhiteboard-sync] 📋 evt.data.startedAt:`, evt.data.startedAt);
        console.log(`[llmwhiteboard-sync] 📋 evt.data.endedAt:`, evt.data.endedAt);
        console.log(`[llmwhiteboard-sync] 📋 evt keys:`, Object.keys(evt));
        console.log(`[llmwhiteboard-sync] 📋 evt.ts:`, evt.ts);
        console.log(`[llmwhiteboard-sync] 📋 evt.sessionKey:`, evt.sessionKey);
      }

      if (evt.stream === 'tool') {
        eventType = evt.data.phase === 'start' ? 'tool_use_start' : 'tool_use';
        toolName = evt.data.name as string;
        summary = `Tool: ${toolName}`;
      } else if (evt.stream === 'lifecycle') {
        if (evt.data.phase === 'start') {
          eventType = 'user_prompt';
          summary = 'Agent run started';
          // Note: User message not available in lifecycle:start events
        } else {
          eventType = 'agent_response';

          // Get accumulated assistant response
          const runData = assistantResponses.get(evt.runId);
          console.log(`[llmwhiteboard-sync] lifecycle:end for run ${evt.runId.substring(0, 8)} - runData exists: ${!!runData}, has content: ${!!runData?.content}, content length: ${runData?.content?.length || 0}`);

          if (runData && runData.content) {
            summary = runData.content;
            console.log(`[llmwhiteboard-sync] ✓ Will set metadata.output with ${runData.content.length} chars`);
            // Clean up after use
            setTimeout(() => assistantResponses.delete(evt.runId), 60000);
          } else {
            summary = 'Agent run completed';
            console.log(`[llmwhiteboard-sync] ✗ No content to set in metadata.output`);
          }
        }
      } else {
        return; // Skip other event types
      }

      // Get session info or create minimal metadata
      const sessionInfo = activeSessions.get(sessionId);

      // Build metadata with UI-friendly structure
      const metadata: Record<string, unknown> = {
        runId: evt.runId,
        stream: evt.stream,
        phase: evt.data.phase,
        provider: sessionInfo?.provider,
        model: sessionInfo?.model,
        timestamp: new Date(evt.ts).toISOString(),
        ...evt.data
      };

      // Add 'input' and 'output' fields for UI display (EventItem expects these)
      if (evt.stream === 'tool') {
        if (evt.data.phase === 'start' && evt.data.args) {
          // For tool start: show the command/args
          metadata.input = evt.data.args;
        } else if (evt.data.phase === 'result' && evt.data.result) {
          // For tool result: show both input and output
          const result = evt.data.result as any;
          metadata.input = { command: evt.data.meta };
          metadata.output = result.details?.aggregated || result.content?.[0]?.text || JSON.stringify(result);
        }
      } else if (evt.stream === 'lifecycle') {
        const runData = assistantResponses.get(evt.runId);
        if (evt.data.phase === 'start' && runData?.userMessage) {
          // For user_prompt: show the user's message
          metadata.input = { message: runData.userMessage };
        } else if (evt.data.phase === 'end' && runData?.content) {
          // For agent_response: show the assistant's response
          metadata.output = runData.content;
          console.log(`[llmwhiteboard-sync] ✓ SET metadata.output = ${runData.content.substring(0, 100)}...`);
          if (runData.userMessage) {
            metadata.input = { message: runData.userMessage };
          }
        } else if (evt.data.phase === 'end') {
          console.log(`[llmwhiteboard-sync] ✗ NOT setting metadata.output (runData: ${!!runData}, content: ${!!runData?.content})`);
        }
      }

      console.log(`[llmwhiteboard-sync] → ${eventType} (${toolName || 'no tool'}) session=${sessionId.substring(0, 8)}...`);

      // Forward to llmwhiteboard
      await forwardEvent({
        localSessionId: sessionId,
        projectPath: '/openclaw',
        machineId: process.env.HOSTNAME || 'openclaw-container',
        cliType: 'openclaw',
        event: {
          type: eventType,
          toolName,
          summary,
          metadata
        },
        timestamp: new Date(evt.ts).toISOString()
      });
    });

    console.log('[llmwhiteboard-sync] Subscribed to agent events');
  } catch (err) {
    console.log('[llmwhiteboard-sync] Could not subscribe to agent events:', err);
  }
}

// Subscribe on first hook call
subscribeToAgentEvents().catch(console.error);
