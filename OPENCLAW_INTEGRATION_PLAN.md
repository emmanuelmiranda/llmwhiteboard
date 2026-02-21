# OpenClaw Integration Plan

**Goal**: Integrate OpenClaw with llmwhiteboard to visualize OpenClaw operations (workflows, LLM calls, message routing, plugin execution) in the same dashboard used for Claude Code and Gemini CLI sessions.

**Priority**: P0 - Visualizing OpenClaw operations like regular LLM use

---

## Architecture Overview

```
OpenClaw Operations (Container)
    ↓
Hook System (internal-hooks) + Log Transport
    ↓
OpenClaw Adapter (new)
    ↓
llmwhiteboard Sync API
    ↓
PostgreSQL + SignalR
    ↓
Dashboard Visualization
```

## OpenClaw Event System

OpenClaw provides two integration points:

### 1. Hook System
- **Event Types**: `command`, `session`, `agent`, `gateway`
- **Event Structure**:
  ```typescript
  {
    type: "command" | "session" | "agent" | "gateway",
    action: string,              // e.g., "new", "bootstrap", "message"
    sessionKey: string,          // Session identifier
    context: Record<string, unknown>, // Event-specific data
    timestamp: Date,
    messages: string[]           // User-facing output
  }
  ```
- **Registration**: `registerHook(handler)` - can filter by `"type"` or `"type:action"`

### 2. Log Transport System
- **Structured JSON logs** with `tslog`
- **Log levels**: trace, debug, info, warn, error, fatal
- **Registration**: `registerLogTransport(transport)` - receives all log events
- **File storage**: `~/.openclaw/logs/openclaw-YYYY-MM-DD.log`

---

## Phase 1: Research & Explore Container Setup

**Objective**: Understand the running OpenClaw instance and its runtime behavior

### Tasks

- [ ] **1.1** Verify container access
  ```bash
  # Test Docker access
  docker ps | grep openclaw
  docker exec -it <openclaw-container> openclaw --version
  ```

- [ ] **1.2** Explore OpenClaw container file structure
  ```bash
  # Check OpenClaw directory
  docker exec -it <openclaw-container> ls -la ~/.openclaw/

  # Examine config files
  docker exec -it <openclaw-container> cat ~/.openclaw/config.json

  # Check log directory
  docker exec -it <openclaw-container> ls -la ~/.openclaw/logs/
  ```

- [ ] **1.3** Examine OpenClaw logs
  ```bash
  # View recent logs
  docker exec -it <openclaw-container> tail -f ~/.openclaw/logs/openclaw-$(date +%Y-%m-%d).log

  # Or view container logs
  docker logs <openclaw-container> --tail 100 -f
  ```

- [ ] **1.4** Test gateway connectivity
  ```bash
  # Check if gateway is running and accessible
  curl http://<container-host>:18789/health

  # Or if using WebSocket
  wscat -c ws://<container-host>:18789
  ```

- [ ] **1.5** Document active workflows and sessions
  - Observe what channels are connected (WhatsApp, Telegram, etc.)
  - Note session key format
  - Identify what events are being logged
  - Check if transcripts are stored

- [ ] **1.6** Test triggering events
  - Send a test message through connected channel
  - Trigger a skill/workflow if configured
  - Observe console output and logs
  - Document event structure and timing

- [ ] **1.7** Analyze log file format
  ```bash
  # Parse a log entry
  docker exec -it <openclaw-container> head -1 ~/.openclaw/logs/openclaw-$(date +%Y-%m-%d).log | jq .
  ```
  - Understand JSON structure
  - Identify important fields (timestamp, level, subsystem, message)
  - Note metadata fields
  - Check for token usage or cost data

- [ ] **1.8** Research OpenClaw's source code integration points
  - Examine `/src/hooks/` for hook system details
  - Review `/src/logging/` for log transport mechanism
  - Check `/src/sessions/` for session management
  - Identify where LLM calls are made and logged

**Deliverable**: Documentation of OpenClaw's runtime behavior, event patterns, and container setup

---

## Phase 2: OpenClaw Adapter Development

**Objective**: Create an adapter that translates OpenClaw events to llmwhiteboard's normalized format

### Tasks

- [ ] **2.1** Create OpenClaw adapter file
  - Path: `cli/src/lib/adapters/openclaw.ts`
  - Implement `CliAdapter` interface
  - Set `cliType = "openclaw"`

- [ ] **2.2** Implement adapter configuration methods
  ```typescript
  - isInstalled(): Promise<boolean>         // Check for ~/.openclaw/ or container
  - getVersion(): Promise<string | null>    // Parse openclaw --version
  - getConfigDir(): string                  // Return ~/.openclaw or container path
  - getSettingsPath(): string               // Config file location
  ```

