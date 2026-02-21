---
name: llmwhiteboard-sync
description: Sync OpenClaw events to LLM Whiteboard dashboard
version: 1.0.0
events: [agent, session, gateway, command]
---

# LLM Whiteboard Sync Hook

Forwards OpenClaw events to LLM Whiteboard dashboard for visualization and tracking.

## Configuration

Set the `LLMWHITEBOARD_TOKEN` environment variable with your API token from LLM Whiteboard settings.

```bash
LLMWHITEBOARD_TOKEN=lwb_sk_your_token_here
```

## Events Captured

- **agent**: LLM inference events
- **session**: Session lifecycle
- **gateway**: Message routing
- **command**: Command execution
