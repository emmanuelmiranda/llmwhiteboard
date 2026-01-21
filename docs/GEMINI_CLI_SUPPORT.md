# Gemini CLI Support

This document outlines what work is needed to add Gemini CLI support to LLM Whiteboard, including comprehensive support for all lifecycle hooks in both Claude Code and Gemini CLI.

## Overview

**Good news:** Gemini CLI has a hooks system that is very similar to Claude Code's, making integration feasible with moderate effort. Both use shell commands triggered at lifecycle events, receiving JSON context via stdin.

## Complete Hook Events Comparison

### Claude Code Hooks (11 events)

| Hook | When it Fires | Matchers | Can Block | Relevant for Sync |
|------|---------------|----------|-----------|-------------------|
| **SessionStart** | Session starts or resumes | `startup`, `resume`, `clear`, `compact` | No | ✅ Yes |
| **SessionEnd** | Session terminates | No | No | ✅ Yes |
| **UserPromptSubmit** | User submits a prompt | No | Yes | ✅ Yes |
| **PreToolUse** | Before tool execution | Tool names | Yes | ⚠️ Optional |
| **PostToolUse** | After tool completes successfully | Tool names | Yes | ✅ Yes |
| **PermissionRequest** | Permission dialog shown | Tool names | Yes | ⚠️ Optional |
| **Stop** | Main agent finishes responding | No | Yes | ✅ Yes |
| **SubagentStop** | Subagent (Task tool) finishes | No | Yes | ⚠️ Optional |
| **PreCompact** | Before context compaction | `manual`, `auto` | No | ✅ Yes |
| **Setup** | `--init`, `--init-only`, `--maintenance` | `init`, `maintenance` | No | ❌ No |
| **Notification** | System notifications | Notification types | No | ⚠️ Optional |

### Gemini CLI Hooks (11 events)

| Hook | When it Fires | Relevant for Sync |
|------|---------------|-------------------|
| **SessionStart** | Session begins | ✅ Yes |
| **SessionEnd** | Session terminates | ✅ Yes |
| **BeforeAgent** | Before agent loop starts | ⚠️ Optional |
| **AfterAgent** | After agent loop completes | ✅ Yes |
| **BeforeTool** | Before tool execution | ⚠️ Optional |
| **AfterTool** | After tool execution | ✅ Yes |
| **BeforeModel** | Before LLM request sent | ❌ No |
| **AfterModel** | After LLM response received | ⚠️ Optional |
| **BeforeToolSelection** | Before tool selection | ❌ No |
| **Notification** | Errors, warnings, info events | ⚠️ Optional |
| **PreCompress** | Before context compression | ✅ Yes |

### Hook Event Mapping

| LLM Whiteboard Event | Claude Code | Gemini CLI |
|---------------------|-------------|------------|
| `session_start` | `SessionStart` | `SessionStart` |
| `session_end` | `SessionEnd` | `SessionEnd` |
| `user_prompt` | `UserPromptSubmit` | N/A (use `BeforeAgent`) |
| `tool_use` | `PostToolUse` | `AfterTool` |
| `agent_stop` | `Stop` | `AfterAgent` |
| `subagent_stop` | `SubagentStop` | N/A |
| `context_compaction` | `PreCompact` | `PreCompress` |
| `permission_request` | `PermissionRequest` | N/A |
| `notification` | `Notification` | `Notification` |

## stdin JSON Schema Comparison

### Session Events

**Claude Code `SessionStart`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../session.jsonl",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup|resume|clear|compact"
}
```

**Gemini CLI `SessionStart`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.gemini/tmp/<hash>/chats/<id>.json",
  "cwd": "/path/to/project",
  "hook_event_name": "SessionStart",
  "timestamp": "2025-12-01T10:30:00Z"
}
```

**Claude Code `SessionEnd`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "clear|logout|prompt_input_exit|other"
}
```

**Gemini CLI `SessionEnd`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "SessionEnd",
  "timestamp": "2025-12-01T10:30:00Z",
  "reason": "exit|clear|logout|prompt_input_exit|other"
}
```

### Tool Events