- [ ] **2.3** Define OpenClaw-specific event types
  ```typescript
  type OpenClawHookEvent =
    | "command"       // CLI command executed
    | "session"       // Session lifecycle event
    | "agent"         // Agent operation (bootstrap, inference)
    | "gateway"       // Gateway operation (message routing)
    | "log";          // Log transport event

  interface OpenClawHookContext {
    type: OpenClawHookEvent;
    action: string;
    sessionKey: string;
    context: Record<string, unknown>;
    timestamp: Date;
    messages?: string[];
    // Log-specific fields:
    level?: string;
    subsystem?: string;
    logMessage?: string;
  }
  ```

- [ ] **2.4** Implement hook configuration generation
  ```typescript
  getHookConfig(hookCommand: string): HookConfiguration
  // Should generate OpenClaw plugin/hook registration
  ```

- [ ] **2.5** Implement event parser
  ```typescript
  parseHookContext(stdin: string): NormalizedHookContext
  // Maps OpenClaw events → llmwhiteboard event format
  ```

- [ ] **2.6** Map OpenClaw events to normalized event types
  ```typescript
  mapEventType(type: string, action: string): NormalizedEventType

  Mappings:
  - "session:start" → "session_start"
  - "session:end" → "session_end"
  - "agent:inference" → "tool_use" (with toolName = provider:model)
  - "gateway:message_received" → "user_prompt"
  - "gateway:message_sent" → "agent_response"
  - "command:*" → "notification"
  - "log:error" → "error"
  ```

- [ ] **2.7** Extract metadata from OpenClaw events
  ```typescript
  // Parse context object for useful metadata:
  - Platform/channel (whatsapp, telegram, etc.)
  - LLM provider and model
  - Token usage (if available)
  - Cost estimates (if available)
  - Workflow/skill name
  - User ID (hashed for privacy)
  - Plugin name
  - Message content (preview)
  - Routing information
  ```

- [ ] **2.8** Handle transcript path resolution
  - Determine where OpenClaw stores session transcripts
  - Implement `getTranscriptPath(projectPath, sessionId)`
  - Handle cases where transcripts don't exist
  - Consider building transcripts from event stream

- [ ] **2.9** Implement resume command generation
  ```typescript
  getResumeCommand(sessionId: string): string
  // e.g., "openclaw gateway --resume {sessionId}"
  // or connect to existing gateway with session context
  ```

- [ ] **2.10** Register adapter in adapter index
  - Edit `cli/src/lib/adapters/index.ts`
  - Add `OpenClawAdapter` to available adapters
  - Export type `"openclaw"` in `CliType` union

**Deliverable**: Fully implemented OpenClaw adapter that can parse events and generate hook configurations

---

## Phase 3: OpenClaw Integration Layer

**Objective**: Create a bridge between OpenClaw container and llmwhiteboard

### Approach Options

We have several options for connecting OpenClaw to llmwhiteboard:

#### Option A: OpenClaw Plugin (Native Integration)
Create a skill/plugin inside OpenClaw that forwards events

#### Option B: External Monitor (Sidecar Pattern)
Run a separate process that monitors OpenClaw logs/gateway

#### Option C: Gateway Proxy (Intercept Pattern)
Proxy OpenClaw's gateway to capture all operations

**Recommended**: Start with **Option B (External Monitor)** for minimal OpenClaw changes

### Tasks

- [ ] **3.1** Create monitoring script
  ```bash
  # File: cli/src/lib/openclaw/monitor.ts
  # Monitors OpenClaw logs or gateway WebSocket
  ```

- [ ] **3.2** Implement log file watcher
  ```typescript
  // Watch ~/.openclaw/logs/openclaw-YYYY-MM-DD.log
  // Parse JSON log entries
  // Filter relevant events
  // Forward to llmwhiteboard CLI
  ```

- [ ] **3.3** Implement WebSocket gateway monitor (alternative)
  ```typescript
  // Connect to ws://localhost:18789
  // Subscribe to all events
  // Parse gateway messages
  // Forward to llmwhiteboard CLI
  ```

- [ ] **3.4** Add event buffering and batching
  - Buffer events to reduce API calls
  - Batch similar events together
  - Handle high-volume scenarios

- [ ] **3.5** Implement error handling and retry logic
  - Handle network failures gracefully
  - Implement exponential backoff
  - Queue events during downtime
  - Persist queue to disk if needed

