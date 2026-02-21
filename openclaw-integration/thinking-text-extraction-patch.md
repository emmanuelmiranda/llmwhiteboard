# OpenClaw Thinking Text Extraction Patch

## Problem

When Ollama/qwen3:8b uses extended thinking mode (with `<thinking>` tags), the Vercel AI SDK emits only `thinking_delta` events for contentIndex 0 (the reasoning block) and does NOT emit `text_delta` events for contentIndex 1 (the actual response text).

This causes OpenClaw's event handler to skip processing the actual response text, since it only handles `text_delta`, `text_start`, and `text_end` events.

## Root Cause

In `/app/dist/agents/pi-embedded-subscribe.handlers.messages.js`, the `handleMessageUpdate()` function has:

```javascript
if (evtType !== "text_delta" && evtType !== "text_start" && evtType !== "text_end") {
    return;  // Reject thinking_delta events
}
```

The SDK event structure with thinking looks like:
```json
{
  "type": "thinking_delta",
  "contentIndex": 0,
  "delta": "...",
  "partial": {
    "role": "assistant",
    "content": [
      {"type": "thinking", "thinking": "reasoning here"},
      {"type": "text", "text": "actual response here"}  // This text is present but no text_delta events are emitted!
    ]
  }
}
```

## Solution

Patch the `handleMessageUpdate()` function to extract text from the `partial.content` array when processing `thinking_delta` or `thinking_end` events.

### Patch Code

```javascript
if (evtType !== "text_delta" && evtType !== "text_start" && evtType !== "text_end") {
    // PATCH: Extract text from thinking events with parallel text content
    if (evtType === "thinking_delta" || evtType === "thinking_end") {
        const partial = assistantRecord?.partial;
        if (partial && Array.isArray(partial.content)) {
            const textBlock = partial.content.find(block => block && block.type === "text");
            if (textBlock && textBlock.text) {
                const fullText = textBlock.text;
                const previousText = ctx.state.deltaBuffer || "";
                const chunk = fullText.startsWith(previousText)
                    ? fullText.slice(previousText.length)
                    : (!previousText ? fullText : "");

                console.log("[PATCH] Extracted text chunk:", chunk ? chunk.substring(0, 50) + "..." : "EMPTY");

                if (chunk) {
                    ctx.state.deltaBuffer += chunk;
                    if (ctx.blockChunker) {
                        ctx.blockChunker.append(chunk);
                    } else {
                        ctx.state.blockBuffer += chunk;
                    }
                    // Fall through to process this chunk
                } else {
                    return;
                }
            } else {
                return;
            }
        } else {
            return;
        }
    } else {
        return;  // Not a text or thinking event
    }
}
```

### How to Apply

```bash
docker exec cladbot-gateway sh -c "node -e \"
const fs = require('fs');
const file = '/app/dist/agents/pi-embedded-subscribe.handlers.messages.js';
let content = fs.readFileSync(file, 'utf8');

const insertPoint = 'if (evtType !== \\\"text_delta\\\" && evtType !== \\\"text_start\\\" && evtType !== \\\"text_end\\\") {';
const insertionCode = 'if (evtType !== \\\"text_delta\\\" && evtType !== \\\"text_start\\\" && evtType !== \\\"text_end\\\") {\\n' +
'        // PATCH: Extract text from thinking events with parallel text content\\n' +
'        if (evtType === \\\"thinking_delta\\\" || evtType === \\\"thinking_end\\\") {\\n' +
'            const partial = assistantRecord?.partial;\\n' +
'            if (partial && Array.isArray(partial.content)) {\\n' +
'                const textBlock = partial.content.find(block => block && block.type === \\\"text\\\");\\n' +
'                if (textBlock && textBlock.text) {\\n' +
'                    const fullText = textBlock.text;\\n' +
'                    const previousText = ctx.state.deltaBuffer || \\\"\\\";\\n' +
'                    const chunk = fullText.startsWith(previousText) ? fullText.slice(previousText.length) : (!previousText ? fullText : \\\"\\\");\\n' +
'                    console.log(\\\"[PATCH] Extracted text chunk:\\\", chunk ? chunk.substring(0, 50) + \\\"...\\\" : \\\"EMPTY\\\");\\n' +
'                    if (chunk) {\\n' +
'                        ctx.state.deltaBuffer += chunk;\\n' +
'                        if (ctx.blockChunker) { ctx.blockChunker.append(chunk); } else { ctx.state.blockBuffer += chunk; }\\n' +
'                    } else { return; }\\n' +
'                } else { return; }\\n' +
'            } else { return; }\\n' +
'        } else {';

content = content.replace(insertPoint, insertionCode);
fs.writeFileSync(file, content);
console.log('Patched successfully');
\""
```

## Testing

After applying the patch:
1. Restart the container: `docker restart cladbot-gateway`
2. Send a test message via Telegram
3. Check logs for `[PATCH] Extracted text chunk:` messages
4. Verify llmwhiteboard dashboard shows the assistant response text

## Should This Be Upstreamed to OpenClaw?

**Yes!** This is a legitimate bug in OpenClaw's event handling. The SDK provides the text in the `partial` structure, but OpenClaw isn't extracting it when reasoning mode is active.

Proper fix would be in OpenClaw's source at `src/agents/pi-embedded-subscribe.handlers.messages.ts`.

## Date Applied

2026-02-04

## Status

✅ Applied to container `cladbot-gateway`
⏳ Pending testing
🔄 Should be contributed back to OpenClaw project
