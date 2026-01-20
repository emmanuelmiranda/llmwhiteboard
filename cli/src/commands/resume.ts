import fs from "fs/promises";
import path from "path";
import os from "os";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { downloadTranscript, listSessions, type Session } from "../lib/api.js";
import { readConfig, readEncryptionKey } from "../lib/config.js";
import { decrypt, computeChecksum } from "../lib/crypto.js";

interface ResumeOptions {
  search?: string;
  latest?: boolean;
}

export async function resumeCommand(
  sessionId?: string,
  options: ResumeOptions = {}
): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(chalk.red("Not configured. Run: npx llmwhiteboard init"));
    process.exit(1);
  }

  const spinner = ora();

  try {
    let targetSessionId = sessionId;

    // If searching or getting latest, find the session first
    if (options.search || options.latest) {
      spinner.start("Searching for sessions...");

      const { sessions } = await listSessions({
        search: options.search,
        limit: options.latest ? 1 : 10,
      });

      spinner.stop();

      if (sessions.length === 0) {
        console.log(chalk.yellow("\nNo sessions found."));
        return;
      }

      if (options.latest) {
        targetSessionId = sessions[0].id;
        console.log(chalk.dim(`\nFound latest session: ${sessions[0].title || sessions[0].localSessionId.slice(0, 8)}`));
      } else {
        // Let user select from search results
        const choices = sessions.map((s: Session) => ({
          name: `${s.title || s.localSessionId.slice(0, 8)} - ${s.projectPath.split(/[/\\]/).pop()}`,
          value: s.id,
        }));

        const answer = await inquirer.prompt([
          {
            type: "list",
            name: "sessionId",
            message: "Select a session to resume:",
            choices,
          },
        ]);

        targetSessionId = answer.sessionId;
      }
    }

    if (!targetSessionId) {
      console.error(chalk.red("Please provide a session ID, use --search, or --latest"));
      process.exit(1);
    }

    spinner.start("Downloading session transcript...");

    const transcript = await downloadTranscript(targetSessionId);

    // Decode content
    let content = Buffer.from(transcript.content, "base64");

    // Verify checksum
    if (computeChecksum(content) !== transcript.checksum) {
      spinner.fail("Checksum verification failed");
      console.error(chalk.red("The downloaded transcript appears to be corrupted."));
      process.exit(1);
    }

    // Decrypt if necessary
    if (transcript.isEncrypted) {
      spinner.text = "Decrypting transcript...";

      const encryptionKey = await readEncryptionKey();
      if (!encryptionKey) {
        spinner.fail("Encryption key not found");
        console.error(
          chalk.red(
            "\nThis session is encrypted but no encryption key was found."
          )
        );
        console.error(
          chalk.red(
            "Make sure you have your encryption key at ~/.llmwhiteboard/encryption.key"
          )
        );
        process.exit(1);
      }

      try {
        content = decrypt(content, encryptionKey);
      } catch {
        spinner.fail("Decryption failed");
        console.error(
          chalk.red("\nFailed to decrypt the transcript. Is this the correct key?")
        );
        process.exit(1);
      }
    }

    // Determine the target directory
    const projectPath = transcript.projectPath;
    const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");

    // Create a sanitized project path for storage
    const sanitizedProjectPath = projectPath.replace(/[:\\]/g, "_").replace(/^_+/, "");
    const targetDir = path.join(claudeProjectsDir, sanitizedProjectPath);

    spinner.text = "Restoring session...";

    // Create directory structure
    await fs.mkdir(targetDir, { recursive: true });

    // Write the transcript file
    const transcriptPath = path.join(targetDir, `${transcript.localSessionId}.jsonl`);
    await fs.writeFile(transcriptPath, content);

    spinner.succeed("Session restored successfully!");

    console.log(chalk.green(`\nSession restored to: ${transcriptPath}`));
    console.log(chalk.bold("\nTo resume this session, run:"));
    console.log(
      chalk.cyan(
        `  claude --continue ${transcript.localSessionId} --directory "${projectPath}"`
      )
    );
  } catch (error) {
    spinner.fail("Failed to resume session");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
