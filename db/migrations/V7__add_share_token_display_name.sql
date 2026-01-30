-- V7: Add DisplayName column to ShareTokens for custom identity when sharing
-- Allows users to share sessions with a custom name instead of their account name

ALTER TABLE "ShareTokens" ADD COLUMN IF NOT EXISTS "DisplayName" text NULL;

COMMENT ON COLUMN "ShareTokens"."DisplayName" IS 'Optional custom display name shown to viewers instead of the user actual name';
