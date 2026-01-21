-- Migration: Add CliType column to Sessions table
-- This column tracks which CLI tool created the session (claude-code, gemini-cli, etc.)

ALTER TABLE "Sessions" ADD COLUMN IF NOT EXISTS "CliType" VARCHAR(50) NOT NULL DEFAULT 'claude-code';
