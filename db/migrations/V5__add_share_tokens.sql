-- V5: Add ShareTokens table for session/feed sharing functionality

CREATE TABLE IF NOT EXISTS "ShareTokens" (
    "Id" text NOT NULL,
    "UserId" text NOT NULL,
    "SessionId" text,
    "Scope" text NOT NULL,
    "Visibility" text NOT NULL,
    "Token" text NOT NULL,
    "Name" text,
    "ExpiresAt" timestamp with time zone,
    "MaxViewers" integer,
    "RevokedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LastAccessedAt" timestamp with time zone,
    "AccessCount" integer NOT NULL DEFAULT 0,
    CONSTRAINT "PK_ShareTokens" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ShareTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ShareTokens_Sessions_SessionId" FOREIGN KEY ("SessionId") REFERENCES "Sessions" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_ShareTokens_Token" ON "ShareTokens" ("Token");
CREATE INDEX IF NOT EXISTS "IX_ShareTokens_UserId" ON "ShareTokens" ("UserId");
CREATE INDEX IF NOT EXISTS "IX_ShareTokens_SessionId" ON "ShareTokens" ("SessionId");

COMMENT ON TABLE "ShareTokens" IS 'Share tokens for public access to sessions or user feeds';
COMMENT ON COLUMN "ShareTokens"."Scope" IS 'Share scope: Session or UserFeed';
COMMENT ON COLUMN "ShareTokens"."Visibility" IS 'Visibility level: Full or ActivityOnly';
COMMENT ON COLUMN "ShareTokens"."Token" IS 'The full share token for URL construction';
