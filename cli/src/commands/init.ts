import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import {
  writeConfig,
  getMachineId,
  generateEncryptionKey,
  getKeyFingerprint,
  ENCRYPTION_KEY_FILE,
} from "../lib/config.js";
import { installHooks, getHooksFilePath } from "../lib/hooks.js";

interface InitOptions {
  token?: string;
  url?: string;
  machineId?: string;
  enableEncryption?: boolean;
  project?: boolean;  // Use project-level hooks instead of global
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold("\nWelcome to LLM Whiteboard!\n"));

  let token = options.token;
  let apiUrl = options.url || "https://api.llmwhiteboard.com";
  let enableEncryption = options.enableEncryption || false;

  // Get API token
  if (!token) {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "token",
        message: "Enter your API token:",
        validate: (input) => {
          if (!input.startsWith("lwb_sk_")) {
            return "Token should start with lwb_sk_";
          }
          return true;
        },
      },
    ]);
    token = answers.token;
  }

  // Get API URL if not default
  const urlAnswer = await inquirer.prompt([
    {
      type: "input",
      name: "apiUrl",
      message: "API URL:",
      default: apiUrl,
    },
  ]);
  apiUrl = urlAnswer.apiUrl;

  // Ask about encryption
  if (!options.enableEncryption) {
    const encryptionAnswer = await inquirer.prompt([
      {
        type: "confirm",
        name: "enableEncryption",
        message: "Enable end-to-end encryption? (Recommended for sensitive data)",
        default: false,
      },
    ]);
    enableEncryption = encryptionAnswer.enableEncryption;
  }

  // Get machine ID - prompt if not provided via CLI
  let machineId = options.machineId;
  if (!machineId) {
    const defaultMachineId = await getMachineId();
    const machineAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "machineId",
        message: "What do you want to call this machine?",
        default: defaultMachineId,
      },
    ]);
    machineId = machineAnswer.machineId;
  }

  const spinner = ora("Configuring LLM Whiteboard...").start();

  try {

    // Generate encryption key if enabled
    let encryptionConfig;
    if (enableEncryption) {
      spinner.text = "Generating encryption key...";
      const key = await generateEncryptionKey();
      encryptionConfig = {
        enabled: true,
        keyPath: ENCRYPTION_KEY_FILE,
      };

      console.log(
        chalk.yellow(
          `\n\nIMPORTANT: Back up your encryption key!`
        )
      );
      console.log(chalk.yellow(`Location: ${ENCRYPTION_KEY_FILE}`));
      console.log(chalk.yellow(`Fingerprint: ${getKeyFingerprint(key)}`));
      console.log(
        chalk.yellow(`Without this key, you cannot decrypt your sessions.\n`)
      );
    }

    // Save configuration
    spinner.text = "Saving configuration...";
    await writeConfig({
      token: token!,
      apiUrl,
      machineId: machineId!,
      encryption: encryptionConfig,
    });

    // Install Claude Code hooks
    // Default to global hooks, use --project for project-specific
    const projectPath = options.project ? process.cwd() : undefined;
    const hooksLocation = options.project ? "project (.claude/settings.local.json)" : "global (~/.claude/settings.json)";

    spinner.text = `Installing Claude Code hooks (${hooksLocation})...`;
    await installHooks(projectPath);

    spinner.succeed("LLM Whiteboard configured successfully!");

    console.log(chalk.green("\nSetup complete! Your sessions will now sync automatically."));
    console.log(chalk.dim(`\nMachine ID: ${machineId}`));

    if (enableEncryption) {
      console.log(chalk.dim(`Encryption: Enabled`));
    }

    console.log(chalk.dim(`\nYour sessions will appear at: https://llmwhiteboard.com/sessions`));
  } catch (error) {
    spinner.fail("Configuration failed");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