- [ ] **3.6** Add configuration
  ```json
  {
    "openclaw": {
      "enabled": true,
      "containerHost": "localhost",
      "gatewayPort": 18789,
      "logPath": "~/.openclaw/logs",
      "monitorMethod": "logs|gateway|both",
      "apiToken": "lwb_sk_...",
      "eventFilters": {
        "minLogLevel": "info",
        "includeEvents": ["session", "agent", "gateway"],
        "excludeSubsystems": ["debug", "verbose"]
      }
    }
  }
  ```

- [ ] **3.7** Create CLI command for monitoring
  ```bash
  # Add new command: llmwhiteboard-cli openclaw monitor
  llmwhiteboard-cli openclaw monitor --container <container-name>
  llmwhiteboard-cli openclaw monitor --log-path ~/.openclaw/logs
  llmwhiteboard-cli openclaw monitor --gateway ws://localhost:18789
  ```

- [ ] **3.8** Test monitor with live OpenClaw instance
  - Start monitoring script
  - Trigger OpenClaw events
  - Verify events are captured
  - Check llmwhiteboard API receives events
  - Validate session creation

**Deliverable**: Working monitoring system that forwards OpenClaw events to llmwhiteboard

---

## Phase 4: CLI Hook Handler Enhancement

**Objective**: Update llmwhiteboard CLI to handle OpenClaw events

### Tasks

- [ ] **4.1** Update CLI hook command to support OpenClaw
  - Edit `cli/src/commands/hook.ts`
  - Add OpenClaw adapter detection
  - Parse OpenClaw event format

- [ ] **4.2** Add OpenClaw event validation
  - Validate event structure
  - Handle missing fields gracefully
  - Log parsing errors with context
  - Add schema validation (Zod)

- [ ] **4.3** Map OpenClaw sessions to llmwhiteboard sessions
  - Use OpenClaw's `sessionKey` as `localSessionId`
  - Generate consistent machine IDs (container-based)
  - Handle workspace directory as `projectPath`
  - Support multiple concurrent sessions

- [ ] **4.4** Handle transcript extraction
  - Check if OpenClaw provides transcript files
  - If not, build transcript from event stream
  - Store events in temporary buffer for transcript upload
  - Format transcript as JSONL or structured format

- [ ] **4.5** Implement session title generation
  - Extract meaningful titles from OpenClaw events
  - Use first message or command as title
  - Include platform/channel in title
  - Fallback to "OpenClaw [platform] session" + timestamp

- [ ] **4.6** Add OpenClaw-specific metadata enrichment
  - Extract platform/channel information
  - Parse LLM provider details from logs
  - Calculate cost estimates from token usage
  - Include plugin/skill names
  - Add routing information
  - Extract user identifiers (hashed)

- [ ] **4.7** Handle different event sources
  - Process hook events (if using Option A)
  - Process log entries (if using Option B)
  - Process gateway messages (WebSocket)
  - Normalize all sources to common format

**Deliverable**: llmwhiteboard CLI can process OpenClaw events from multiple sources

---

## Phase 5: Backend API Extensions

**Objective**: Extend backend to handle OpenClaw-specific data

### Tasks

- [ ] **5.1** Update CliType enum to include "openclaw"
  - Edit `backend/LlmWhiteboard.Api/Models/Session.cs`
  - Add `OpenClaw` to `CliType` enum

- [ ] **5.2** Extend SessionEvent metadata schema for OpenClaw
  ```csharp
  // Add to SessionEvent.Metadata JSONB:
  {
    "provider": "anthropic|openai|bedrock|ollama",
    "model": "claude-opus-4-5|gpt-4|...",
    "platform": "whatsapp|telegram|discord|slack|imessage|...",
    "channel": string,
    "channelType": "dm|group",
    "workflowType": string,
    "skillName": string,
    "pluginName": string,
    "inputTokens": int,
    "outputTokens": int,
    "costCents": decimal,
    "latencyMs": int,
    "userId": string, // hashed
    "userName": string, // anonymized
    "messageId": string,
    "sourceEvent": "command|session|agent|gateway",
    "routingRule": string,
    "sourceHost": string, // container name
    "eventAction": string,
    "subsystem": string,
    "logLevel": string
  }
  ```

- [ ] **5.3** Create cost aggregation queries
  - Add repository methods for cost analytics
  - Group by provider, model, platform
  - Calculate daily/weekly/monthly totals
  - Track cost per session
  - Aggregate by workflow type

- [ ] **5.4** Add OpenClaw-specific session queries
  - Filter sessions by platform
  - Filter by workflow type
  - Search by plugin/skill name
  - Filter by channel type (DM vs Group)
  - Filter by container/host

