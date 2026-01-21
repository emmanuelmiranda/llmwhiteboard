# Gemini CLI Support

This document describes the Gemini CLI integration in LLM Whiteboard, including comprehensive support for all lifecycle hooks in both Claude Code and Gemini CLI.

## Status: Implemented

The CLI now supports both Claude Code and Gemini CLI through an adapter-based architecture. Users can integrate with either or both tools during setup.

## Overview

Gemini CLI has a hooks system that is very similar to Claude Code's, making the integration straightforward. Both use shell commands triggered at lifecycle events, receiving JSON context via stdin.

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

## Implementation

The implementation uses an adapter pattern to support multiple CLI tools. Key files:

| File | Description |
|------|-------------|
| `cli/src/lib/cli-adapter.ts` | Adapter interface and types |
| `cli/src/lib/adapters/claude-code.ts` | Claude Code adapter |
| `cli/src/lib/adapters/gemini-cli.ts` | Gemini CLI adapter |
| `cli/src/lib/adapters/index.ts` | Adapter factory |
| `cli/src/lib/hooks.ts` | Hook installation using adapters |
| `cli/src/commands/hook.ts` | Hook command with `--cli` flag |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Commands                          │
│   init, hook, resume, status, logout                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        hooks.ts                              │
│   installHooksForCli(), uninstallHooksForCli(),             │
│   detectInstalledClis(), getHooksStatus()                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLI Adapter Interface                    │
│   isInstalled(), getSettingsPath(), getTranscriptPath(),    │
│   getHookConfig(), parseHookContext(), getResumeCommand()   │
└─────────────────────────────────────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   ClaudeCodeAdapter     │   │   GeminiCliAdapter      │
│   ~/.claude/            │   │   ~/.gemini/            │
│   settings.json         │   │   settings.json         │
└─────────────────────────┘   └─────────────────────────┘
```

### Key Features

1. **Auto-detection**: The `init` command automatically detects which CLI tools are installed
2. **Multi-CLI support**: Users can integrate with both Claude Code and Gemini CLI simultaneously
3. **Normalized events**: Both CLIs' hook events are normalized to a common format
4. **CLI-specific resume**: The `resume` command restores transcripts to the correct location for each CLI
5. **Experimental flag handling**: Gemini CLI's experimental hooks are automatically enabled

### Default Hooks by CLI

**Claude Code (6 hooks):**
- SessionStart, SessionEnd, UserPromptSubmit, PostToolUse, Stop, PreCompact

**Gemini CLI (6 hooks):**
- SessionStart, SessionEnd, BeforeAgent, AfterAgent, AfterTool, PreCompress

### Usage

```bash
# Initialize with auto-detection
npx llmwhiteboard init

# Initialize for specific CLI only
npx llmwhiteboard init --cli gemini-cli

# Reinstall hooks for all detected CLIs
npx llmwhiteboard init --hooks-only

# Check status
npx llmwhiteboard status
```

## Files Changed

### CLI (Implemented)

| File | Change Type | Description |
|------|-------------|-------------|
| `cli/src/lib/cli-adapter.ts` | New | Adapter interface and types |
| `cli/src/lib/adapters/index.ts` | New | Adapter factory and detection |
| `cli/src/lib/adapters/claude-code.ts` | New | Claude Code adapter |
| `cli/src/lib/adapters/gemini-cli.ts` | New | Gemini CLI adapter |
| `cli/src/lib/hooks.ts` | Modified | Use adapters, multi-CLI support |
| `cli/src/lib/api.ts` | Modified | Added cliType to Session and Transcript types |
| `cli/src/commands/init.ts` | Modified | Multi-CLI detection and selection |
| `cli/src/commands/hook.ts` | Modified | Add `--cli` flag, use adapters |
| `cli/src/commands/resume.ts` | Modified | CLI-specific restore paths and commands |
| `cli/src/commands/logout.ts` | Modified | Remove hooks from all integrated CLIs |
| `cli/src/commands/status.ts` | Modified | Show status for all CLIs |
| `cli/src/index.ts` | Modified | Updated descriptions and hook command |

### Backend (TODO)

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/.../Models/Session.cs` | Modify | Add CliType field |
| `backend/.../DTOs/SyncRequest.cs` | Modify | Add CliType to payload |
| `backend/.../Controllers/SyncController.cs` | Modify | Store CliType |

### Frontend (TODO)

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/.../SessionCard.tsx` | Modify | Show CLI type badge |
| `frontend/.../SessionFilters.tsx` | Modify | Add CLI type filter |

## Hooks Enabled by Default

### Claude Code (6 hooks)
1. **SessionStart** - Track session begins
2. **SessionEnd** - Track session ends + upload transcript
3. **UserPromptSubmit** - Track user prompts
4. **PostToolUse** - Track tool usage (with matcher `*`)
5. **Stop** - Track agent completions
6. **PreCompact** - Track context compaction

### Gemini CLI (6 hooks)
1. **SessionStart** - Track session begins
2. **SessionEnd** - Track session ends + upload transcript
3. **BeforeAgent** - Track user prompts
4. **AfterAgent** - Track agent completions
5. **AfterTool** - Track tool usage
6. **PreCompress** - Track context compression

### Optional Hooks (can be enabled manually)
- **SubagentStop** (Claude only) - Track subagent completions
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
