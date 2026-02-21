# OpenClaw Research Findings - Phase 1

**Date**: 2026-02-03
**Container**: `cladbot-gateway`
**Image**: `openclaw:local`
**Version**: `2026.2.1`

---

## Container Setup

### Basic Information
- **Container Name**: `cladbot-gateway`
- **Container ID**: `26c5ad4de687`
- **Image**: `openclaw:local`
- **Ports**: `18789-18790:18789-18790` (exposed on localhost)
- **Status**: Running (up 7+ minutes at time of research)
- **Working Directory**: `/app`

### Network Access
- **Gateway WebSocket**: `ws://0.0.0.0:18789` ✅ Accessible
- **Gateway HTTP**: `http://localhost:18789` ✅ Accessible
- **Canvas UI**: `http://localhost:18789/__openclaw__/canvas/` ✅ Accessible

---

## Directory Structure

### Application Directory (`/app`)
```
/app/
├── dist/                    # Compiled TypeScript output
├── src/                     # Source code
│   ├── logging/             # Logging infrastructure
│   ├── sessions/            # Session management
│   ├── hooks/               # Hook system
│   ├── agents/              # Agent implementations
│   ├── gateway/             # Gateway server
│   ├── channels/            # Platform integrations (Telegram, Discord, etc.)
│   └── ...
├── skills/                  # Bundled skills
├── extensions/              # Channel extensions
├── packages/                # Internal packages
├── ui/                      # Web UI
├── .agent/                  # Agent configurations
│   └── workflows/
├── package.json             # Node.js dependencies
└── openclaw.mjs             # Entry point
```

### Data Directory (`/home/node/.openclaw/`)
```
/home/node/.openclaw/
├── agents/                  # Agent sessions and state
├── browser/                 # Browser automation data
├── browsers/                # Browser profiles (2 profiles detected)
├── canvas/                  # Canvas storage
├── credentials/             # Stored credentials (secure)
├── cron/                    # Cron job definitions
│   └── jobs.json
├── devices/                 # Connected devices
├── identity/                # User identity data
├── telegram/                # Telegram session data
│   └── update-offset-default.json
├── openhue/                 # Philips Hue integration
├── workspace/               # User workspace for skills
├── openclaw.json            # Main configuration file
├── openclaw.json.bak*       # Config backups (multiple versions)
└── update-check.json        # Update checker state
```

---

## Log System