- [ ] **5.5** Create analytics endpoints
  ```csharp
  GET /api/openclaw/cost-summary?period=daily|weekly|monthly
  GET /api/openclaw/platform-activity?days=7
  GET /api/openclaw/model-usage?provider=anthropic|openai|bedrock|ollama
  GET /api/openclaw/skills/top?limit=10
  GET /api/openclaw/channels?platform=whatsapp
  ```

- [ ] **5.6** Extend session detail endpoint
  - Include OpenClaw-specific metadata
  - Return platform/channel information
  - Include cost breakdown
  - Add message routing visualization data
  - Include skill/workflow execution timeline

- [ ] **5.7** Add event filtering for OpenClaw
  - Filter events by platform
  - Filter by event source (command/session/agent/gateway)
  - Filter by provider/model
  - Filter by channel type
  - Filter by log level

- [ ] **5.8** Add session relationship tracking (optional)
  - Track if OpenClaw session triggered Claude Code session
  - Store parent-child relationships
  - Add API to query related sessions

**Deliverable**: Backend API supports OpenClaw sessions with rich metadata and analytics

---

## Phase 6: Frontend Visualization

**Objective**: Create UI components to visualize OpenClaw operations

### Tasks

#### 6.1: Session List Enhancements

- [ ] **6.1.1** Add OpenClaw session indicator
  - Show OpenClaw icon/badge on session cards
  - Display platform icon (WhatsApp, Telegram, Discord, etc.)
  - Show workflow/skill name if available
  - Add container/host indicator

- [ ] **6.1.2** Add platform filter to session list
  - Filter dropdown: All | WhatsApp | Telegram | Discord | Slack | iMessage | ...
  - Filter by OpenClaw vs other CLI types
  - Filter by channel type (DM vs Group)

- [ ] **6.1.3** Display cost on session cards
  - Show total cost for OpenClaw sessions
  - Color-code by cost range (green < $0.10, yellow < $1.00, red > $1.00)
  - Add cost trend indicator (up/down from average)
  - Show cost per message metric

#### 6.2: Session Detail Page

- [ ] **6.2.1** Create OpenClaw event timeline component
  ```typescript
  // src/components/openclaw/OpenClawEventTimeline.tsx
  - Display events chronologically
  - Group by conversation/workflow
  - Show message routing flow
  - Highlight LLM inference events
  - Show plugin/skill executions
  - Display command executions
  ```

- [ ] **6.2.2** Create message routing visualization
  ```typescript
  // src/components/openclaw/MessageRoutingFlow.tsx
  - Show platform → OpenClaw → platform flow
  - Visualize cross-platform bridges
  - Display routing rules applied
  - Show gateway operations
  - Sankey diagram for message flow
  ```

- [ ] **6.2.3** Add LLM inference cards
  ```typescript
  // src/components/openclaw/LLMInferenceCard.tsx
  - Show provider and model
  - Display token usage (input/output)
  - Show cost (with breakdown)
  - Display latency
  - Include prompt preview (if available)
  - Show completion preview
  - Add model settings (temperature, etc.)
  ```

- [ ] **6.2.4** Create plugin execution timeline
  ```typescript
  // src/components/openclaw/PluginExecutionTimeline.tsx
  - List plugins/skills executed in order
  - Show execution time
  - Display success/failure status
  - Include plugin-specific metadata
  - Show dependencies between executions
  ```

- [ ] **6.2.5** Add platform-specific metadata display
  - Show channel information (name, type)
  - Display user ID (hashed) or username
  - Show message IDs and timestamps
  - Include platform-specific context
  - Display media attachments (if any)

- [ ] **6.2.6** Create conversation thread view
  ```typescript
  // src/components/openclaw/ConversationThread.tsx
  - Group related messages by conversation
  - Show user vs bot messages
  - Display message bubbles (chat-like UI)
  - Include platform badges
  - Show timestamps and costs
  - Support threading for group chats
  ```

#### 6.3: Analytics Dashboard

- [ ] **6.3.1** Create cost tracking dashboard
  ```typescript
  // src/app/(dashboard)/openclaw/costs/page.tsx
  - Daily/weekly/monthly cost charts (line/bar)
  - Breakdown by provider (pie chart)
  - Breakdown by model (stacked bar)
  - Breakdown by platform (comparison)
  - Breakdown by workflow type
  - Cost per session histogram
  - Cumulative cost over time
  - Budget progress indicator
  ```

- [ ] **6.3.2** Create platform activity dashboard
  ```typescript
  // src/app/(dashboard)/openclaw/activity/page.tsx
  - Message volume by platform (bar chart)
  - Response times by channel (box plot)
  - Success rate by platform (gauge)
  - Active conversations count (metric cards)
  - Platform distribution (donut chart)
  - Peak activity times (heatmap)
  ```

