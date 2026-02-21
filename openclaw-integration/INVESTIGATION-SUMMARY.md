# OpenClaw Assistant Text Capture Investigation Summary

## Problem Statement
OpenClaw bot is responding with full, multi-sentence responses in Telegram, but llmwhiteboard is only capturing the first word (e.g., "NO", "One", "The", "Here" - 2-4 characters each). The full response text is being truncated somewhere in the event capture pipeline.

## Current Status

### What's Working
1. ✅ Tool executions fully captured (input + output)
2. ✅ Session tracking working correctly
3. ✅ Events flowing from OpenClaw → llmwhiteboard
4. ✅ Assistant events ARE being emitted and captured
5. ✅ Patch successfully extracts text from `thinking_end` events

### What's Broken
- ❌ **Only capturing first word of assistant responses** (e.g., "One" instead of full sentence)
- ❌ User prompts not being captured (all show as "Agent run started")
- ❌ Response text length: 2-4 chars in DB vs full responses visible in Telegram

## Technical Context

### OpenClaw Event System
OpenClaw has two event systems:

1. **Hook events** (limited): `agent:bootstrap`, `gateway:startup`, `command:*`
2. **Internal agent events** (rich): `lifecycle`, `tool`, `assistant`, `compaction`

We subscribe to internal agent events via:
```typescript
import { onAgentEvent } from '/app/dist/infra/agent-events.js';
```

### Event Streaming with Extended Thinking

When Ollama/qwen3:8b uses extended thinking mode:
- Model generates reasoning in `<thinking>` tags (contentIndex 0)
- Model generates actual response text (contentIndex 1)
- SDK emits events with BOTH content blocks in `partial.content[]` array

**Event structure:**
```json
{
  "type": "thinking_delta",  // or "thinking_end"
  "contentIndex": 0,
  "delta": "reasoning text here",
  "partial": {
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "full reasoning text",
        "thinkingSignature": "reasoning"
      },
      {
        "type": "text",
        "text": "actual response text here"  // THIS is what we want!
      }
    ]
  }
}
```

### Current Patch Location
**File:** `/app/dist/agents/pi-embedded-subscribe.handlers.messages.js` (in cladbot-gateway container)

**Function:** `handleMessageUpdate(ctx, evt)`

**Current logic:**
```javascript
if (evtType === "thinking_delta" || evtType === "thinking_end") {
    const partial = assistantRecord?.partial;
    if (partial && Array.isArray(partial.content)) {
        const textBlock = partial.content.find(b => b && b.type === "text");
        if (textBlock && textBlock.text) {
            const fullText = textBlock.text;
            const prevText = ctx.state.lastStreamedAssistantCleaned || "";
            let deltaText = "";
            if (fullText.startsWith(prevText)) {
                deltaText = fullText.slice(prevText.length);
            } else if (!prevText) {
                deltaText = fullText;
            }
            if (deltaText) {
                ctx.state.lastStreamedAssistantCleaned = fullText;
                emitAgentEvent({
                    runId: ctx.params.runId,
                    stream: "assistant",
                    data: {
                        text: fullText,
                        delta: deltaText
                    }
                });
            }
            return;  // EXIT EARLY - this might be the problem!
        }
    }
    return;
}
```

## Key Observations from Logs

### Event Counts per Run
- **100+ `thinking_delta` events** with `has text block: false` (only reasoning content)
- **1 `thinking_end` event** with `has text block: true text length: 2-4`
- **0 `text_delta` events** (no regular text streaming at all)

### Example from Logs
```
[DEBUG] Thinking event: thinking_delta has text block: false (x100+)
[DEBUG] Thinking event: thinking_end has text block: true text length: 3
[PATCH] fullText: One
[PATCH] Emit assistant: One
```

**Result in database:** "One" (3 characters)
**Expected:** Full multi-sentence response that user sees in Telegram

## Critical Questions to Investigate

### 1. Are there multiple thinking events with progressively growing text?
**Status:** NO - logs show only ONE `thinking_end` event has text content

### 2. Is the text content in thinking_end actually complete?
**Status:** Logs show `text length: 2-4` which matches what we capture
**Question:** Is this the FULL text, or is more text coming in subsequent events?

### 3. Where does the full response come from if not from thinking events?
**Hypothesis:** The text might be assembled elsewhere in OpenClaw:
- After `thinking_end`, does OpenClaw call another function to get full response?
- Is there a session transcript or context that has the complete text?
- Does Telegram receive text from a different source than our event stream?

### 4. What happens AFTER our patch returns?
**Current behavior:** We `return` immediately after processing thinking_end
**Problem:** If additional text comes in other events, we're missing them

