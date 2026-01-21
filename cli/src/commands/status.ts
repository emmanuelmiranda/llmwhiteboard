import chalk from "chalk";
import { readConfig, readEncryptionKey, getKeyFingerprint } from "../lib/config.js";
import { areHooksInstalled, getHooksFilePath } from "../lib/hooks.js";

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

  // Check both project-level and global hooks
  const projectHooksInstalled = await areHooksInstalled(process.cwd());
  const globalHooksInstalled = await areHooksInstalled();

  if (projectHooksInstalled) {
    console.log(chalk.green(`Hooks: Installed (project-level)`));
    console.log(chalk.dim(`  ${getHooksFilePath(process.cwd())}`));
  } else if (globalHooksInstalled) {
    console.log(chalk.green(`Hooks: Installed (global)`));
    console.log(chalk.dim(`  ${getHooksFilePath()}`));
  } else {
    console.log(chalk.yellow("Hooks: Not installed"));
    console.log(chalk.dim("  Run: npx llmwhiteboard init"));
  }

  console.log();
  console.log(chalk.dim("Commands:"));
  console.log(chalk.dim("  npx llmwhiteboard list       - List your sessions"));
  console.log(chalk.dim("  npx llmwhiteboard resume     - Resume a session"));
  console.log(chalk.dim("  npx llmwhiteboard logout     - Remove configuration"));
}
