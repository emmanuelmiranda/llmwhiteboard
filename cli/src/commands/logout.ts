import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { deleteConfig } from "../lib/config.js";
import { uninstallAllHooks, detectInstalledClis, getAdapter } from "../lib/hooks.js";

export async function logoutCommand(): Promise<void> {
  const confirm = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to remove LLM Whiteboard configuration?",
      default: false,
    },
  ]);

  if (!confirm.confirm) {
    console.log(chalk.dim("\nCancelled."));
    return;
  }

  const spinner = ora("Removing configuration...").start();

  try {
    // Detect installed CLIs to uninstall hooks from
    spinner.text = "Detecting installed CLI tools...";
    const installedClis = await detectInstalledClis();

    // Uninstall hooks from all installed CLIs
    if (installedClis.length > 0) {
      for (const cliType of installedClis) {
        const adapter = getAdapter(cliType);
        spinner.text = `Removing ${adapter.displayName} hooks...`;
        // Continue even if one fails
      }
      await uninstallAllHooks();
    }

    // Delete configuration
    spinner.text = "Deleting configuration...";
    await deleteConfig();

    spinner.succeed("Configuration removed successfully!");

    if (installedClis.length > 0) {
      console.log(chalk.dim(`\nHooks removed from: ${installedClis.map(c => getAdapter(c).displayName).join(", ")}`));
    }

    console.log(chalk.yellow("\nNote: Your encryption key (if any) was NOT deleted."));
    console.log(chalk.yellow("To remove it: rm ~/.llmwhiteboard/encryption.key"));
    console.log(chalk.dim("\nYour synced sessions remain on the server."));
  } catch (error) {
    spinner.fail("Failed to remove configuration");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
