-- V8: Add Teams and TeamMembers tables for team collaboration
-- Also adds IsPrivate column to Sessions for session privacy control

CREATE TABLE IF NOT EXISTS "Teams" (
    "Id" text NOT NULL,
    "Name" text NOT NULL,
    "Description" text,
    "OwnerId" text NOT NULL,
    "JoinCode" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Teams" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Teams_Users_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Teams_JoinCode" ON "Teams" ("JoinCode");
CREATE INDEX IF NOT EXISTS "IX_Teams_OwnerId" ON "Teams" ("OwnerId");

CREATE TABLE IF NOT EXISTS "TeamMembers" (
    "Id" text NOT NULL,
    "TeamId" text NOT NULL,
    "UserId" text NOT NULL,
    "Role" text NOT NULL,
    "JoinedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TeamMembers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TeamMembers_Teams_TeamId" FOREIGN KEY ("TeamId") REFERENCES "Teams" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_TeamMembers_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_TeamMembers_TeamId_UserId" ON "TeamMembers" ("TeamId", "UserId");
CREATE INDEX IF NOT EXISTS "IX_TeamMembers_UserId" ON "TeamMembers" ("UserId");
CREATE INDEX IF NOT EXISTS "IX_TeamMembers_TeamId" ON "TeamMembers" ("TeamId");

-- Add IsPrivate column to Sessions for session privacy in team views
ALTER TABLE "Sessions" ADD COLUMN IF NOT EXISTS "IsPrivate" boolean NOT NULL DEFAULT false;

COMMENT ON TABLE "Teams" IS 'Teams for collaborative session viewing';
COMMENT ON TABLE "TeamMembers" IS 'Join table for team membership';
COMMENT ON COLUMN "Teams"."JoinCode" IS 'Unique join code for team invitations (lwb_team_<random>)';
COMMENT ON COLUMN "TeamMembers"."Role" IS 'Member role: Owner or Member';
COMMENT ON COLUMN "Sessions"."IsPrivate" IS 'When true, session is hidden from all team views';
