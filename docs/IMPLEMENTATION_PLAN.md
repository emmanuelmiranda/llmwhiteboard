# LLM Whiteboard - Implementation Plan

> "Stop losing track of your LLM sessions. Visualize, resume, and share your AI-assisted work."

## Overview

A web-based dashboard for visualizing, managing, and resuming Claude Code (and other LLM) sessions across machines. Users sync their local sessions to the cloud via hooks, then view and manage them through a visual interface.

## Business Model

**Open Core:**
- Free: Self-hosted, single user
- Paid: Hosted version, team features, shared visualizations

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | Next.js 14 (App Router) | SSR, API routes, good DX |
| Language | TypeScript | Type safety |
| Database | PostgreSQL | JSONB for flexible session data |
| ORM | Prisma | Migrations, type-safe queries |
| Auth | NextAuth.js | Self-hosted friendly, multiple providers |
| Styling | Tailwind + shadcn/ui | Fast to build, consistent UI |
| Deployment | Docker Compose | Self-hosted: Postgres + Next.js |
| LLM Summaries | Claude API (optional) | Auto-generate session descriptions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Local Machine                                              │
│  ┌─────────────┐   hooks    ┌──────────────────────┐       │
│  │ Claude Code │ ─────────► │ sync script (curl)   │───────┼──► POST /api/sync
│  │   Session   │            └──────────────────────┘       │
│  └─────────────┘                                           │
│         │                                                   │
│  ~/.llmwhiteboard/                                         │
│  ├── config.json   (token, api url)                        │
│  └── machine-id                                            │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│  llmwhiteboard.com (or self-hosted)                        │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   REST API   │  │  PostgreSQL │  │   Web Dashboard  │   │
│  │  /api/sync   │──│             │──│  - Session cards │   │
│  │  /api/auth   │  │  Sessions   │  │  - Timeline view │   │
│  └──────────────┘  │  Events     │  │  - Whiteboard    │   │
│                    │  Users      │  │  - Search/filter │   │
│                    │  ApiTokens  │  └──────────────────┘   │
│                    └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Models

```prisma
model User {
  id            String     @id @default(cuid())
  email         String     @unique
  name          String?
  image         String?
  sessions      Session[]
  apiTokens     ApiToken[]
  machines      Machine[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

model ApiToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String    // "MacBook Pro", "Work Desktop"
  tokenHash   String    @unique // hashed, never store plain
  tokenPrefix String    // "lwb_sk_abc..." first 8 chars for display
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?
}

model Machine {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  machineId   String    // UUID generated on client
  name        String?   // User-friendly name
  lastSeenAt  DateTime?
  sessions    Session[]
  createdAt   DateTime  @default(now())

  @@unique([userId, machineId])
}

model Session {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  machineId       String?
  machine         Machine?  @relation(fields: [machineId], references: [id])

  // Claude Code session info
  localSessionId  String    // Claude's session ID
  projectPath     String    // Working directory

  // User-facing
  title           String?   // User-set or auto-generated
  description     String?   // Summary of what this session is about
  status          SessionStatus @default(ACTIVE)
  tags            String[]  // User-defined tags

  // Metadata
  lastActivityAt  DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  events          SessionEvent[]
  transcript      SessionTranscript?

  @@unique([userId, machineId, localSessionId])
}

enum SessionStatus {
  ACTIVE      // Currently being used
  PAUSED      // User paused/closed terminal
  COMPLETED   // User marked as done
  ARCHIVED    // Hidden from main view
}

model SessionEvent {
  id          String    @id @default(cuid())
  sessionId   String
  session     Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  eventType   String    // "tool_use", "user_message", "assistant_message", "stop"
  toolName    String?   // For tool_use events
  summary     String?   // Brief description of what happened
  metadata    Json?     // Additional event data

  createdAt   DateTime  @default(now())

  @@index([sessionId, createdAt])
}

model SessionTranscript {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  content         Bytes    // Full JSONL transcript (possibly encrypted)
  isEncrypted     Boolean  @default(false)
  checksum        String   // SHA-256 for verification
  sizeBytes       Int

  uploadedAt      DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## File Structure

```
llmwhiteboard/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Landing page (logged out) / Dashboard (logged in)
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Dashboard layout with sidebar
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx        # Session list/grid view
│   │   │   │   └── [id]/page.tsx   # Session detail
│   │   │   ├── timeline/page.tsx   # Timeline visualization
│   │   │   ├── whiteboard/page.tsx # Whiteboard/canvas view
│   │   │   └── settings/
│   │   │       ├── page.tsx        # General settings
│   │   │       ├── tokens/page.tsx # API token management
│   │   │       └── machines/page.tsx
│   │   │
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── sync/route.ts       # Webhook from Claude hooks
│   │       └── trpc/[trpc]/route.ts
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── SessionCard.tsx
│   │   ├── SessionList.tsx
│   │   ├── SessionDetail.tsx
│   │   ├── Timeline.tsx
│   │   ├── Whiteboard.tsx
│   │   ├── TokenGenerator.tsx
│   │   └── SetupInstructions.tsx
│   │
│   ├── lib/
│   │   ├── db.ts                   # Prisma client
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── api-tokens.ts           # Token generation/verification
│   │   ├── summarize.ts            # Claude API for summaries
│   │   └── utils.ts
│   │
│   ├── server/
│   │   ├── trpc.ts                 # tRPC setup
│   │   └── routers/
│   │       ├── session.ts
│   │       ├── token.ts
│   │       └── machine.ts
│   │
│   └── types/
│       └── index.ts
│
└── cli/                            # npx llmwhiteboard CLI
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts                # CLI entry point
        ├── commands/
        │   ├── init.ts             # Setup token & hooks
        │   ├── logout.ts
        │   ├── status.ts
        │   ├── resume.ts           # Download & restore session
        │   ├── list.ts             # List synced sessions
        │   └── rotate-key.ts       # Re-encrypt with new key
        └── lib/
            ├── config.ts           # Read/write ~/.llmwhiteboard/config.json
            ├── hooks.ts            # Install Claude Code hooks
            ├── crypto.ts           # AES-256-GCM encrypt/decrypt
            └── restore.ts          # Place transcript in ~/.claude/