- [ ] **6.3.3** Create model comparison view
  ```typescript
  // src/app/(dashboard)/openclaw/models/page.tsx
  - Compare providers (OpenAI vs Anthropic vs Bedrock vs Ollama)
  - Average latency comparison (bar chart)
  - Cost per token comparison (scatter plot)
  - Success rate comparison (bullet chart)
  - Usage volume comparison (stacked area)
  - Model-specific metrics table
  - Cost efficiency score (composite metric)
  ```

- [ ] **6.3.4** Create workflow/skill analytics
  ```typescript
  // src/app/(dashboard)/openclaw/workflows/page.tsx
  - Most used skills (top 10 list)
  - Success rate by workflow (bar chart)
  - Average execution time (comparison)
  - Cost per workflow type (breakdown)
  - Skill dependency graph (network diagram)
  - Workflow trends over time (line chart)
  ```

- [ ] **6.3.5** Create channel analytics
  ```typescript
  // src/app/(dashboard)/openclaw/channels/page.tsx
  - Active channels list with metrics
  - Messages per channel
  - Average response time per channel
  - Cost per channel
  - User activity by channel
  - Channel growth trends
  ```

#### 6.4: Event Visualization Components

- [ ] **6.4.1** Create OpenClaw event item component
  ```typescript
  // src/components/events/OpenClawEventItem.tsx
  - Render different event types with appropriate icons
  - Show platform-specific styling/colors
  - Display cost for LLM events (badge)
  - Include metadata expandable section
  - Show timing information
  - Add action buttons (view details, copy, etc.)
  ```

- [ ] **6.4.2** Add event type icons
  - Message received (incoming arrow, platform color)
  - Message sent (outgoing arrow, platform color)
  - LLM inference (brain/sparkle icon, provider badge)
  - Plugin execution (puzzle piece icon)
  - Skill execution (star icon)
  - Command execution (terminal icon)
  - Gateway operation (router icon)
  - Error (warning triangle, red)
  - Session start/end (play/stop icons)

- [ ] **6.4.3** Create conversation thread view
  ```typescript
  // src/components/openclaw/ConversationThread.tsx
  - Group related messages by sessionKey
  - Show user vs bot messages (different sides)
  - Display platform context (header)
  - Include timestamp and cost
  - Support rich media (images, files)
  - Add message actions (copy, quote, etc.)
  ```

- [ ] **6.4.4** Add platform-specific styling
  ```css
  - WhatsApp: Green accents (#25D366)
  - Telegram: Blue accents (#0088cc)
  - Discord: Purple accents (#5865F2)
  - Slack: Purple/pink accents (#4A154B)
  - iMessage: Blue accents (#007AFF)
  ```

#### 6.5: Real-time Updates

- [ ] **6.5.1** Update SignalR handlers for OpenClaw events
  - Handle OpenClaw-specific event types
  - Update UI in real-time for new messages
  - Animate cost updates
  - Notify on high-cost operations
  - Show live typing indicators (if available)

- [ ] **6.5.2** Add live activity indicator
  - Show active OpenClaw sessions (pulsing dot)
  - Display real-time message count
  - Show current cost accumulation (live ticker)
  - Indicate which platforms are active
  - Show active skills/workflows

- [ ] **6.5.3** Add notification system
  - Toast notifications for new messages
  - Alert on high-cost operations (> threshold)
  - Notify on errors or failures
  - Sound notifications (optional, user preference)

#### 6.6: Settings & Configuration

- [ ] **6.6.1** Add OpenClaw settings page
  ```typescript
  // src/app/(dashboard)/settings/openclaw/page.tsx
  - Configure monitoring settings
  - Set cost thresholds and alerts
  - Manage platform visibility
  - Configure event filters
  - Set budget limits
  ```

- [ ] **6.6.2** Add cost alert configuration
  - Set daily/weekly/monthly budgets
  - Configure alert thresholds
  - Choose notification methods
  - Set per-platform budgets

**Deliverable**: Comprehensive UI for visualizing OpenClaw operations with real-time updates

---

## Phase 7: Testing & Refinement

**Objective**: Ensure robust integration with comprehensive testing

### Tasks

- [ ] **7.1** Unit tests for OpenClaw adapter
  - Test event parsing for each event type
  - Test event type mapping
  - Test metadata extraction
  - Test error handling (malformed events)
  - Test edge cases (missing fields)

- [ ] **7.2** Integration tests
  - Test monitoring script with mock OpenClaw
  - Test event forwarding to API
  - Test transcript upload/building
  - Test session creation/update
  - Test cost calculation