**Claude Code `PostToolUse`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "ls -la" },
  "tool_response": { "stdout": "...", "exitCode": 0 },
  "tool_use_id": "toolu_123"
}
```

**Gemini CLI `AfterTool`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "AfterTool",
  "timestamp": "2025-12-01T10:30:00Z",
  "tool_name": "run_shell_command",
  "tool_input": { "command": "ls -la" },
  "tool_response": "..."
}
```

### Agent Stop Events

**Claude Code `Stop`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

**Gemini CLI `AfterAgent`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "AfterAgent",
  "timestamp": "2025-12-01T10:30:00Z",
  "prompt": "original user prompt",
  "prompt_response": "agent's response"
}
```

### Context Compaction Events

**Claude Code `PreCompact`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "permission_mode": "default",
  "hook_event_name": "PreCompact",
  "trigger": "manual|auto",
  "custom_instructions": "..."
}
```

**Gemini CLI `PreCompress`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "PreCompress",
  "timestamp": "2025-12-01T10:30:00Z",
  "trigger": "manual|auto"
}
```

### User Prompt Events

**Claude Code `UserPromptSubmit`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "user's message"
}
```

**Gemini CLI `BeforeAgent`:**
```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "BeforeAgent",
  "timestamp": "2025-12-01T10:30:00Z",
  "prompt": "user's message"
}
```

## Session Storage Comparison

| Aspect | Claude Code | Gemini CLI |
|--------|-------------|------------|
| **Settings Location** | `~/.claude/settings.json` | `~/.gemini/settings.json` |
| **Project Settings** | `.claude/settings.local.json` | `.gemini/settings.json` |
| **Transcript Location** | `~/.claude/projects/<path-hash>/<session-id>.jsonl` | `~/.gemini/tmp/<project-hash>/chats/<session-id>.json` |
| **Session ID Format** | UUID | UUID |
| **Resume Command** | `claude --continue <id>` | `gemini --resume <id>` |
| **List Sessions** | N/A | `gemini --list-sessions` |

## Implementation Plan

### Phase 1: Normalized Event Types

Create a unified event type system that maps both CLI hooks to a common format.

**New file: `cli/src/lib/events.ts`**
```typescript
export type NormalizedEventType =
  | 'session_start'
  | 'session_end'
  | 'user_prompt'
  | 'tool_use'
  | 'tool_use_start'      // PreToolUse/BeforeTool
  | 'agent_stop'
  | 'subagent_stop'
  | 'context_compaction'
  | 'permission_request'
  | 'notification'
  | 'model_request'       // Gemini only
  | 'model_response';     // Gemini only

export interface NormalizedEvent {
  type: NormalizedEventType;
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  timestamp: string;

  // Tool events
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResponse?: unknown;

  // Prompt events
  prompt?: string;
  promptResponse?: string;

  // Session events
  sessionReason?: string;  // Why session started/ended

  // Compaction events
  compactionTrigger?: 'manual' | 'auto';

  // Notification events
  notificationType?: string;
  message?: string;

  // Raw data for debugging
  rawEvent: Record<string, unknown>;
  cliType: 'claude-code' | 'gemini-cli';
}
```

### Phase 2: CLI Adapter Interface

**New file: `cli/src/lib/cli-adapter.ts`**
```typescript
export interface CliAdapter {
  name: 'claude-code' | 'gemini-cli';
  displayName: string;

  // Detection
  isInstalled(): Promise<boolean>;
  getVersion(): Promise<string | null>;

  // Paths
  getSettingsPath(scope: 'user' | 'project'): string;
  getTranscriptPath(projectPath: string, sessionId: string): string;

  // Hook configuration
  getHookConfig(hookCommand: string): HookConfiguration;
  getSupportedHooks(): string[];

  // Resume
  getResumeCommand(sessionId: string, projectPath?: string): string;
  getListSessionsCommand(): string | null;

  // Parse hook stdin
  parseHookContext(stdin: string): NormalizedEvent;
}

export interface HookConfiguration {
  // The full settings object to merge into settings.json
  settings: Record<string, unknown>;
  // Hooks that need experimental flags enabled
  experimentalFlags?: string[];
}
```

### Phase 3: Claude Code Adapter

