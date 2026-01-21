-- V2: Add TranscriptSnapshots table for time-travel resume support

CREATE TABLE IF NOT EXISTS "TranscriptSnapshots" (
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

CREATE INDEX IF NOT EXISTS "IX_TranscriptSnapshots_SessionId_CompactionCycle_Type"
    ON "TranscriptSnapshots" ("SessionId", "CompactionCycle", "Type");

CREATE INDEX IF NOT EXISTS "IX_TranscriptSnapshots_SessionId_CreatedAt"
    ON "TranscriptSnapshots" ("SessionId", "CreatedAt");

COMMENT ON TABLE "TranscriptSnapshots" IS 'Stores transcript snapshots at key points for time-travel resume';
COMMENT ON COLUMN "TranscriptSnapshots"."Type" IS 'PostCompaction, Checkpoint, Delta, or Periodic';
COMMENT ON COLUMN "TranscriptSnapshots"."CompactionCycle" IS 'Which compaction cycle this snapshot belongs to (0 = before first compaction)';
COMMENT ON COLUMN "TranscriptSnapshots"."ContextPercentage" IS 'Approximate context usage when snapshot was taken (0=post-compaction, ~80=checkpoint, 100=delta)';
