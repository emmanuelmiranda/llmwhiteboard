import fs from "fs/promises";
import path from "path";
import os from "os";
import chalk from "chalk";
import inquirer from "inquirer";
import { downloadTranscript, downloadSnapshot, listSessions, type Session } from "../lib/api.js";
import { readConfig, readEncryptionKey } from "../lib/config.js";
import { decrypt, computeChecksum } from "../lib/crypto.js";

interface ResumeOptions {
  search?: string;
  latest?: boolean;
  snapshot?: string;
}

export async function resumeCommand(
  sessionId?: string,
  options: ResumeOptions = {}
): Promise<void> {
  console.log(chalk.dim(`→ Reading config from ~/.llmwhiteboard/config.json`));
  const config = await readConfig();
  if (!config) {
    console.error(chalk.red("Not configured. Run: npx llmwhiteboard init"));
    process.exit(1);
  }
  console.log(chalk.dim(`    API URL: ${config.apiUrl}`));

  try {
    let targetSessionId = sessionId;

    // If searching or getting latest, find the session first
    if (options.search || options.latest) {
      console.log(chalk.dim(`→ Searching sessions (query: ${options.search || 'latest'})...`));

      const { sessions } = await listSessions({
        search: options.search,
        limit: options.latest ? 1 : 10,
      });

      console.log(chalk.dim(`→ Found ${sessions.length} session(s)`));

      if (sessions.length === 0) {
        console.log(chalk.yellow("\nNo sessions found."));
        return;
      }

      if (options.latest) {
        targetSessionId = sessions[0].id;
        console.log(chalk.dim(`→ Selected latest session: ${sessions[0].title || sessions[0].localSessionId.slice(0, 8)}`));
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

    if (!targetSessionId && !options.snapshot) {
      console.error(chalk.red("Please provide a session ID, use --search, --latest, or --snapshot"));
      process.exit(1);
    }

    let transcript;
    if (options.snapshot) {
      console.log(chalk.dim(`→ Fetching snapshot from API: GET /api/sync/snapshot/${options.snapshot}`));
      transcript = await downloadSnapshot(options.snapshot);
    } else {
      console.log(chalk.dim(`→ Fetching transcript from API: GET /api/sync/transcript/${targetSessionId}`));
      transcript = await downloadTranscript(targetSessionId!);
    }

    console.log(chalk.dim(`→ Received transcript:`));
    console.log(chalk.dim(`    Local Session ID: ${transcript.localSessionId}`));
    console.log(chalk.dim(`    Project Path: ${transcript.projectPath}`));
    console.log(chalk.dim(`    Size: ${(transcript.sizeBytes / 1024).toFixed(1)} KB`));
    console.log(chalk.dim(`    Encrypted: ${transcript.isEncrypted ? 'Yes' : 'No'}`));

    // Decode content
    console.log(chalk.dim(`→ Decoding base64 content...`));
    let content = Buffer.from(transcript.content, "base64");
    console.log(chalk.dim(`    Decoded size: ${content.length} bytes`));

    // Verify checksum
    console.log(chalk.dim(`→ Verifying checksum...`));
    const computedChecksum = computeChecksum(content);
    if (computedChecksum !== transcript.checksum) {
      console.error(chalk.red(`    Expected: ${transcript.checksum}`));
      console.error(chalk.red(`    Got: ${computedChecksum}`));
      console.error(chalk.red("\nThe downloaded transcript appears to be corrupted."));
      process.exit(1);
    }
    console.log(chalk.dim(`    Checksum verified: ${transcript.checksum.slice(0, 16)}...`));

    // Decrypt if necessary
    if (transcript.isEncrypted) {
      console.log(chalk.dim(`→ Session is encrypted, reading encryption key...`));

      const encryptionKey = await readEncryptionKey();
      if (!encryptionKey) {
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

      console.log(chalk.dim(`→ Decrypting transcript...`));
      try {
        content = decrypt(content, encryptionKey);
        console.log(chalk.dim(`    Decrypted size: ${content.length} bytes`));
      } catch {
        console.error(
          chalk.red("\nFailed to decrypt the transcript. Is this the correct key?")
        );
        process.exit(1);
      }
    }

    // Determine the target directory based on CURRENT working directory
    // Claude Code looks for sessions based on cwd, not original project path
    const cwd = process.cwd();
    const originalProjectPath = transcript.projectPath;
    const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");

    // Warn if resuming to a different path than original
    if (path.basename(cwd) !== path.basename(originalProjectPath)) {
      console.log(chalk.yellow(`⚠ Original project: ${originalProjectPath}`));
      console.log(chalk.yellow(`  Current directory: ${cwd}`));
    }

    // Create a sanitized project path for storage
    // Must match Claude Code's format exactly:
    // - /Users/foo -> -Users-foo (Unix, keeps leading dash)
    // - D:\sources\foo -> D--sources-foo (Windows, no leading dash)
    const sanitizedProjectPath = cwd.split("").map(c => {
      const code = c.charCodeAt(0);
      if (code === 58 || code === 92 || code === 47) return "-"; // : \ /
      return c;
    }).join("");
    const targetDir = path.join(claudeProjectsDir, sanitizedProjectPath);

    console.log(chalk.dim(`→ Target directory: ${targetDir}`));

    // Create directory structure
    console.log(chalk.dim(`→ Creating directory structure...`));
    await fs.mkdir(targetDir, { recursive: true });

    // Write the transcript file
    const transcriptPath = path.join(targetDir, `${transcript.localSessionId}.jsonl`);
    console.log(chalk.dim(`→ Writing transcript to: ${transcriptPath}`));
    await fs.writeFile(transcriptPath, content);
    console.log(chalk.dim(`    Written ${content.length} bytes`));

    console.log(chalk.green("\n✓ Session restored successfully!"));

    console.log(chalk.white(`\nSession restored to: ${transcriptPath}`));
    console.log(chalk.bold("\nTo resume this session, run:"));
    console.log(chalk.cyan(`  claude --resume ${transcript.localSessionId}`));
  } catch (error) {
    console.error(chalk.red(`\n✗ Failed to resume session`));
    console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