**New file: `cli/src/lib/adapters/claude-code.ts`**
```typescript
import { CliAdapter, HookConfiguration, NormalizedEvent, NormalizedEventType } from '../cli-adapter';
import os from 'os';
import path from 'path';

export class ClaudeCodeAdapter implements CliAdapter {
  name = 'claude-code' as const;
  displayName = 'Claude Code';

  async isInstalled(): Promise<boolean> {
    return fs.existsSync(path.join(os.homedir(), '.claude'));
  }

  getSettingsPath(scope: 'user' | 'project'): string {
    if (scope === 'user') {
      return path.join(os.homedir(), '.claude', 'settings.json');
    }
    return path.join(process.cwd(), '.claude', 'settings.local.json');
  }

  getTranscriptPath(projectPath: string, sessionId: string): string {
    const sanitized = sanitizePath(projectPath);
    return path.join(os.homedir(), '.claude', 'projects', sanitized, `${sessionId}.jsonl`);
  }

  getSupportedHooks(): string[] {
    return [
      'SessionStart',
      'SessionEnd',
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'PermissionRequest',
      'Stop',
      'SubagentStop',
      'PreCompact',
      'Notification'
    ];
  }

  getHookConfig(hookCommand: string): HookConfiguration {
    const hookEntry = {
      type: 'command',
      command: hookCommand
    };

    return {
      settings: {
        hooks: {
          SessionStart: [{ hooks: [hookEntry] }],
          SessionEnd: [{ hooks: [hookEntry] }],
          UserPromptSubmit: [{ hooks: [hookEntry] }],
          PostToolUse: [{ hooks: [hookEntry] }],
          Stop: [{ hooks: [hookEntry] }],
          SubagentStop: [{ hooks: [hookEntry] }],
          PreCompact: [{ hooks: [hookEntry] }],
          // Optional hooks (can be enabled by user)
          // PreToolUse: [{ hooks: [hookEntry] }],
          // PermissionRequest: [{ hooks: [hookEntry] }],
          // Notification: [{ hooks: [hookEntry] }],
        }
      }
    };
  }

  getResumeCommand(sessionId: string, projectPath?: string): string {
    if (projectPath) {
      return `claude --continue ${sessionId} --directory "${projectPath}"`;
    }
    return `claude --continue ${sessionId}`;
  }

  getListSessionsCommand(): string | null {
    return null; // Claude Code doesn't have a list sessions command
  }

  parseHookContext(stdin: string): NormalizedEvent {
    const raw = JSON.parse(stdin);
    const eventType = this.mapEventType(raw.hook_event_name);

    return {
      type: eventType,
      sessionId: raw.session_id,
      transcriptPath: raw.transcript_path,
      cwd: raw.cwd || process.cwd(),
      timestamp: new Date().toISOString(),
      toolName: raw.tool_name,
      toolInput: raw.tool_input,
      toolResponse: raw.tool_response,
      prompt: raw.prompt,
      sessionReason: raw.reason || raw.source,
      compactionTrigger: raw.trigger,
      notificationType: raw.notification_type,
      message: raw.message,
      rawEvent: raw,
      cliType: 'claude-code'
    };
  }

  private mapEventType(hookName: string): NormalizedEventType {
    const mapping: Record<string, NormalizedEventType> = {
      'SessionStart': 'session_start',
      'SessionEnd': 'session_end',
      'UserPromptSubmit': 'user_prompt',
      'PreToolUse': 'tool_use_start',
      'PostToolUse': 'tool_use',
      'PermissionRequest': 'permission_request',
      'Stop': 'agent_stop',
      'SubagentStop': 'subagent_stop',
      'PreCompact': 'context_compaction',
      'Notification': 'notification'
    };
    return mapping[hookName] || 'notification';
  }
}
```

### Phase 4: Gemini CLI Adapter

