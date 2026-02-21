# Telegram Message Flow Analysis

**Date**: 2026-02-03 21:17:38
**Test**: User sent message to @CaricacoBot via Telegram

---

## Complete Event Sequence

### 1. Queue Operations (21:17:38.782-794)
```json
{
  "subsystem": "diagnostic",
  "message": "lane enqueue: lane=session:agent:main:main queueSize=1",
  "logLevel": "DEBUG",
  "time": "2026-02-03T21:17:38.782Z"
}
```
- Task queued for processing
- Queue depth: 1
- Wait time: 13ms

### 2. Agent Run Start (21:17:38.842) ⭐
```json
{
  "subsystem": "agent/embedded",
  "message": "embedded run start: runId=fd2aa5d9-895e-45f4-98dc-9c3629d9a16d sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8 provider=ollama model=qwen3:8b thinking=off messageChannel=telegram",
  "logLevel": "DEBUG",
  "time": "2026-02-03T21:17:38.842Z"
}
```

**Key Data Extracted**:
- ✅ **runId**: `fd2aa5d9-895e-45f4-98dc-9c3629d9a16d`
- ✅ **sessionId**: `5bca77a3-90a9-421f-a710-0874ca9422e8`
- ✅ **provider**: `ollama`
- ✅ **model**: `qwen3:8b`
- ✅ **messageChannel**: `telegram` 🎯
- ✅ **thinking**: `off`

### 3. Session State Change (21:17:38.909)
```json
{
  "subsystem": "diagnostic",
  "message": "session state: sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8 sessionKey=unknown prev=idle new=processing reason=\"run_started\" queueDepth=0",
  "logLevel": "DEBUG"
}
```

**State**: `idle` → `processing`
**Reason**: `run_started`

### 4. Run Registered (21:17:38.914)
```json
{
  "subsystem": "diagnostic",
  "message": "run registered: sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8 totalActive=1"
}
```

Active runs: 1

### 5. Prompt Processing (21:17:38.918-924)
```json
{
  "subsystem": "agent/embedded",
  "message": "embedded run prompt start: runId=fd2aa5d9-895e-45f4-98dc-9c3629d9a16d sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8"
}
```

Then:
```json
{
  "subsystem": "agent/embedded",
  "message": "embedded run agent start: runId=fd2aa5d9-895e-45f4-98dc-9c3629d9a16d"
}
```

### 6. Agent Inference (21:17:38.924 - 21:17:45.902)
**Duration**: ~7 seconds

```json
{
  "subsystem": "agent/embedded",
  "message": "embedded run agent end: runId=fd2aa5d9-895e-45f4-98dc-9c3629d9a16d",
  "time": "2026-02-03T21:17:45.902Z"
}
```

**Latency**: 6.978 seconds (agent processing time)

### 7. Prompt Completion (21:17:45.907) ⭐
```json
{
  "subsystem": "agent/embedded",
  "message": "embedded run prompt end: runId=fd2aa5d9-895e-45f4-98dc-9c3629d9a16d sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8 durationMs=6988",
  "logLevel": "DEBUG"
}
```

**Key Metric**: `durationMs=6988` (6.988 seconds)

### 8. Session State Change (21:17:45.912)
```json
{
  "subsystem": "diagnostic",
  "message": "session state: sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8 sessionKey=unknown prev=processing new=idle reason=\"run_completed\" queueDepth=0"
}
```

**State**: `processing` → `idle`
**Reason**: `run_completed`

### 9. Run Complete (21:17:45.928) ⭐
```json
{
  "subsystem": "agent/embedded",
  "message": "embedded run done: runId=fd2aa5d9-895e-45f4-98dc-9c3629d9a16d sessionId=5bca77a3-90a9-421f-a710-0874ca9422e8 durationMs=7130 aborted=false",
  "logLevel": "DEBUG"
}
```

**Key Metrics**:
- `durationMs=7130` (7.13 seconds total)
- `aborted=false` ✅

### 10. Task Done (21:17:45.934-938)
```json
{
  "subsystem": "diagnostic",
  "message": "lane task done: lane=main durationMs=7134 active=0 queued=0"
}
```

Queue cleared, processing complete.

---

## Timeline Visualization

```
21:17:38.782  │ Message arrives (inferred)
21:17:38.782  ├─ Queue enqueue
21:17:38.786  ├─ Queue dequeue (wait: 13ms)
21:17:38.842  ├─ Agent run start
              │   provider: ollama/qwen3:8b
              │   channel: telegram
21:17:38.909  ├─ Session: idle → processing
21:17:38.914  ├─ Run registered (active: 1)
21:17:38.918  ├─ Prompt processing start
21:17:38.924  ├─ Agent inference start
              │
              │   [~7 seconds of LLM inference]
              │
21:17:45.902  ├─ Agent inference end
21:17:45.907  ├─ Prompt processing end (6,988ms)
21:17:45.912  ├─ Session: processing → idle
21:17:45.928  ├─ Run complete (7,130ms total)
21:17:45.934  └─ Task done
21:17:45.xxx  │ Response sent to Telegram (inferred)
```

