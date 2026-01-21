# LLM Whiteboard Changelog

## [Unreleased]

### CLI v0.1.7

#### New Features
- **Automatic transcript sync**: Transcripts now upload automatically on:
  - PreCompact (before context gets summarized)
  - Stop events (throttled to every 60 seconds)
  - SessionEnd (always)
- **Manual sync command**: `npx llmwhiteboard sync` to force upload current transcript
  - `--session <id>` - sync specific session
  - `--all` - sync all sessions in current directory

#### Bug Fixes
- Fixed machine name not being set: `getMachineId()` now reads from config.json first
- Removed deprecated `llmwhiteboard-hook` binary (use `npx llmwhiteboard hook` instead)

### Backend

#### New Features
- **Transcript Snapshots**: Time-travel resume support
  - `TranscriptSnapshot` model with types: PostCompaction, Checkpoint, Delta, Periodic
  - Automatic snapshot creation on compaction events
  - 80% checkpoint + 20% delta preserved per compaction cycle
  - Periodic snapshots cleaned up after compaction
- **GET /api/sessions/{id}/snapshots** - retrieve snapshots for a session

#### Bug Fixes
- Fixed event count always showing 0 in session list
- Fixed machine name not being set when creating new machines

#### Database Migration Required
```sql
-- Add TranscriptSnapshots table
CREATE TABLE "TranscriptSnapshots" (
    "Id" text NOT NULL,
    "SessionId" text NOT NULL,
    "CompactionCycle" integer NOT NULL,
    "Type" text NOT NULL,
    "Content" bytea NOT NULL,
    "IsEncrypted" boolean NOT NULL,
    "Checksum" text NOT NULL,
    "SizeBytes" integer NOT NULL,
    "ContextPercentage" integer,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TranscriptSnapshots" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TranscriptSnapshots_Sessions_SessionId" FOREIGN KEY ("SessionId") REFERENCES "Sessions" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_TranscriptSnapshots_SessionId_CompactionCycle_Type" ON "TranscriptSnapshots" ("SessionId", "CompactionCycle", "Type");
CREATE INDEX "IX_TranscriptSnapshots_SessionId_CreatedAt" ON "TranscriptSnapshots" ("SessionId", "CreatedAt");
```

---

## Backlog / Future Work

### High Priority
- [x] **Flyway migrations**: Set up Flyway for database migrations
  - Added flyway container to docker-compose
  - Created `db/migrations/` folder with versioned SQL files
  - Auto-runs on startup before backend
- [ ] **Timeline UI**: Rich conversation view from parsed transcript
  - Show user messages, assistant responses, tool uses
  - Visual compaction markers with snapshot links
  - Encrypted sessions: metadata only (timestamps, tool names)

### Medium Priority
- [ ] **Resume from snapshot**: Allow resuming from specific checkpoint
  - UI: Select snapshot from timeline
  - CLI: `npx llmwhiteboard resume <session-id> --snapshot <snapshot-id>`
- [ ] **Session branching**: Fork session from a snapshot point
- [ ] **Conflict detection**: Warn when same session active on multiple machines

### Low Priority
- [ ] Server-configurable sync interval (per session/plan)
- [ ] Snapshot retention policies (keep last N cycles)
- [ ] Export session to markdown/PDF
- [ ] Session sharing (public links)

---

## Version History

### v0.1.6
- Initial npm publish with working hooks
- Session sync, transcript upload on SessionEnd
- Cross-machine resume support

### v0.1.5
- Fixed transcript path calculation for Windows (backslash handling)

### v0.1.4
- Added PreCompact hook support for compaction tracking
- Changed from project-level to global hooks by default