- [ ] **7.3** End-to-end tests
  - Send test messages through OpenClaw
  - Verify events appear in dashboard
  - Test real-time updates
  - Verify cost calculations
  - Test multiple concurrent sessions
  - Test different platforms

- [ ] **7.4** Performance testing
  - Test with high event volume (100+ events/sec)
  - Verify no event loss
  - Check memory usage of monitoring script
  - Test reconnection logic after network failure
  - Benchmark API response times

- [ ] **7.5** Error scenario testing
  - Test with API unavailable (should queue events)
  - Test with malformed events (should log and skip)
  - Test with missing metadata (should use defaults)
  - Test with invalid tokens (should retry with auth)
  - Test with container restart
  - Test with network interruption

- [ ] **7.6** Container integration testing
  - Test with OpenClaw container restart
  - Test with multiple OpenClaw containers
  - Test with container networking issues
  - Test monitoring script restart/recovery

- [ ] **7.7** Documentation
  - Write setup guide for OpenClaw integration
  - Document event types and metadata
  - Create troubleshooting guide
  - Add examples and screenshots
  - Document container setup requirements
  - Create architecture diagrams

- [ ] **7.8** User testing
  - Test with real OpenClaw workflows
  - Test multiple platforms simultaneously
  - Gather feedback on visualization
  - Identify missing features or pain points
  - Refine UI based on feedback

**Deliverable**: Production-ready OpenClaw integration with comprehensive documentation

---

## Phase 8: Advanced Features (Future)

### Cross-tool Session Linking

- [ ] **8.1** Link OpenClaw sessions to Claude Code sessions
  - Detect when OpenClaw message triggers a coding session
  - Create parent-child relationship in database
  - Display linked sessions in UI
  - Support bidirectional navigation

- [ ] **8.2** Session correlation visualization
  - Show session dependency graph (D3.js or React Flow)
  - Display cross-tool workflows
  - Highlight automation chains
  - Show timing relationships

### Predictive Analytics

- [ ] **8.3** Cost forecasting
  - Predict monthly costs based on usage patterns
  - Use time-series analysis (moving average)
  - Alert when approaching budget limits
  - Suggest optimizations based on trends

- [ ] **8.4** Model recommendations
  - Analyze performance vs cost trade-offs
  - Suggest model switches for cost savings
  - Compare local (Ollama) vs API costs
  - Recommend based on latency requirements

### Automation

- [ ] **8.5** Budget alerts
  - Set daily/weekly/monthly budgets
  - Send notifications when exceeded
  - Option to pause workflows at limit
  - Email/Slack/webhook integrations

- [ ] **8.6** Performance alerts
  - Alert on high latency (> threshold)
  - Alert on elevated error rates (> X%)
  - Alert on unusual cost spikes (> Y% increase)
  - Customizable alert rules

### Exports & Reporting

- [ ] **8.7** Cost reports
  - Generate PDF/CSV reports
  - Include charts and breakdowns
  - Schedule automated reports (daily/weekly/monthly)
  - Email delivery

- [ ] **8.8** Conversation exports
  - Export conversation threads
  - Include full context and metadata
  - Support multiple formats (JSON, Markdown, PDF)
  - Preserve platform-specific formatting

### Multi-Container Support

- [ ] **8.9** Support multiple OpenClaw instances
  - Monitor multiple containers simultaneously
  - Distinguish sessions by container
  - Aggregate metrics across instances
  - Load balancing insights

---

## Success Criteria

### Phase 1 Success (Container Explored)
- ✅ Can access OpenClaw container
- ✅ Logs are readable and parseable
- ✅ Event format is understood
- ✅ Gateway is accessible (if using WebSocket approach)

### Phase 2 Success (Adapter Working)
- ✅ OpenClaw events are captured by the adapter
- ✅ Events are parsed correctly
- ✅ Normalized events match llmwhiteboard format
- ✅ Unit tests passing

### Phase 3 Success (Monitoring Working)
- ✅ Monitoring script runs reliably
- ✅ Events are forwarded to llmwhiteboard API
- ✅ No event loss under normal load
- ✅ Recovery works after failures

### Phase 4-5 Success (Backend Integration)
- ✅ CLI processes OpenClaw events
- ✅ Sessions created in backend
- ✅ Metadata stored correctly
- ✅ API endpoints return OpenClaw data

### Phase 6 Success (Visualization Working)
- ✅ OpenClaw sessions visible in dashboard
- ✅ Events displayed in timeline with proper icons
- ✅ Metadata rendered correctly
- ✅ Real-time updates working
- ✅ Platform-specific styling applied
- ✅ Cost information displayed