### Log File Location
```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

### Log Format
Each log entry is a single-line JSON object with this structure:

```json
{
  "0": "{\"subsystem\":\"gateway\"}",           // Subsystem identifier
  "1": "listening on ws://0.0.0.0:18789",       // Log message
  "2": { /* optional additional data */ },      // Extra structured data
  "_meta": {
    "runtime": "node",
    "runtimeVersion": "22.22.0",
    "hostname": "26c5ad4de687",                 // Container ID
    "name": "{\"subsystem\":\"gateway\"}",
    "parentNames": ["openclaw"],
    "date": "2026-02-03T07:02:11.854Z",        // Event timestamp
    "logLevelId": 3,                            // Numeric level
    "logLevelName": "INFO",                     // Level name
    "path": {
      "fullFilePath": "file:///app/dist/logging/subsystem.js:175:16",
      "fileName": "subsystem.js",
      "fileNameWithLine": "subsystem.js:175",
      "fileColumn": "16",
      "fileLine": "175",
      "filePath": "dist/logging/subsystem.js",
      "filePathWithLine": "dist/logging/subsystem.js:175",
      "method": "logToFile"
    }
  },
  "time": "2026-02-03T07:02:11.854Z"           // ISO timestamp
}
```

### Log Levels
- `1` = TRACE
- `2` = DEBUG
- `3` = INFO
- `4` = WARN
- `5` = ERROR
- `6` = FATAL

### Key Subsystems
- `gateway` - Main gateway server
- `gateway/ws` - WebSocket connections
- `gateway/canvas` - Canvas service
- `gateway/heartbeat` - Heartbeat service
- `gateway/channels/telegram` - Telegram integration
- `agent/embedded` - Embedded agent execution
- `diagnostic` - Diagnostic and monitoring
- `tools` - Tool execution
- `skills` - Skill management
- `telegram/network` - Telegram networking
- `browser/service` - Browser control service
- `cron` - Cron job scheduler

---

## Event Types Discovered

### Session Lifecycle Events

#### 1. Session State Changes
```json
{
  "0": "{\"subsystem\":\"diagnostic\"}",
  "1": "session state: sessionId=c65a7834-... prev=idle new=processing reason=\"run_started\" queueDepth=0",
  "_meta": { "logLevelName": "DEBUG", ... }
}
```
**States**: `idle`, `processing`
**Reasons**: `run_started`, `run_completed`

#### 2. Run Lifecycle
```json
{
  "0": "{\"subsystem\":\"agent/embedded\"}",
  "1": "embedded run start: runId=05d563ee-... sessionId=c65a7834-... provider=ollama model=qwen3:8b thinking=off messageChannel=webchat",
  "_meta": { "logLevelName": "DEBUG", ... }
}
```

Events:
- `embedded run start` - Agent run begins
- `embedded run end` - Agent run completes
- `embedded run done` - Final cleanup
- `embedded run prompt start` - Prompt processing begins
- `embedded run prompt end` - Prompt processing completes (includes `durationMs`)
- `embedded run agent start` - Agent inference starts
- `embedded run agent end` - Agent inference ends

#### 3. Tool Execution
```json
{
  "0": "{\"subsystem\":\"agent/embedded\"}",
  "1": "embedded run tool start: runId=05d563ee-... tool=read toolCallId=call_fo4dvhxz"
}
```

Events:
- `embedded run tool start` - Tool execution begins
- `embedded run tool end` - Tool execution completes

### Gateway Events

#### 4. WebSocket Connections
```json
{
  "0": "{\"subsystem\":\"gateway/ws\"}",
  "1": "webchat connected conn=891cadac-... remote=172.29.0.1 client=openclaw-control-ui webchat vdev"
}
```

Events:
- `webchat connected` - Client connected
- `webchat disconnected` - Client disconnected (includes `code` and `reason`)

#### 5. Gateway Operations
```json
{
  "0": "{\"subsystem\":\"gateway/ws\"}",
  "1": "⇄ res ✓ chat.history 85ms conn=00e98e1e…eba6 id=6dfa1470…2889"
}
```

RPC-style operations with response times.

### Channel Events

#### 6. Telegram Events
```json
{
  "0": "{\"subsystem\":\"gateway/channels/telegram\"}",
  "1": "[default] starting provider (@CaricacoBot)"
}
```

Events:
- Provider starting
- Message received (not yet observed in logs)
- Message sent (not yet observed in logs)

### Queue/Lane Events

#### 7. Task Queue
```json
{
  "0": "{\"subsystem\":\"diagnostic\"}",
  "1": "lane enqueue: lane=session:agent:main:main queueSize=1"
}
```

Events:
- `lane enqueue` - Task added to queue
- `lane dequeue` - Task removed from queue (includes `waitMs`)

### Error Events

#### 8. Errors
```json
{
  "0": "{\"subsystem\":\"diagnostic\"}",
  "1": "lane task error: lane=main durationMs=427 error=\"FailoverError: HTTP 401...\"",
  "_meta": { "logLevelName": "ERROR", ... }
}
```

### Service Events

#### 9. Service Lifecycle
```json
{
  "0": "{\"subsystem\":\"gateway/heartbeat\"}",
  "1": {"intervalMs":1800000},
  "2": "heartbeat: started"
}
```

Events:
- `started` - Service started
- `stopped` - Service stopped (e.g., `gmail watcher stopped`)

---

## Configuration Structure

### Main Config File (`openclaw.json`)

```json
{
  "meta": {
    "lastTouchedVersion": "2026.2.1",
    "lastTouchedAt": "2026-02-03T03:08:07.961Z"
  },
  "wizard": {
    "lastRunAt": "2026-02-03T03:08:07.957Z",
    "lastRunVersion": "2026.2.1",
    "lastRunCommand": "doctor",
    "lastRunMode": "local"
  },
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "sk-ant-...",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-haiku-4-20250514",
            "name": "Claude Haiku 4 (Fast & Cheap)",
            "reasoning": false,
            "input": ["text", "image"],
            "contextWindow": 200000,
            "maxTokens": 8192
          },
          {
            "id": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4",
            "reasoning": false,
            "input": ["text", "image"],
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      },
      "ollama": {
        "baseUrl": "http://host.docker.internal:11434/v1",
        "apiKey": "ollama-local",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen2.5-coder:14b",
            "name": "Qwen 2.5 Coder 14B (Primary)",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 32768,
            "maxTokens": 8192
          },
          {
            "id": "qwen3:8b",
            "name": "Qwen 3 8B (Fast)",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 32768,
            "maxTokens": 8192
          }
          // ... more models
        ]
      }
    }
  }
}
```

**Key Fields**:
- `meta.lastTouchedVersion` - OpenClaw version
- `providers` - LLM provider configurations
- `models[].cost` - Cost per token (input/output/cache)
- `models[].contextWindow` - Context window size
- `models[].maxTokens` - Max output tokens

---

## Active Configuration

### Current Model
- **Active Model**: `ollama/qwen3:8b` (shown in console logs)
- **Fallback**: `anthropic/claude-haiku-4-20250514` (shown in log files)

### Connected Channels
- **Telegram**: `@CaricacoBot` ✅ Active
- **WebChat**: Available via control UI ✅ Active

### Services Running
- ✅ Gateway (ws://0.0.0.0:18789)
- ✅ Canvas Host (http://0.0.0.0:18789/__openclaw__/canvas/)
- ✅ Heartbeat (30-minute interval)
- ✅ Browser Control Service (2 profiles)
- ✅ Cron Service (0 jobs, enabled)
- ✅ Telegram Provider (@CaricacoBot)
- ❌ Gmail Watcher (appears to have stopped)
- ✅ Bonjour/mDNS Advertisement (OpenClaw._openclaw-gw._tcp.local.)

---

## Session Management

### Session Identifiers

**SessionID Format**: UUID v4
```
c65a7834-8158-440d-ab7d-b79abeb3e1c7
```

**RunID Format**: UUID v4
```
05d563ee-b549-4d44-a0b2-cc49b8dbc31f
```

**Connection ID Format**: UUID v4
```
891cadac-2e34-4018-9905-56fa4a8368fb
```

### Session Keys
- **SessionKey**: Referenced in logs but value shown as `unknown` in debug logs
- **Lane**: Task queue identifier (e.g., `main`, `session:agent:main:main`)

### Session States
- `idle` - No active processing
- `processing` - Agent is running

---

## Metadata for Integration

### Critical Fields for llmwhiteboard Tracking

#### From Log Entries

**Always Present**:
- `time` (ISO timestamp)
- `_meta.logLevelId` (1-6)
- `_meta.logLevelName` (TRACE/DEBUG/INFO/WARN/ERROR/FATAL)
- `_meta.hostname` (container ID)
- `_meta.date` (event timestamp)

**Subsystem-Specific** (in message text, needs parsing):
- `sessionId` - Session UUID
- `runId` - Run UUID
- `provider` - LLM provider (anthropic, ollama)
- `model` - Model name (claude-haiku-4-20250514, qwen3:8b)
- `messageChannel` - Source channel (webchat, telegram)
- `tool` - Tool name (read, write, bash, etc.)
- `toolCallId` - Tool invocation ID
- `durationMs` - Operation duration
- `lane` - Queue identifier
- `queueSize` - Queue depth
- `totalActive` - Active runs count

#### For Cost Calculation

**From Config**:
```json
{
  "model": "claude-haiku-4-20250514",
  "cost": {
    "input": 0.25,      // per 1M tokens (example)
    "output": 1.25,     // per 1M tokens (example)
    "cacheRead": 0.03,  // per 1M tokens
    "cacheWrite": 0.3   // per 1M tokens
  }
}
```

**From Logs** (when available):
- Token counts (not yet observed, may need to parse from provider responses)
- Duration for latency tracking

---

## Event Parsing Strategy

### Approach 1: Parse Structured Logs (Recommended)

**Pros**:
- Complete event coverage
- Structured data
- No code changes to OpenClaw

**Cons**:
- Requires parsing log message strings
- Some fields embedded in text (e.g., "embedded run start: runId=...")

### Parsing Patterns

```typescript
// Session lifecycle
/embedded run start: runId=(\S+) sessionId=(\S+) provider=(\S+) model=(\S+) .*messageChannel=(\S+)/

