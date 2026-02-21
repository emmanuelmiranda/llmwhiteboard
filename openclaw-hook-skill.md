# LLM Whiteboard Sync Hook

Forwards OpenClaw events to LLM Whiteboard dashboard for visualization and tracking.

## Overview

This hook captures OpenClaw's internal events (agent runs, tool executions, message routing) and forwards them to your LLM Whiteboard instance running at http://localhost:22000.

## What It Tracks

- **Agent Runs**: Every LLM inference with provider/model info
- **Tool Executions**: Tools called by the agent
- **Message Routing**: Messages received/sent via Telegram, WhatsApp, etc.
- **Session Lifecycle**: Session start/end events
- **Timing Data**: Duration and latency for each operation
- **Cost Data**: Provider and model for cost calculation

## Configuration

### 1. Environment Variables

Set these in your OpenClaw container or `.env` file:

```bash
# Required: Your LLM Whiteboard API token
LLMWHITEBOARD_TOKEN=lwb_sk_your_token_here

# Optional: API URL (defaults to host.docker.internal:22001)
LLMWHITEBOARD_API_URL=http://host.docker.internal:22001
```

### 2. Get Your API Token

1. Open LLM Whiteboard: http://localhost:22000
2. Go to Settings → API Tokens
3. Click "Create Token"
4. Copy the token (starts with `lwb_sk_`)
5. Set it in your container:

```bash
docker exec -it cladbot-gateway sh -c 'echo "export LLMWHITEBOARD_TOKEN=lwb_sk_your_token" >> ~/.bashrc'
```

Or in docker-compose.yml:

```yaml
services:
  openclaw:
    environment:
      - LLMWHITEBOARD_TOKEN=lwb_sk_your_token_here
```

### 3. Restart OpenClaw Gateway

```bash
docker restart cladbot-gateway
```

The hook will automatically load on startup.

## How It Works

```
OpenClaw Event → Hook Handler → LLM Whiteboard API → Dashboard
```

1. **Event Occurs**: User sends Telegram message to bot
2. **Hook Triggered**: `agent` event fires with inference details
3. **Event Forwarded**: Hook calls `/api/sync` endpoint
4. **Stored**: Event saved in PostgreSQL
5. **Displayed**: Real-time update via SignalR to dashboard

## Event Mapping

| OpenClaw Event | LLM Whiteboard Event | Description |
|----------------|---------------------|-------------|
| `agent:bootstrap` | `session_start` | Agent session begins |
| `agent:inference_start` | `user_prompt` | User message received |
| `agent:inference_end` | `tool_use` | LLM inference completed |
| `agent:tool_start` | `tool_use_start` | Tool execution begins |
| `agent:tool_end` | `tool_use` | Tool execution completes |
| `session:start` | `session_start` | Session lifecycle start |
| `session:end` | `session_end` | Session lifecycle end |
| `gateway:message_received` | `user_prompt` | Message from platform |
| `gateway:message_sent` | `agent_response` | Response to platform |
| `command:*` | `notification` | Command executed |

## Metadata Captured

Each event includes:

```json
{
  "openclawEventType": "agent",
  "openclawAction": "inference_end",
  "provider": "ollama",
  "model": "qwen3:8b",
  "platform": "telegram",
  "timestamp": "2026-02-03T21:17:45.928Z",
  "sessionId": "5bca77a3-90a9-421f-a710-0874ca9422e8",
  "runId": "fd2aa5d9-895e-45f4-98dc-9c3629d9a16d",
  "durationMs": 7130,
  "aborted": false
}
```

## Dashboard Features

Once synced, you can:

- **View Sessions**: See all OpenClaw sessions grouped by platform
- **Real-time Updates**: Watch events as they happen
- **Cost Tracking**: See costs for Anthropic/OpenAI calls (Ollama = $0)
- **Platform Analytics**: Compare activity across Telegram, WhatsApp, etc.
- **Session History**: Browse past conversations and workflows
- **Cross-tool View**: See OpenClaw alongside Claude Code sessions

## Troubleshooting

### Hook not loading

Check OpenClaw logs for hook registration:

```bash
docker logs cladbot-gateway 2>&1 | grep llmwhiteboard
```

You should see:
```
Registered hook: llmwhiteboard-sync -> agent, session, gateway, command
```

### Events not appearing in dashboard

1. **Check token**: Verify `LLMWHITEBOARD_TOKEN` is set
   ```bash
   docker exec cladbot-gateway env | grep LLMWHITEBOARD
   ```

2. **Check API connectivity**:
   ```bash
   docker exec cladbot-gateway curl -v http://host.docker.internal:22001/health
   ```

3. **Check logs** for errors:
   ```bash
   docker logs cladbot-gateway 2>&1 | grep "llmwhiteboard-sync"
   ```

### "No LLMWHITEBOARD_TOKEN set" warning

The token environment variable is not configured. See Configuration section above.

### API returning 401 Unauthorized

Your token is invalid or expired. Generate a new token in LLM Whiteboard settings.

## Development

To modify the hook:

1. Edit `/home/node/.openclaw/workspace/skills/llmwhiteboard-sync/hook.ts`
2. Restart the gateway: `docker restart cladbot-gateway`
3. Test with a message to your bot

## Disabling

To disable without removing:

```bash
# In openclaw.json:
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": {
        "llmwhiteboard-sync": {
          "enabled": false
        }
      }
    }
  }
}
```

Or simply delete the directory:

```bash
rm -rf /home/node/.openclaw/workspace/skills/llmwhiteboard-sync
```

## Privacy

- **Message content**: Not forwarded (only metadata)
- **User IDs**: Can be hashed if desired
- **Encryption**: LLM Whiteboard supports E2E encryption for transcripts

## Support

- LLM Whiteboard: https://github.com/yourusername/llmwhiteboard
- OpenClaw: https://github.com/openclaw/openclaw
