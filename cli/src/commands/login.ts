import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { spawn } from "child_process";
import { platform } from "os";
import { readConfig, writeConfig, getMachineId } from "../lib/config.js";
import { requestDeviceCode, exchangeGitHubToken } from "../lib/api.js";
import { pollForAccessToken } from "../lib/github-device-flow.js";

interface LoginOptions {
  token?: string;
  url?: string;
  machineId?: string;
}

/**
 * Open a URL in the default browser (best effort)
 */
function openBrowser(url: string): void {
  const cmd = platform() === "win32" ? "start" : platform() === "darwin" ? "open" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  const proc = platform() === "win32" ? "cmd" : cmd;

  try {
    spawn(proc, args, {
      detached: true,
      stdio: "ignore",
    }).unref();
  } catch {
    // Silently fail - user will need to open manually
  }
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  console.log(chalk.bold("\nLLM Whiteboard Login\n"));

  // Check if already logged in
  const existingConfig = await readConfig();
  if (existingConfig?.token) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "You are already logged in. Do you want to log in with a different account?",
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.dim("\nLogin cancelled."));
      return;
    }
  }

  const apiUrl = options.url || existingConfig?.apiUrl || "https://api.llmwhiteboard.com";

  // If token provided via CLI, use it directly
  if (options.token) {
    await handleManualToken(options.token, apiUrl, options.machineId);
    return;
  }

  // Ask user how they want to authenticate
  const { authMethod } = await inquirer.prompt([
    {
      type: "list",
      name: "authMethod",
      message: "How would you like to authenticate?",
      choices: [
        { name: "GitHub (recommended)", value: "github" },
        { name: "Enter token manually", value: "manual" },
      ],
    },
  ]);

  if (authMethod === "manual") {
    const { token } = await inquirer.prompt([
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
    await handleManualToken(token, apiUrl, options.machineId);
    return;
  }

  // GitHub device flow
  await handleGitHubDeviceFlow(apiUrl, options.machineId);
}

async function handleManualToken(token: string, apiUrl: string, machineIdOption?: string): Promise<void> {
  const spinner = ora("Validating token...").start();

  try {
    // Get machine ID
    const machineId = machineIdOption || await getMachineId();

    // Save the config
    const existingConfig = await readConfig();
    await writeConfig({
      ...existingConfig,
      token,
      apiUrl,
      machineId,
    });

    spinner.succeed("Token saved successfully!");
    console.log(chalk.green("\nYou are now logged in."));
    console.log(chalk.dim("Run 'llmwhiteboard init' to set up CLI hooks."));
  } catch (error) {
    spinner.fail("Failed to save token");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function handleGitHubDeviceFlow(apiUrl: string, machineIdOption?: string): Promise<void> {
  const spinner = ora("Requesting device code...").start();

  try {
    // Request device code from backend
    const deviceCode = await requestDeviceCode(apiUrl);
    spinner.stop();

    // Display instructions
    console.log("\nTo authenticate, open this URL in your browser:\n");
    console.log(chalk.cyan(`  ${deviceCode.verificationUri}\n`));
    console.log("And enter this code:\n");
    console.log(chalk.bold.yellow(`  ${deviceCode.userCode}\n`));

    // Try to open browser
    openBrowser(deviceCode.verificationUri);

    // Start polling
    const pollSpinner = ora("Waiting for authorization...").start();

    const { accessToken } = await pollForAccessToken({
      clientId: deviceCode.clientId,
      deviceCode: deviceCode.deviceCode,
      interval: deviceCode.interval,
      expiresIn: deviceCode.expiresIn,
    });

    pollSpinner.text = "Exchanging token...";

    // Get machine ID
    const machineId = machineIdOption || await getMachineId();

    // Exchange GitHub token for API token
    const result = await exchangeGitHubToken(apiUrl, accessToken, machineId);

    // Save the config
    const existingConfig = await readConfig();
    await writeConfig({
      ...existingConfig,
      token: result.token,
      apiUrl,
      machineId,
    });

    pollSpinner.succeed("Authenticated successfully!");

    const userName = result.user.name || result.user.email;
    console.log(chalk.green(`\nWelcome, ${userName}!`));
    console.log(chalk.dim("\nRun 'llmwhiteboard init' to set up CLI hooks."));
  } catch (error) {
    spinner.stop();
    console.error(chalk.red(`\nAuthentication failed: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