```

---

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
1. Initialize Next.js project with TypeScript
2. Set up Tailwind + shadcn/ui
3. Configure Prisma with PostgreSQL
4. Create database schema and run migrations
5. Set up NextAuth with email/password (add OAuth later)
6. Create Docker Compose for local dev (postgres)

### Phase 2: Auth & Token System
1. Build login/signup pages
2. Implement API token generation
3. Create token management UI (list, create, revoke)
4. Build `/api/sync` endpoint with token verification
5. Add rate limiting

### Phase 3: Session Dashboard
1. Build session list/grid view with SessionCard component
2. Implement session detail page
3. Add session status management (active/paused/completed/archived)
4. Add tagging and filtering
5. Build search functionality

### Phase 4: CLI Tool & Sync
1. Create `npx llmwhiteboard` CLI package
2. Implement `init` command (token setup, hook installation)
3. Create sync script that hooks call
4. Implement full transcript upload on SessionEnd hook
5. Test end-to-end: Claude Code → hooks → API → dashboard

### Phase 5: Cross-Machine Resume
1. Add `resume` command to CLI
2. Implement transcript download & restore to `~/.claude/`
3. Add `list` command to show synced sessions
4. Add search functionality (`resume --search "query"`)
5. Test: sync from Machine A, resume on Machine B

### Phase 6: End-to-End Encryption
1. Implement AES-256-GCM encryption in CLI (`lib/crypto.ts`)
2. Add `--enable-encryption` flag to `init` command
3. Encrypt transcript before upload, decrypt on download
4. Add key generation and storage
5. Add `rotate-key` command
6. Update server to handle encrypted vs. unencrypted sessions

### Phase 7: Visualizations
1. Build timeline view (chronological session activity)
2. Build whiteboard/canvas view (drag sessions, group by project)
3. Add session event visualization

### Phase 8: Auto-Summaries
1. Integrate Claude API for session summarization
2. Auto-generate titles/descriptions from session content
3. Allow user override

### Phase 9: Polish & Deploy
1. Create landing page
2. Add Docker Compose for self-hosted deployment
3. Write setup documentation
4. Create README with screenshots

---

## API Endpoints

### Public (Token Auth - from CLI/hooks)
- `POST /api/sync` - Receive events from Claude Code hooks
- `POST /api/sync/transcript` - Upload full session transcript
- `GET /api/sync/transcript/:sessionId` - Download transcript for resume
- `GET /api/sync/sessions` - List sessions (for CLI `list` command)

### Authenticated (Session Auth - from web UI)
- `GET /api/trpc/session.list` - List user's sessions
- `GET /api/trpc/session.get` - Get session detail
- `GET /api/trpc/session.search` - Search sessions by query
- `PATCH /api/trpc/session.update` - Update title, status, tags
- `DELETE /api/trpc/session.delete` - Delete session
- `GET /api/trpc/token.list` - List API tokens
- `POST /api/trpc/token.create` - Generate new token
- `DELETE /api/trpc/token.revoke` - Revoke token

---

## Sync Payload (from Claude hooks)

```typescript
interface SyncPayload {
  localSessionId: string;
  projectPath: string;
  event: {
    type: 'session_start' | 'session_end' | 'tool_use' | 'message' | 'stop';
    toolName?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: string;
}
```

---

## Cross-Machine Resume

Full session state is synced to the server, enabling resume from any machine.

### How It Works

```
Machine A (original)                    Server                         Machine B (resume)
┌─────────────────┐                 ┌──────────────┐                ┌─────────────────┐
│ Claude session  │  SessionEnd     │              │                │                 │
│ creates JSONL   │ ─────────────►  │ Store full   │                │                 │
│                 │  hook uploads   │ transcript   │  CLI download  │ Place in        │
│ ~/.claude/      │  transcript     │ (encrypted)  │ ◄───────────── │ ~/.claude/      │
│ projects/x/     │                 │              │                │ projects/x/     │
└─────────────────┘                 └──────────────┘                └─────────────────┘
                                                                            │
                                                                            ▼
                                                                    claude --continue
```

### Resume Options

**Option 1: CLI Resume (recommended)**
```bash
# On Machine B
$ npx llmwhiteboard resume abc123

Downloading session from llmwhiteboard.com...
Decrypting with local key...
✓ Session restored to ~/.claude/projects/myproject/abc123/

Resume with:
  claude --continue abc123 --directory /path/to/myproject
```

**Option 2: Claude-Initiated Resume**
User tells Claude: "Resume my session about the auth bug from llmwhiteboard"
→ Claude runs `npx llmwhiteboard resume --search "auth bug"`
→ CLI downloads & restores transcript
→ User restarts with `claude --continue <id>`

Note: Claude can't restart itself mid-session, so this is a two-step process.

### Data Model Addition

```prisma
model SessionTranscript {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Encrypted content (if encryption enabled)
  content         Bytes    // Full JSONL transcript (possibly encrypted)
  isEncrypted     Boolean  @default(false)

  // Integrity
  checksum        String   // SHA-256 for verification
  sizeBytes       Int

  uploadedAt      DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### CLI Commands for Resume

```bash
npx llmwhiteboard resume <session-id>     # Download & restore specific session
npx llmwhiteboard resume --search "query" # Find & restore by search
npx llmwhiteboard resume --latest         # Restore most recent session
npx llmwhiteboard list                    # List all synced sessions
```

---

## End-to-End Encryption

Optional client-side encryption for enterprise/privacy-conscious users. Server only sees encrypted blobs.

### How It Works

```
┌──────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│  Local Machine   │         │     Server      │         │  Other Machine   │
│                  │         │                 │         │                  │
│ transcript.jsonl │         │ [encrypted      │         │ transcript.jsonl │
│        │         │ encrypt │  blob - server  │ decrypt │        ▲         │
│        ▼         │ ──────► │  cannot read]   │ ──────► │        │         │
│   AES-256-GCM    │         │                 │         │   AES-256-GCM    │
│   + user key     │         │ readable:       │         │   + user key     │
│                  │         │ - session_id    │         │                  │
└──────────────────┘         │ - timestamps    │         └──────────────────┘
                             │ - tags          │
                             │ - status        │
                             └─────────────────┘
```

### What's Encrypted vs. Readable

| Encrypted (server cannot read) | Readable (for dashboard/search) |
|--------------------------------|--------------------------------|
| Full transcript content | Session ID, timestamps |
| Tool arguments & results | Project path |
| User messages | User-set title & tags |
| Assistant responses | Status (active/paused/etc) |
| File contents | Machine info |

### Key Management

```bash
# Generate encryption key (stored locally, never uploaded)
$ npx llmwhiteboard init --enable-encryption

Generating encryption key...
✓ Key saved to ~/.llmwhiteboard/encryption.key

IMPORTANT: Back up this key! Without it, you cannot decrypt your sessions.
Key fingerprint: a1b2c3d4...
```

**Key storage:**
```
~/.llmwhiteboard/
├── config.json        # token, api url
├── machine-id
└── encryption.key     # AES-256 key (optional, user-generated)
```

### Config Addition

```typescript
// ~/.llmwhiteboard/config.json
{
  "token": "lwb_sk_...",
  "apiUrl": "https://llmwhiteboard.com",
  "encryption": {
    "enabled": true,
    "keyPath": "~/.llmwhiteboard/encryption.key"
  }
}
```

### Implementation Notes

- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: User can provide passphrase → PBKDF2 → key
- IV: Random per-upload, stored with ciphertext
- Key rotation: CLI command to re-encrypt all sessions with new key
- Lost key = lost data (by design, server cannot help)

---

## Simple Resume Flow (No Encryption)

For users who don't enable encryption:

1. User clicks "Resume" on a session in the dashboard
2. UI shows command: `npx llmwhiteboard resume <session-id>`
3. Or just copy: `claude --continue <session-id> --directory <path>`
4. Session status auto-updates to ACTIVE when next sync event arrives

---

## Verification / Testing

1. **Unit tests**: Prisma queries, token hashing, API validation
2. **Integration tests**: Full sync flow (mock hook → API → DB)
3. **E2E test**:
   - Start Claude Code session
   - Verify events appear in dashboard
   - Update session title
   - Resume session via CLI command
4. **Docker test**: `docker-compose up` works out of the box (Web: port 22000, DB: port 22432)

---

## Future Features (Post-MVP)

- [ ] OAuth providers (GitHub, Google)
- [ ] Team workspaces with shared sessions
- [ ] Public/shareable session visualizations
- [ ] Support for other LLM tools (Cursor, Aider, etc.)
- [ ] Browser extension for non-CLI LLM interfaces
- [ ] Session export (markdown, PDF)
- [ ] Webhooks for session events
- [ ] Mobile-friendly view
