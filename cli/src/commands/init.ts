import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import {
  writeConfig,
  getMachineId,
  generateEncryptionKey,
  getKeyFingerprint,
  ENCRYPTION_KEY_FILE,
} from "../lib/config.js";
import { installHooks } from "../lib/hooks.js";

interface InitOptions {
  token?: string;
  url?: string;
  enableEncryption?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold("\nWelcome to LLM Whiteboard!\n"));

  let token = options.token;
  let apiUrl = options.url || "http://localhost:22001";
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

  const spinner = ora("Configuring LLM Whiteboard...").start();

  try {
    // Get or generate machine ID
    const machineId = await getMachineId();

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
      machineId,
      encryption: encryptionConfig,
    });

    // Install Claude Code hooks
    spinner.text = "Installing Claude Code hooks...";
    await installHooks();

    spinner.succeed("LLM Whiteboard configured successfully!");

    console.log(chalk.green("\nSetup complete! Your sessions will now sync automatically."));
    console.log(chalk.dim(`\nMachine ID: ${machineId}`));

    if (enableEncryption) {
      console.log(chalk.dim(`Encryption: Enabled`));
    }

    console.log(chalk.dim(`\nYour sessions will appear at: ${apiUrl}/sessions`));
  } catch (error) {
    spinner.fail("Configuration failed");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
