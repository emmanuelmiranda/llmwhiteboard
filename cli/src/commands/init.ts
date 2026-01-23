import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import {
  readConfig,
  writeConfig,
  getMachineId,
  generateEncryptionKey,
  getKeyFingerprint,
  ENCRYPTION_KEY_FILE,
} from "../lib/config.js";
import {
  installHooksForCli,
  installHooksForClis,
  getHooksFilePath,
  detectInstalledClis,
  getAdapter,
  CliType,
} from "../lib/hooks.js";
import { loginCommand } from "./login.js";

interface InitOptions {
  token?: string;
  url?: string;
  machineId?: string;
  enableEncryption?: boolean;
  project?: boolean;  // Use project-level hooks instead of global
  hooksOnly?: boolean;  // Just reinstall hooks, skip config
  cli?: string;  // Comma-separated list of CLI types
  noUrlNotify?: boolean;  // Disable URL notification after each response
}

export async function initCommand(options: InitOptions): Promise<void> {
  // If --hooks-only, just reinstall hooks and exit
  if (options.hooksOnly) {
    const spinner = ora("Detecting installed CLI tools...").start();
    try {
      const projectPath = options.project ? process.cwd() : undefined;
      const scope = options.project ? "project" : "user";

      // Parse CLI types from option or detect installed
      let cliTypes: CliType[];
      if (options.cli) {
        cliTypes = options.cli.split(",").map(s => s.trim()) as CliType[];
      } else {
        cliTypes = await detectInstalledClis();
      }

      if (cliTypes.length === 0) {
        spinner.fail("No CLI tools detected");
        console.log(chalk.yellow("\nNo supported CLI tools found. Please install:"));
        console.log("  - Claude Code: https://claude.com/code");
        console.log("  - Gemini CLI: https://github.com/google-gemini/gemini-cli");
        return;
      }

      for (const cliType of cliTypes) {
        const adapter = getAdapter(cliType);
        spinner.text = `Reinstalling ${adapter.displayName} hooks...`;
        await installHooksForCli(cliType, scope, projectPath);
      }

      spinner.succeed(`Hooks reinstalled for: ${cliTypes.map(c => getAdapter(c).displayName).join(", ")}`);
      console.log(chalk.dim("\nHooks updated. Restart your CLI tools to apply changes."));
      return;
    } catch (error) {
      spinner.fail("Failed to reinstall hooks");
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  }

  console.log(chalk.bold("\nWelcome to LLM Whiteboard!\n"));

  // Detect installed CLI tools
  const installedClis = await detectInstalledClis();
  if (installedClis.length === 0) {
    console.log(chalk.yellow("No supported CLI tools detected."));
    console.log("\nPlease install one of the following:");
    console.log("  - Claude Code: https://claude.com/code");
    console.log("  - Gemini CLI: https://github.com/google-gemini/gemini-cli");
    console.log("\nThen run this command again.");
    return;
  }

  console.log(chalk.dim(`Detected CLI tools: ${installedClis.map(c => getAdapter(c).displayName).join(", ")}\n`));

  // Check if already authenticated
  let existingConfig = await readConfig();
  let token = options.token || existingConfig?.token;
  let apiUrl = options.url || existingConfig?.apiUrl || "https://api.llmwhiteboard.com";
  let enableEncryption = options.enableEncryption || false;

  // If not authenticated, trigger login flow
  if (!token) {
    console.log(chalk.yellow("You need to authenticate first.\n"));
    await loginCommand({ url: apiUrl, machineId: options.machineId });

    // Re-read config after login
    existingConfig = await readConfig();
    if (!existingConfig?.token) {
      console.log(chalk.red("\nAuthentication failed. Please try again."));
      process.exit(1);
    }
    token = existingConfig.token;
    apiUrl = existingConfig.apiUrl || apiUrl;
  }

  // Ask if user wants to change API URL
  const { changeUrl } = await inquirer.prompt([
    {
      type: "confirm",
      name: "changeUrl",
      message: `Use API URL: ${apiUrl}?`,
      default: true,
    },
  ]);

  if (!changeUrl) {
    const urlAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "apiUrl",
        message: "Enter API URL:",
        default: apiUrl,
      },
    ]);
    apiUrl = urlAnswer.apiUrl;
  }

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

  // Select CLI tools to integrate
  let selectedClis: CliType[];
  if (options.cli) {
    selectedClis = options.cli.split(",").map(s => s.trim()) as CliType[];
    // Filter to only installed CLIs
    selectedClis = selectedClis.filter(c => installedClis.includes(c));
  } else if (installedClis.length === 1) {
    selectedClis = installedClis;
  } else {
    const cliAnswer = await inquirer.prompt([
      {
        type: "checkbox",
        name: "clis",
        message: "Which CLI tools do you want to integrate?",
        choices: installedClis.map(cliType => {
          const adapter = getAdapter(cliType);
          return {
            name: adapter.displayName + (adapter.getHookConfig("").isExperimental ? " (experimental hooks)" : ""),
            value: cliType,
            checked: true,
          };
        }),
        validate: (input) => {
          if (input.length === 0) {
            return "Please select at least one CLI tool";
          }
          return true;
        },
      },
    ]);
    selectedClis = cliAnswer.clis;
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
      showUrlOnStop: !options.noUrlNotify,  // default true unless --no-url-notify
    });

    // Install hooks for selected CLIs
    const projectPath = options.project ? process.cwd() : undefined;
    const scope = options.project ? "project" : "user";

    for (const cliType of selectedClis) {
      const adapter = getAdapter(cliType);
      const hooksLocation = options.project
        ? `project (${adapter.getSettingsPath("project", projectPath)})`
        : `global (${adapter.getSettingsPath("user")})`;

      spinner.text = `Installing ${adapter.displayName} hooks (${hooksLocation})...`;

      // Warn about experimental hooks
      const hookConfig = adapter.getHookConfig("");
      if (hookConfig.isExperimental) {
        console.log(chalk.yellow(`\nNote: ${adapter.displayName} hooks are experimental and require opt-in.`));
        console.log(chalk.yellow(`The following settings will be enabled automatically:`));
        if (hookConfig.additionalSettings) {
          console.log(chalk.dim(JSON.stringify(hookConfig.additionalSettings, null, 2)));
        }
      }

      await installHooksForCli(cliType, scope, projectPath);
    }

    spinner.succeed("LLM Whiteboard configured successfully!");

    console.log(chalk.green("\nSetup complete! Your sessions will now sync automatically."));
    console.log(chalk.dim(`\nMachine ID: ${machineId}`));
    console.log(chalk.dim(`Integrated CLIs: ${selectedClis.map(c => getAdapter(c).displayName).join(", ")}`));

    if (enableEncryption) {
      console.log(chalk.dim(`Encryption: Enabled`));
    }

    console.log(chalk.dim(`\nYour sessions will appear at: https://llmwhiteboard.com/sessions`));

    // Show hooks file locations
    console.log(chalk.dim("\nHooks installed at:"));
    for (const cliType of selectedClis) {
      const filePath = getHooksFilePath(cliType, scope, projectPath);
      console.log(chalk.dim(`  ${getAdapter(cliType).displayName}: ${filePath}`));
    }
  } catch (error) {
    spinner.fail("Configuration failed");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