**New file: `cli/src/lib/adapters/gemini-cli.ts`**
```typescript
import { CliAdapter, HookConfiguration, NormalizedEvent, NormalizedEventType } from '../cli-adapter';
import os from 'os';
import path from 'path';

export class GeminiCliAdapter implements CliAdapter {
  name = 'gemini-cli' as const;
  displayName = 'Gemini CLI';

  async isInstalled(): Promise<boolean> {
    return fs.existsSync(path.join(os.homedir(), '.gemini'));
  }

  getSettingsPath(scope: 'user' | 'project'): string {
    if (scope === 'user') {
      return path.join(os.homedir(), '.gemini', 'settings.json');
    }
    return path.join(process.cwd(), '.gemini', 'settings.json');
  }

  getTranscriptPath(projectPath: string, sessionId: string): string {
    const hash = hashProjectPath(projectPath);
    return path.join(os.homedir(), '.gemini', 'tmp', hash, 'chats', `${sessionId}.json`);
  }

  getSupportedHooks(): string[] {
    return [
      'SessionStart',
      'SessionEnd',
      'BeforeAgent',
      'AfterAgent',
      'BeforeTool',
      'AfterTool',
      'BeforeModel',
      'AfterModel',
      'BeforeToolSelection',
      'Notification',
      'PreCompress'
    ];
  }

  getHookConfig(hookCommand: string): HookConfiguration {
    const hookEntry = {
      type: 'command',
      command: hookCommand
    };

    return {
      settings: {
        // Required experimental flags for Gemini CLI hooks
        hooks: {
          enabled: true
        },
        tools: {
          enableHooks: true
        },
        // Hook definitions
        hooks: {
          SessionStart: [{ hooks: [hookEntry] }],
          SessionEnd: [{ hooks: [hookEntry] }],
          BeforeAgent: [{ hooks: [hookEntry] }],
          AfterAgent: [{ hooks: [hookEntry] }],
          AfterTool: [{ hooks: [hookEntry] }],
          PreCompress: [{ hooks: [hookEntry] }],
          // Optional hooks
          // BeforeTool: [{ hooks: [hookEntry] }],
          // AfterModel: [{ hooks: [hookEntry] }],
          // Notification: [{ hooks: [hookEntry] }],
        }
      },
      experimentalFlags: ['hooks.enabled', 'tools.enableHooks']
    };
  }

  getResumeCommand(sessionId: string, projectPath?: string): string {
    return `gemini --resume ${sessionId}`;
  }

  getListSessionsCommand(): string {
    return 'gemini --list-sessions';
  }

  parseHookContext(stdin: string): NormalizedEvent {
    const raw = JSON.parse(stdin);
    const eventType = this.mapEventType(raw.hook_event_name);

    return {
      type: eventType,
      sessionId: raw.session_id,
      transcriptPath: raw.transcript_path,
      cwd: raw.cwd || process.cwd(),
      timestamp: raw.timestamp || new Date().toISOString(),
      toolName: raw.tool_name,
      toolInput: raw.tool_input,
      toolResponse: raw.tool_response,
      prompt: raw.prompt,
      promptResponse: raw.prompt_response,
      sessionReason: raw.reason,
      compactionTrigger: raw.trigger,
      notificationType: raw.notification_type,
      message: raw.message,
      rawEvent: raw,
      cliType: 'gemini-cli'
    };
  }

  private mapEventType(hookName: string): NormalizedEventType {
    const mapping: Record<string, NormalizedEventType> = {
      'SessionStart': 'session_start',
      'SessionEnd': 'session_end',
      'BeforeAgent': 'user_prompt',
      'AfterAgent': 'agent_stop',
      'BeforeTool': 'tool_use_start',
      'AfterTool': 'tool_use',
      'BeforeModel': 'model_request',
      'AfterModel': 'model_response',
      'PreCompress': 'context_compaction',
      'Notification': 'notification'
    };
    return mapping[hookName] || 'notification';
  }
}
```

### Phase 5: Update Hook Command

**Modify: `cli/src/commands/hook.ts`**

```typescript
import { getAdapter } from '../lib/adapters';

export const hookCommand = new Command('hook')
  .description('Process hook events from LLM CLIs')
  .option('--cli <type>', 'CLI type (claude-code or gemini-cli)', 'claude-code')
  .action(async (options) => {
    const stdinData = await readStdin();
    const adapter = getAdapter(options.cli);

    // Parse using the appropriate adapter
    const event = adapter.parseHookContext(stdinData);

    // Build sync payload
    const payload = {
      localSessionId: event.sessionId,
      projectPath: event.cwd,
      machineId: config.machineId,
      cliType: adapter.name,
      suggestedTitle: await extractTitle(event),
      event: {
        type: event.type,
        toolName: event.toolName,
        summary: buildSummary(event),
        metadata: {
          toolInput: event.toolInput,
          toolResponse: event.toolResponse,
          prompt: event.prompt,
          trigger: event.compactionTrigger,
          reason: event.sessionReason
        }
      },
      timestamp: event.timestamp
    };

    // Send to API
    await syncEvent(payload);

    // Upload transcript on session end
    if (event.type === 'session_end') {
      await uploadTranscript(event.sessionId, event.transcriptPath);
    }
  });
```