### Phase 7 Success (Production Ready)
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Error handling robust
- ✅ Performance acceptable (< 1% CPU, < 100MB RAM)
- ✅ No memory leaks

### Full Integration Success (P0 Complete)
- ✅ **OpenClaw operations visualized like Claude Code sessions**
- ✅ Message routing visible in timeline
- ✅ LLM inferences tracked with cost
- ✅ Plugin/skill executions logged
- ✅ Real-time updates functioning
- ✅ Multi-platform activity visible
- ✅ Cost tracking working
- ✅ Conversation threads rendered properly

---

## Technical Decisions to Make

### Decision 1: Monitoring Method
**Question**: How should we capture OpenClaw events?

**Options**:
- **A) Log file monitoring**: Watch log files for events
- **B) WebSocket gateway monitoring**: Connect to gateway WebSocket
- **C) OpenClaw plugin**: Create native plugin that uses hook system
- **D) Hybrid**: Use both logs and hooks

**Recommendation**: Start with **A (Log file monitoring)** - simpler, no OpenClaw code changes. Consider C later for more structured events.

**Trade-offs**:
- A: Simple, non-invasive, but may miss some events or have parsing issues
- B: Real-time, complete, but requires gateway protocol understanding
- C: Native, structured, but requires plugin development in OpenClaw
- D: Most complete, but most complex

---

### Decision 2: Transcript Handling
**Question**: How do we handle transcripts for OpenClaw sessions?

**Options**:
- **A) No transcripts**: Just store events, skip transcript upload
- **B) Build from events**: Construct transcript from event stream in-memory
- **C) Use OpenClaw logs**: Parse daily log files as transcripts
- **D) Session reconstruction**: Build transcript on-demand from stored events

**Recommendation**: Start with **B (Build from events)** - provides transcript for visualization, can be optimized later

---

### Decision 3: Session Identity
**Question**: What should we use as the OpenClaw session ID?

**Options**:
- **A) sessionKey**: Use OpenClaw's native sessionKey
- **B) Generate unique ID**: Create llmwhiteboard-specific ID per conversation
- **C) Platform + User ID**: Use platform-specific conversation identifiers
- **D) Container + sessionKey**: Combine container name with sessionKey for multi-instance

**Recommendation**: **D (Container + sessionKey)** for uniqueness across multiple containers, fallback to A for single container

---

### Decision 4: Cost Calculation
**Question**: How do we calculate costs for LLM calls?

**Options**:
- **A) Parse from OpenClaw logs**: If OpenClaw logs costs/tokens
- **B) Calculate ourselves**: Use token counts + pricing tables
- **C) Estimate**: Use average costs per model based on message length
- **D) External API**: Query provider APIs for usage/cost

**Recommendation**: **B (Calculate ourselves)** with pricing table maintained in code, fall back to C if token data unavailable

**Pricing Table** (as of 2026-02):
```typescript
const MODEL_PRICING = {
  'claude-opus-4-5': { input: 15, output: 75 }, // per 1M tokens
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  // Ollama models: free (local)
};
```

---

### Decision 5: Container Communication
**Question**: How should the monitoring script access the OpenClaw container?

**Options**:
- **A) Docker exec**: Execute commands in container
- **B) Volume mount**: Mount container logs to host
- **C) Network access**: Access gateway via container's network port
- **D) Docker API**: Use Docker API to read logs

**Recommendation**: **B (Volume mount)** for log files + **C (Network access)** for gateway - most efficient and reliable

---

## Dependencies

### OpenClaw Requirements
- OpenClaw running in accessible container
- Container logs accessible (via volume mount or docker logs)
- Gateway accessible if using WebSocket approach (port 18789)
- Understanding of session/transcript format

### llmwhiteboard Requirements
- CLI tool working
- Backend API accepting events
- SignalR for real-time updates
- PostgreSQL with JSONB support

### Development Environment
- Node.js 22+ (for llmwhiteboard CLI)
- Docker access for container operations
- TypeScript development setup
- Access to test messaging platforms (or use webchat)

### Container Setup
- OpenClaw container with logs accessible
- Port 18789 exposed (if using gateway monitoring)
- Volume mount for `~/.openclaw/logs` (recommended)
- Container name/ID documented

---

## Risk Mitigation

### Risk 1: OpenClaw API/Format Changes
**Mitigation**:
- Version-pin OpenClaw container image
- Document API version used
- Monitor OpenClaw releases for breaking changes
- Add version detection to adapter

### Risk 2: High Event Volume
**Mitigation**:
- Implement event batching (10 events or 1 second window)
- Add rate limiting to API calls
- Use queue with disk persistence if needed
- Monitor memory usage and add limits