// Tool execution
/embedded run tool start: runId=(\S+) tool=(\S+) toolCallId=(\S+)/

// Duration tracking
/embedded run prompt end: runId=(\S+) sessionId=(\S+) durationMs=(\d+)/

// Session state
/session state: sessionId=(\S+) .*prev=(\w+) new=(\w+) reason="([^"]+)"/

// WebSocket events
/webchat (connected|disconnected) .*conn=(\S+)/

// Telegram
/\[default\] starting provider \((@\w+)\)/
```

### Event Type Mapping

| OpenClaw Log Pattern | llmwhiteboard Event Type |
|----------------------|--------------------------|
| `embedded run start` | `session_start` |
| `embedded run done` | `session_end` (if aborted=false) |
| `embedded run prompt start` | `user_prompt` |
| `embedded run tool start` (tool=*) | `tool_use_start` |
| `embedded run tool end` (tool=*) | `tool_use` |
| `session state: ...new=processing` | `agent_active` (custom) |
| `session state: ...new=idle` | `agent_idle` (custom) |
| `lane task error` | `error` |
| `webchat connected` | `connection` (custom) |
| `telegram...starting provider` | `channel_connected` (custom) |

---

## Next Steps

### Phase 2: Adapter Development

Based on these findings, the adapter needs to:

1. **Monitor log file** at `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
2. **Parse JSON log entries** line by line
3. **Extract event data** using regex patterns
4. **Map to normalized events** for llmwhiteboard
5. **Enrich metadata** with:
   - Provider and model from config
   - Cost data from config
   - Platform/channel information
   - Session and run IDs