### Phase 6: Update Init Command

**Modify: `cli/src/commands/init.ts`**

```typescript
import { detectInstalledClis, getAdapter } from '../lib/adapters';

// In the init flow:
const installedClis = await detectInstalledClis();

if (installedClis.length === 0) {
  console.log(chalk.yellow('No supported CLI tools detected.'));
  console.log('Please install one of the following:');
  console.log('  - Claude Code: https://claude.com/code');
  console.log('  - Gemini CLI: https://github.com/google-gemini/gemini-cli');
  return;
}

let selectedClis = installedClis;
if (installedClis.length > 1) {
  const { clis } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'clis',
    message: 'Which CLI tools do you want to integrate?',
    choices: installedClis.map(cli => {
      const adapter = getAdapter(cli);
      return {
        name: adapter.displayName,
        value: cli,
        checked: true
      };
    })
  }]);
  selectedClis = clis;
}

// Install hooks for each selected CLI
for (const cliType of selectedClis) {
  const adapter = getAdapter(cliType);
  const hookCommand = `npx llmwhiteboard hook --cli ${cliType}`;

  console.log(chalk.blue(`Installing hooks for ${adapter.displayName}...`));

  // Check for experimental flags (Gemini)
  const hookConfig = adapter.getHookConfig(hookCommand);
  if (hookConfig.experimentalFlags?.length) {
    console.log(chalk.yellow(`Note: ${adapter.displayName} hooks are experimental.`));
    console.log(chalk.yellow(`Enabling: ${hookConfig.experimentalFlags.join(', ')}`));
  }

  await installHooks(adapter, scope, hookConfig);
  console.log(chalk.green(`✓ ${adapter.displayName} hooks installed`));
}

// Update config
await saveConfig({
  ...config,
  integrations: {
    'claude-code': {
      enabled: selectedClis.includes('claude-code'),
      hooksInstalled: selectedClis.includes('claude-code')
    },
    'gemini-cli': {
      enabled: selectedClis.includes('gemini-cli'),
      hooksInstalled: selectedClis.includes('gemini-cli')
    }
  }
});
```

### Phase 7: Update Resume Command

**Modify: `cli/src/commands/resume.ts`**

```typescript
// After downloading session from API:
const session = await fetchSession(sessionId);
const adapter = getAdapter(session.cliType);

// Restore transcript to CLI-specific location
const transcriptPath = adapter.getTranscriptPath(session.projectPath, session.localSessionId);
await ensureDir(path.dirname(transcriptPath));
await writeFile(transcriptPath, decryptedContent);

// Show resume command
console.log(chalk.green('✓ Session restored'));
console.log();
console.log('Resume with:');
console.log(chalk.cyan(`  ${adapter.getResumeCommand(session.localSessionId, session.projectPath)}`));
```

### Phase 8: Backend Changes

**Modify: `backend/LlmWhiteboard.Api/Models/Session.cs`**
```csharp
public class Session
{
    // ... existing fields ...

    /// <summary>
    /// The CLI tool that created this session (claude-code, gemini-cli)
    /// </summary>
    public string CliType { get; set; } = "claude-code";
}
```

**Modify: `backend/LlmWhiteboard.Api/DTOs/SyncRequest.cs`**
```csharp
public class SyncRequest
{
    // ... existing fields ...

    public string? CliType { get; set; }
}
```

**Modify: `backend/LlmWhiteboard.Api/Controllers/SyncController.cs`**
```csharp
// In the sync endpoint:
session.CliType = request.CliType ?? "claude-code";
```

### Phase 9: Frontend Changes