### Risk 3: Missing Metadata
**Mitigation**:
- Handle optional fields gracefully with defaults
- Provide fallback values (e.g., "unknown" for missing provider)
- Log missing data for improvement
- Add configuration to ignore certain missing fields

### Risk 4: Platform-Specific Quirks
**Mitigation**:
- Test across multiple platforms (WhatsApp, Telegram, Discord)
- Document platform differences
- Handle edge cases (group chats, media messages, etc.)
- Add platform-specific parsers if needed

### Risk 5: Container Restarts
**Mitigation**:
- Detect container restarts (monitor Docker events)
- Reconnect monitoring automatically
- Track last processed event to avoid duplicates
- Use persistent queue for undelivered events

### Risk 6: Network Failures
**Mitigation**:
- Implement retry logic with exponential backoff
- Queue events during outage
- Persist queue to disk
- Add heartbeat/health checks

---

## Container Setup Instructions

### Recommended Configuration

**1. Volume Mount for Logs**
```bash
docker run -d \
  --name openclaw \
  -v ~/.openclaw/logs:/root/.openclaw/logs \
  -p 18789:18789 \
  openclaw/openclaw:latest
```

**2. Network Access**
Ensure port 18789 is exposed if using gateway monitoring

**3. Log Rotation**
Configure log rotation to prevent disk issues:
```bash
docker run -d \
  --name openclaw \
  --log-opt max-size=100m \
  --log-opt max-file=3 \
  openclaw/openclaw:latest
```

### Monitoring Script Deployment

**Option 1: Run on Host**
```bash
# Start monitoring
llmwhiteboard-cli openclaw monitor --container openclaw

# Run as daemon
nohup llmwhiteboard-cli openclaw monitor --container openclaw > monitor.log 2>&1 &
```

**Option 2: Run as Sidecar Container**
```yaml
# docker-compose.yml
services:
  openclaw:
    image: openclaw/openclaw:latest
    volumes:
      - openclaw-logs:/root/.openclaw/logs
    ports:
      - "18789:18789"

  llmwhiteboard-monitor:
    image: llmwhiteboard-cli:latest
    volumes:
      - openclaw-logs:/logs:ro
    environment:
      - OPENCLAW_LOG_PATH=/logs
      - LLMWHITEBOARD_API_TOKEN=${LLMWHITEBOARD_API_TOKEN}
    command: openclaw monitor --log-path /logs

volumes:
  openclaw-logs:
```

---

## Next Steps

### Immediate Actions

1. ✅ **Review this plan** - Ensure alignment on scope and approach
2. ⬜ **Make technical decisions** - Choose monitoring method, transcript handling, etc.
3. ⬜ **Explore container** - Start Phase 1 to understand current setup
4. ⬜ **Prototype adapter** - Create skeleton OpenClawAdapter
5. ⬜ **Test event capture** - Verify we can capture and parse events

### Getting Started Checklist

- [ ] Verify container access: `docker ps | grep openclaw`
- [ ] Check OpenClaw logs: `docker logs openclaw --tail 50`
- [ ] Examine log structure: `docker exec openclaw cat ~/.openclaw/logs/openclaw-*.log | head -1 | jq .`
- [ ] Test gateway access: `curl http://localhost:18789/health` (if exposed)
- [ ] Document container setup (image, volumes, ports)
- [ ] Send test message through OpenClaw and observe logs
- [ ] Create decision log for technical choices
- [ ] Set up development environment for adapter development

---

## Resources

### OpenClaw
- OpenClaw GitHub: https://github.com/openclaw/openclaw
- OpenClaw Docs: https://docs.openclaw.ai/
- OpenClaw Hook System: `src/hooks/internal-hooks.ts`
- OpenClaw Logging: `src/logging/logger.ts`
- OpenClaw Sessions: `src/sessions/transcript-events.ts`

### llmwhiteboard
- Adapter Pattern: `cli/src/lib/adapters/claude-code.ts`
- Hook System: `cli/src/commands/hook.ts`
- Adapter Interface: `cli/src/lib/cli-adapter.ts`
- API Client: `cli/src/lib/api.ts`

### Documentation
- Docker Logging: https://docs.docker.com/config/containers/logging/
- Docker Volumes: https://docs.docker.com/storage/volumes/
- WebSocket (wscat): `npm install -g wscat`

### Related GitHub Issues
- OpenClaw Releases: https://github.com/openclaw/openclaw/releases
- Wikipedia: https://en.wikipedia.org/wiki/OpenClaw

---

**Status**: 📋 Planning Complete - Ready to Start Phase 1
**Last Updated**: 2026-02-03
**Container Setup**: Available at localhost (verify configuration)