---

## Key Findings for Integration

### ✅ What We Have

1. **Session Tracking**:
   - Unique `sessionId` per conversation
   - Unique `runId` per inference
   - Session states tracked (idle/processing)

2. **Platform Information**:
   - `messageChannel=telegram` identifies source
   - Channel is available for every run

3. **Model Information**:
   - `provider=ollama` (local, cost=0)
   - `model=qwen3:8b`
   - Can be mapped to config for cost calculation

4. **Timing Data**:
   - `durationMs` for entire run
   - Start/end timestamps for latency
   - Queue wait times

5. **Status Information**:
   - `aborted=false` indicates success
   - State transitions tracked
   - Active run count

### ❌ What We DON'T Have

1. **Token Usage**:
   - ❌ No input token count
   - ❌ No output token count
   - ❌ No cache hit/miss data
   - **Impact**: Must estimate costs or parse from provider responses

2. **Message Content**:
   - ❌ No user message text
   - ❌ No bot response text
   - **Impact**: Cannot display conversation in dashboard (privacy feature?)
   - **Possible**: May be in session files under `/home/node/.openclaw/agents/`

3. **Explicit Message Events**:
   - ❌ No "message_received" event
   - ❌ No "message_sent" event
   - ❌ No "telegram:message" subsystem events
   - **Impact**: Must infer message arrival from agent run start

4. **Tool Usage**:
   - ❌ No tool execution in this simple message
   - **TODO**: Test with a message that requires tools

---

## Event Mapping for Adapter

### OpenClaw Event → llmwhiteboard Event

| OpenClaw Event | llmwhiteboard Type | Metadata |
|----------------|-------------------|----------|
| `embedded run start` (messageChannel=telegram) | `user_prompt` | sessionId, runId, provider, model, platform=telegram |
| `embedded run start` (messageChannel=*) | `session_start` (first run) | Same as above |
| `embedded run done` (aborted=false) | `tool_use` | toolName=`{provider}:{model}`, durationMs, cost (calculated) |
| `embedded run done` | `session_end` (if last run) | durationMs, success=!aborted |
| `embedded run tool start` | `tool_use_start` | tool name, toolCallId |
| `embedded run tool end` | `tool_use` | tool name, toolCallId, duration |
| `session state: new=processing` | `agent_active` (custom) | sessionId |
| `session state: new=idle` | `agent_idle` (custom) | sessionId |
| `lane task error` | `error` | error message, durationMs |

---

## Cost Calculation Strategy

### For Ollama (Local)
```typescript
{
  model: "qwen3:8b",
  provider: "ollama",
  cost: {
    input: 0,
    output: 0,
    total: 0
  }
}
```

### For Anthropic (if used)
```typescript
{
  model: "claude-haiku-4-20250514",
  provider: "anthropic",
  // From config:
  pricing: {
    input: 0.25,   // per 1M tokens
    output: 1.25   // per 1M tokens
  },
  // Need to estimate or parse:
  tokens: {
    input: ???,  // NOT in logs
    output: ???  // NOT in logs
  },
  // Calculated:
  cost: (input_tokens / 1000000 * 0.25) + (output_tokens / 1000000 * 1.25)
}
```

**Options**:
1. **Estimate** based on average message length
2. **Parse** from provider response (if available in detailed logs)
3. **Query** Anthropic API for usage data (if request_id is logged)
4. **Mark as unknown** and show warning in dashboard

---

## Session Storage Investigation

Let's check if message content is stored:

```bash
# Check agents directory for session files
ls -la /home/node/.openclaw/agents/

# Look for session-specific data
find /home/node/.openclaw/agents/ -name "*5bca77a3*"
```

**TODO**: Investigate if transcripts/conversations are stored somewhere.

---

## Next Steps for Adapter

### Phase 2: Build Parser

1. **Parse `embedded run start`**:
   - Extract: runId, sessionId, provider, model, messageChannel
   - Map to: `user_prompt` event
   - Add metadata: platform, provider, model

2. **Parse `embedded run done`**:
   - Extract: runId, sessionId, durationMs, aborted
   - Map to: `tool_use` event (LLM inference as "tool")
   - Calculate cost (if not Ollama)

3. **Parse `embedded run tool start/end`**:
   - Extract: tool name, toolCallId
   - Map to: `tool_use_start` / `tool_use` events

4. **Session Grouping**:
   - Group events by `sessionId`
   - Track session lifecycle (first run = start, last run = end)
   - Use `messageChannel` to identify platform

---

## Summary

✅ **Phase 1 Complete!**

**Achievements**:
- Captured live Telegram message flow
- Identified all key event types
- Documented timing and metadata
- Confirmed session tracking works
- Identified data limitations (no tokens)

**Ready for Phase 2**: We have everything needed to build the adapter! 🚀

**Key Insight**: OpenClaw doesn't log explicit "message received/sent" events. Instead:
- **Message received** = Inferred from `embedded run start` with messageChannel
- **Message sent** = Inferred from `embedded run done` with aborted=false