**Session card badge:**
```tsx
// components/SessionCard.tsx
<Badge variant={session.cliType === 'claude-code' ? 'default' : 'secondary'}>
  {session.cliType === 'claude-code' ? 'Claude' : 'Gemini'}
</Badge>
```

**Filter dropdown:**
```tsx
// components/SessionFilters.tsx
<Select value={cliFilter} onValueChange={setCliFilter}>
  <SelectItem value="all">All CLIs</SelectItem>
  <SelectItem value="claude-code">Claude Code</SelectItem>
  <SelectItem value="gemini-cli">Gemini CLI</SelectItem>
</Select>
```

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `cli/src/lib/events.ts` | New | Normalized event types |
| `cli/src/lib/cli-adapter.ts` | New | Adapter interface |
| `cli/src/lib/adapters/index.ts` | New | Adapter factory |
| `cli/src/lib/adapters/claude-code.ts` | New | Claude Code adapter |
| `cli/src/lib/adapters/gemini-cli.ts` | New | Gemini CLI adapter |
| `cli/src/lib/hooks.ts` | Modify | Use adapters for hook installation |
| `cli/src/lib/config.ts` | Modify | Add integrations to config schema |
| `cli/src/commands/init.ts` | Modify | Multi-CLI detection and selection |
| `cli/src/commands/hook.ts` | Modify | Add `--cli` flag, use adapters |
| `cli/src/commands/resume.ts` | Modify | CLI-specific restore paths and commands |
| `cli/src/commands/logout.ts` | Modify | Remove hooks from all integrated CLIs |
| `cli/src/commands/status.ts` | Modify | Show which CLIs are integrated |
| `backend/.../Models/Session.cs` | Modify | Add CliType field |
| `backend/.../DTOs/SyncRequest.cs` | Modify | Add CliType to payload |
| `backend/.../Controllers/SyncController.cs` | Modify | Store CliType |
| `frontend/.../SessionCard.tsx` | Modify | Show CLI type badge |
| `frontend/.../SessionFilters.tsx` | Modify | Add CLI type filter |

## Hooks Enabled by Default

### Claude Code (7 hooks)
1. **SessionStart** - Track session begins
2. **SessionEnd** - Track session ends + upload transcript
3. **UserPromptSubmit** - Track user prompts
4. **PostToolUse** - Track tool usage
5. **Stop** - Track agent completions
6. **SubagentStop** - Track subagent completions
7. **PreCompact** - Track context compaction

### Gemini CLI (6 hooks)
1. **SessionStart** - Track session begins
2. **SessionEnd** - Track session ends + upload transcript
3. **BeforeAgent** - Track user prompts
4. **AfterAgent** - Track agent completions
5. **AfterTool** - Track tool usage
6. **PreCompress** - Track context compression

### Optional Hooks (user-enabled)
- **PreToolUse** / **BeforeTool** - Track tool invocations before execution
- **PermissionRequest** (Claude only) - Track permission dialogs
- **Notification** - Track system notifications
- **AfterModel** (Gemini only) - Track model responses

## Known Limitations

### 1. Gemini CLI Hooks are Experimental
Requires explicit opt-in via settings. The init command handles this automatically.

### 2. Different Transcript Formats
Claude Code uses JSONL, Gemini uses JSON. Cross-CLI resume (resuming a Claude session in Gemini) is not supported in initial implementation.

### 3. Hook Event Gaps
- Gemini has no equivalent to `SubagentStop`
- Claude has no equivalent to `BeforeModel`/`AfterModel`
- Some events have different data available

### 4. Session ID Collision
Both CLIs use UUIDs, but IDs are only unique within a CLI. The backend uses `(userId, machineId, cliType, localSessionId)` as the unique key.

## References

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Hook Configuration Guide](https://claude.com/blog/how-to-configure-hooks)
- [Gemini CLI Hooks Documentation](https://geminicli.com/docs/hooks/)
- [Gemini CLI Hooks Reference](https://geminicli.com/docs/hooks/reference/)
- [Gemini CLI Configuration](https://geminicli.com/docs/get-started/configuration/)
- [Gemini CLI Session Management](https://geminicli.com/docs/cli/session-management/)
- [Gemini CLI GitHub Repository](https://github.com/google-gemini/gemini-cli)
