import chalk from "chalk";
import { readConfig, readEncryptionKey, getKeyFingerprint } from "../lib/config.js";
import {
  getHooksStatus,
  getHooksFilePath,
  getAdapter,
  getAllCliTypes,
  CliType,
} from "../lib/hooks.js";

export async function statusCommand(): Promise<void> {
  console.log(chalk.bold("\nLLM Whiteboard Status\n"));

  const config = await readConfig();

  if (!config) {
    console.log(chalk.yellow("Status: Not configured"));
    console.log(chalk.dim("\nRun: npx llmwhiteboard init"));
    return;
  }

  console.log(chalk.green("Status: Configured"));
  console.log();

  console.log(chalk.dim("Configuration:"));
  console.log(`  API URL: ${config.apiUrl}`);
  console.log(`  Machine ID: ${config.machineId}`);
  console.log(`  Token: ${config.token.slice(0, 12)}...`);

  if (config.encryption?.enabled) {
    const key = await readEncryptionKey();
    if (key) {
      console.log(`  Encryption: Enabled (fingerprint: ${getKeyFingerprint(key)})`);
    } else {
      console.log(chalk.yellow(`  Encryption: Enabled (KEY MISSING!)`));
    }
  } else {
    console.log(`  Encryption: Disabled`);
  }

  console.log();

  // Check hooks status for all CLI types
  console.log(chalk.dim("CLI Tools:"));

  const globalStatus = await getHooksStatus("user");
  const projectStatus = await getHooksStatus("project", process.cwd());

  for (const cliType of getAllCliTypes()) {
    const adapter = getAdapter(cliType);
    const global = globalStatus.get(cliType);
    const project = projectStatus.get(cliType);

    if (!global?.cliInstalled) {
      console.log(`  ${adapter.displayName}: ${chalk.dim("Not installed")}`);
      continue;
    }

    const projectHooks = project?.installed;
    const globalHooks = global?.installed;

    if (projectHooks) {
      console.log(`  ${adapter.displayName}: ${chalk.green("Hooks installed (project-level)")}`);
      console.log(chalk.dim(`    ${getHooksFilePath(cliType, "project", process.cwd())}`));
    } else if (globalHooks) {
      console.log(`  ${adapter.displayName}: ${chalk.green("Hooks installed (global)")}`);
      console.log(chalk.dim(`    ${getHooksFilePath(cliType, "user")}`));
    } else {
      console.log(`  ${adapter.displayName}: ${chalk.yellow("Hooks not installed")}`);
    }
  }

  console.log();
  console.log(chalk.dim("Commands:"));
  console.log(chalk.dim("  npx llmwhiteboard list       - List your sessions"));
  console.log(chalk.dim("  npx llmwhiteboard resume     - Resume a session"));
  console.log(chalk.dim("  npx llmwhiteboard init --hooks-only  - Reinstall hooks"));
  console.log(chalk.dim("  npx llmwhiteboard logout     - Remove configuration"));
}