### 5. How does Telegram get the full response?
**Key investigation point:** Trace the code path from thinking_end to Telegram output
- File: `/app/dist/telegram/` (check Telegram message sending logic)
- File: `/app/dist/auto-reply/` (check response assembly)
- Question: Where does Telegram fetch the response text from?

## Required Investigation Tasks

### Task 1: Trace Telegram Response Assembly
**Files to examine:**
- `/app/dist/telegram/*.js` - Telegram bot message sending
- `/app/dist/auto-reply/reply/*.js` - Response assembly logic
- Look for how `ctx.state.assistantTexts` or session transcript is used

**Questions:**
- Where does Telegram read the response text from?
- Is there a buffer or transcript that accumulates text beyond what we see in events?
- Does Telegram read from `ctx.state.deltaBuffer` or another state variable?

### Task 2: Examine Context State Management
**Look at:** `/app/dist/agents/pi-embedded-subscribe.js` or related files

**Key context variables:**
- `ctx.state.deltaBuffer` - raw accumulated text
- `ctx.state.blockBuffer` - processed text buffer
- `ctx.state.assistantTexts[]` - array of assistant messages
- `ctx.state.lastStreamedAssistantCleaned` - last cleaned text

**Questions:**
- Does `deltaBuffer` continue growing after thinking_end?
- Is there a separate assembly process that combines text?
- Are we capturing state too early?

### Task 3: Check if Text Comes After thinking_end
**Add logging AFTER our patch returns:**
```javascript
// Don't return immediately - let normal processing continue
if (evtType === "thinking_delta" || evtType === "thinking_end") {
    // ... existing extraction logic ...
    if (deltaText) {
        emitAgentEvent(...);
    }
    // DON'T RETURN - fall through to normal processing
}
```

**Then check:** Do text_delta events arrive after thinking_end?

### Task 4: Examine Message End Handler
**File:** `/app/dist/agents/pi-embedded-subscribe.handlers.messages.js`

**Function:** `handleMessageEnd(ctx, evt)`

**Questions:**
- Does this function have access to complete response text?
- Should we emit assistant events from here instead?
- Is there a finalization step that assembles all text?

### Task 5: Check Session Transcript Storage
**Question:** Where is the complete conversation stored?

**Possible locations:**
- Session object: `ctx.params.session`
- Agent run context
- Transcript files or database

**Action:** Find where Telegram reads the complete message from and emit from there

## Debugging Commands

