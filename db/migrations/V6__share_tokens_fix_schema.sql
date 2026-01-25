-- V6: Ensure ShareTokens has correct schema (Token column instead of TokenHash/TokenPrefix)
-- This migration handles both cases:
-- 1. Table created with old schema (TokenHash/TokenPrefix) - migrates to new schema
-- 2. Table created with new schema (Token) - does nothing

-- Only run migration if TokenHash column exists (old schema)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ShareTokens' AND column_name = 'TokenHash'
    ) THEN
        -- Delete existing shares (tokens cannot be recovered from hashes)
        DELETE FROM "ShareTokens";

        -- Drop old indexes
        DROP INDEX IF EXISTS "IX_ShareTokens_TokenHash";
        DROP INDEX IF EXISTS "IX_ShareTokens_TokenPrefix";

        -- Drop old columns
        ALTER TABLE "ShareTokens" DROP COLUMN IF EXISTS "TokenHash";
        ALTER TABLE "ShareTokens" DROP COLUMN IF EXISTS "TokenPrefix";

        -- Add new Token column
        ALTER TABLE "ShareTokens" ADD COLUMN "Token" text NOT NULL DEFAULT '';
        ALTER TABLE "ShareTokens" ALTER COLUMN "Token" DROP DEFAULT;

        -- Create new index
        CREATE UNIQUE INDEX "IX_ShareTokens_Token" ON "ShareTokens" ("Token");

        RAISE NOTICE 'Migrated ShareTokens from old schema to new schema';
    ELSE
        RAISE NOTICE 'ShareTokens already has correct schema, skipping migration';
    END IF;
END $$;

COMMENT ON COLUMN "ShareTokens"."Token" IS 'The full share token for URL construction (stored plaintext)';
