#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { resumeCommand } from "./commands/resume.js";
import { statusCommand } from "./commands/status.js";
import { logoutCommand } from "./commands/logout.js";
import { rotateKeyCommand } from "./commands/rotate-key.js";
import { hookCommand } from "./commands/hook.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

const program = new Command();

program
  .name("llmwhiteboard")
  .description("CLI tool for syncing Claude Code sessions to LLM Whiteboard")
  .version(packageJson.version);

program
  .command("init")
  .description("Initialize LLM Whiteboard and configure Claude Code hooks")
  .option("-t, --token <token>", "API token (or enter interactively)")
  .option("-u, --url <url>", "API URL (default: https://api.llmwhiteboard.com)")
  .option("-m, --machine-id <id>", "Machine ID (default: auto-generated)")
  .option("-e, --enable-encryption", "Enable end-to-end encryption")
  .option("-p, --project", "Install hooks for current project only (default: global)")
  .action(initCommand);

program
  .command("list")
  .description("List your synced sessions")
  .option("-s, --status <status>", "Filter by status (ACTIVE, PAUSED, COMPLETED, ARCHIVED)")
  .option("-l, --limit <number>", "Limit results", "20")
  .action(listCommand);

program
  .command("resume [sessionId]")
  .description("Download and restore a session for resuming")
  .option("-s, --search <query>", "Search for a session by query")
  .option("--latest", "Resume the most recent session")
  .action(resumeCommand);

program
  .command("status")
  .description("Show current configuration status")
  .action(statusCommand);

program
  .command("logout")
  .description("Remove configuration and uninstall hooks")
  .action(logoutCommand);

program
  .command("rotate-key")
  .description("Rotate encryption key (re-encrypts all sessions)")
  .action(rotateKeyCommand);

// Hidden hook command - called by Claude Code hooks
program
  .command("hook", { hidden: true })
  .description("Process hook events from Claude Code (internal)")
  .action(hookCommand);

program.parse();
