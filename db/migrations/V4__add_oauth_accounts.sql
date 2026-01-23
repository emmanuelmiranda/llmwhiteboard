-- V4: Add OAuthAccounts table for OAuth provider authentication (GitHub, etc.)

CREATE TABLE IF NOT EXISTS "OAuthAccounts" (
    "Id" text NOT NULL,
    "UserId" text NOT NULL,
    "Provider" text NOT NULL,
    "ProviderAccountId" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_OAuthAccounts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OAuthAccounts_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_OAuthAccounts_Provider_ProviderAccountId"
    ON "OAuthAccounts" ("Provider", "ProviderAccountId");

CREATE INDEX IF NOT EXISTS "IX_OAuthAccounts_UserId"
    ON "OAuthAccounts" ("UserId");

COMMENT ON TABLE "OAuthAccounts" IS 'Links OAuth provider accounts (GitHub, etc.) to users';
COMMENT ON COLUMN "OAuthAccounts"."Provider" IS 'OAuth provider name (e.g., github)';
COMMENT ON COLUMN "OAuthAccounts"."ProviderAccountId" IS 'User ID from the OAuth provider';