6. **Handle daily log rotation** (YYYY-MM-DD format)

### Integration Method: Log File Monitoring

**Recommended Implementation**:
```typescript
// Use tail -f equivalent or file watcher
const logPath = `/tmp/openclaw/openclaw-${date}.log`;
watchFile(logPath, (line) => {
  const logEntry = JSON.parse(line);
  const event = parseOpenClawEvent(logEntry);
  if (event) {
    forwardToLlmWhiteboard(event);
  }
});
```

### Missing Information

**Still Need to Observe**:
- [ ] Actual message received/sent events (from Telegram)
- [ ] Token usage logging (if available)
- [ ] Plugin execution events
- [ ] Skill execution events
- [ ] Gmail webhook events
- [ ] Cron job execution
- [ ] Browser automation events
- [ ] Multi-turn conversation patterns

**To Test**:
- Send message via Telegram to @CaricacoBot
- Trigger a skill/command
- Observe agent's tool usage
- Check for cost/token logging

---

## Summary

### ✅ Phase 1 Complete

**Achievements**:
1. ✅ Container accessed successfully
2. ✅ File structure documented
3. ✅ Log format fully understood
4. ✅ Configuration structure mapped
5. ✅ Event types cataloged
6. ✅ Gateway connectivity confirmed
7. ✅ Active services identified
8. ✅ Session management understood

**Key Takeaways**:
- OpenClaw uses **structured JSON logging** to `/tmp/openclaw/` ✅
- **Subsystem-based architecture** with rich diagnostic data ✅
- **Session and run IDs** are UUIDs, trackable ✅
- **Provider/model information** logged with each run ✅
- **Cost data** available in config for calculation ✅
- **Multi-platform** (Telegram, WebChat active) ✅
- **Log file monitoring** is the best integration approach ✅

**Ready for Phase 2**: Adapter development can proceed with confidence! 🚀

---

**Appendix**: Example Log Entries

See full log output in:
```
C:\Users\emman\.claude\projects\D--sources-llmwhiteboard\a4f1186b-2289-497b-9acf-2d2b413288ae\tool-results\toolu_01SQFBL6nT7YKXKLUF1Y3qib.txt
```