### View full event structure
```bash
docker exec cladbot-gateway bash -c 'cat > /tmp/dump-event.js << "EOF"
const fs = require("fs");
const file = "/app/dist/agents/pi-embedded-subscribe.handlers.messages.js";
let content = fs.readFileSync(file, "utf8");

const searchStr = `    // DEBUG: Log ALL thinking events
    if (evtType === "thinking_delta" || evtType === "thinking_end") {`;

const replaceStr = `    // DEBUG: Log COMPLETE event structure
    if (evtType === "thinking_end") {
        console.log("[FULL-EVENT]", JSON.stringify(evt, null, 2));
        console.log("[FULL-CONTEXT-STATE]", JSON.stringify({
            deltaBuffer: ctx.state.deltaBuffer?.length,
            blockBuffer: ctx.state.blockBuffer?.length,
            assistantTexts: ctx.state.assistantTexts?.length,
        }));
    }

    if (evtType === "thinking_delta" || evtType === "thinking_end") {`;

content = content.replace(searchStr, replaceStr);
fs.writeFileSync(file, content);
EOF
node /tmp/dump-event.js'
```

### Check Telegram message sending
```bash
docker logs cladbot-gateway 2>&1 | grep -A10 "telegram.*send"
```

### Examine session state at message end
```bash
# Add to handleMessageEnd:
console.log("[MESSAGE-END] assistantTexts:", ctx.state.assistantTexts);
console.log("[MESSAGE-END] deltaBuffer:", ctx.state.deltaBuffer);
```

## Hypothesis to Test

**Hypothesis 1:** Text is accumulated in `ctx.state.deltaBuffer` from the normal text_delta processing path (lines 80-120), but we're not seeing those events because we return early in our patch.

**Test:** Remove the `return` statement after emitting, allow normal processing to continue.

**Hypothesis 2:** The complete text is only available after the message ends, in `handleMessageEnd()`.

**Test:** Emit assistant event from `handleMessageEnd()` with full accumulated text.

**Hypothesis 3:** Multiple thinking events contain progressively growing text blocks.

**Test:** Log ALL thinking events with text blocks and their lengths - check if text grows.

## Files for Reference

### Extracted Files
- `D:\sources\llmwhiteboard\openclaw-integration\pi-embedded-subscribe.handlers.messages.js` - Patched OpenClaw handler
- `D:\sources\llmwhiteboard\openclaw-integration\openclaw-hook-handler.ts` - Our llmwhiteboard sync hook
- `D:\sources\llmwhiteboard\openclaw-integration\thinking-text-extraction-patch.md` - Original patch documentation

### Key OpenClaw Source Files (in container)
- `/app/dist/agents/pi-embedded-subscribe.handlers.messages.js` - Message event handler (PATCHED)
- `/app/dist/agents/pi-embedded-subscribe.handlers.lifecycle.js` - Lifecycle event handler
- `/app/dist/agents/pi-embedded-subscribe.js` - Main subscription setup
- `/app/dist/telegram/*.js` - Telegram bot logic
- `/app/dist/auto-reply/reply/*.js` - Response assembly

## Next Steps for Investigation

1. **Trace the code path from thinking_end to Telegram**
   - How does text get from our event to user's Telegram?
   - Read Telegram message sending code

2. **Check if we're exiting too early**
   - Remove `return` after thinking event processing
   - See if text_delta events arrive after

3. **Examine handleMessageEnd**
   - Check if complete text available there
   - Emit assistant event from message end instead

4. **Dump complete event and context state**
   - Log full `evt` object at thinking_end
   - Log all context state variables

5. **Compare with successful run**
   - Run 0712f988 at 04:10 had 35 assistant events (worked)
   - Current runs have 1 assistant event (truncated)
   - What changed? Was thinking mode disabled then?

## Database Evidence

```sql
-- Shows captured responses are only 2-4 characters
SELECT "CreatedAt", "EventType", "Summary",
       length("Metadata"::jsonb->>'output') as output_len,
       "Metadata"::jsonb->>'output' as full_output
FROM "SessionEvents"
WHERE "SessionId" = '749390d7-6cf4-4e72-8c3c-3e52a54245d0'
  AND "EventType" = 'agent_response'
ORDER BY "CreatedAt" DESC;

-- Results:
-- "One" (3 chars)
-- "The" (3 chars)
-- "NO" (2 chars)
-- "Here" (4 chars)
```

**Expected:** Full multi-sentence responses

## Environment
- Container: `cladbot-gateway`
- Image: `openclaw:local`
- Model: `ollama/qwen3:8b`
- Extended thinking: **ENABLED** (causing text truncation)
- Previous successful capture: Run 0712f988 (might not have had thinking enabled)

---

## SOLUTION IMPLEMENTED ✅

### Root Cause Confirmed
**Hypothesis 2 was correct**: The complete text is only available after the message ends, in `handleMessageEnd()`.

The streaming events during extended thinking only contain:
1. `thinking_delta` events with **only reasoning** (no text block)
2. `thinking_end` with a **tiny fragment** (first 2-4 chars of response)

The existing patch captured these fragments and **returned early**, missing subsequent text. But the **complete text** is assembled by the SDK and passed to `handleMessageEnd` via `extractAssistantText(assistantMessage)`.

### The Fix
Added an `emitAgentEvent` call in `handleMessageEnd` to emit the **complete response text** after the message is fully assembled:

```javascript
// PATCH: Emit FINAL assistant event with COMPLETE text at message end
// This ensures llmwhiteboard captures the full response, not just streaming fragments
if (text) {
    const prevText = ctx.state.lastStreamedAssistantCleaned || "";
    // Only emit if we have new content (avoid duplicate if already streamed)
    if (text !== prevText && text.length > prevText.length) {
        console.log("[PATCH-END] Emitting COMPLETE text:", text.length, "chars (prev:", prevText.length, ")");
        emitAgentEvent({
            runId: ctx.params.runId,
            stream: "assistant",
            data: {
                text: text,
                delta: text.slice(prevText.length),
                final: true
            }
        });
    }
}
```

This is added after line 210 (`const text = ctx.stripBlockTags(rawText, ...)`) in `handleMessageEnd`.

### Apply to Docker Container
```bash
docker cp openclaw-integration/pi-embedded-subscribe.handlers.messages.js cladbot-gateway:/app/dist/agents/pi-embedded-subscribe.handlers.messages.js
docker restart cladbot-gateway
```

### Verification
After applying, test with a Telegram message and check:
1. Logs should show `[PATCH-END] Emitting COMPLETE text: XXX chars`
2. Database should show full response text, not just first word
