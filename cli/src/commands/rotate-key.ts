import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import {
  readConfig,
  readEncryptionKey,
  generateEncryptionKey,
  getKeyFingerprint,
  ENCRYPTION_KEY_FILE,
} from "../lib/config.js";
import { listSessions, downloadTranscript, uploadTranscript } from "../lib/api.js";
import { encrypt, decrypt, computeChecksum } from "../lib/crypto.js";

export async function rotateKeyCommand(): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(chalk.red("Not configured. Run: npx llmwhiteboard init"));
    process.exit(1);
  }

  if (!config.encryption?.enabled) {
    console.error(chalk.red("Encryption is not enabled."));
    console.error(chalk.dim("Run: npx llmwhiteboard init --enable-encryption"));
    process.exit(1);
  }

  const oldKey = await readEncryptionKey();
  if (!oldKey) {
    console.error(chalk.red("No encryption key found."));
    process.exit(1);
  }

  console.log(chalk.yellow("\nThis will re-encrypt all your sessions with a new key."));
  console.log(chalk.yellow("Your old key will be replaced.\n"));
  console.log(chalk.dim(`Current key fingerprint: ${getKeyFingerprint(oldKey)}`));

  const confirm = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to rotate your encryption key?",
      default: false,
    },
  ]);

  if (!confirm.confirm) {
    console.log(chalk.dim("\nCancelled."));
    return;
  }

  const spinner = ora("Fetching encrypted sessions...").start();

  try {
    // Get all sessions
    const { sessions } = await listSessions({ limit: 1000 });
    const encryptedSessions = sessions.filter((s) => s.isEncrypted && s.hasTranscript);

    if (encryptedSessions.length === 0) {
      spinner.info("No encrypted sessions found.");
      console.log(chalk.dim("\nGenerating new key anyway..."));
    } else {
      spinner.text = `Found ${encryptedSessions.length} encrypted sessions to re-encrypt`;
    }

    // Generate new key
    spinner.text = "Generating new encryption key...";
    const newKey = await generateEncryptionKey();

    console.log(chalk.yellow(`\nNew key fingerprint: ${getKeyFingerprint(newKey)}`));
    console.log(chalk.yellow(`Key saved to: ${ENCRYPTION_KEY_FILE}`));

    // Re-encrypt each session
    let successCount = 0;
    let errorCount = 0;

    for (const session of encryptedSessions) {
      spinner.text = `Re-encrypting session ${successCount + 1}/${encryptedSessions.length}...`;

      try {
        // Download transcript
        const transcript = await downloadTranscript(session.id);
        let content: Buffer = Buffer.from(transcript.content, "base64");

        // Verify checksum
        if (computeChecksum(content) !== transcript.checksum) {
          throw new Error("Checksum verification failed");
        }

        // Decrypt with old key
        content = decrypt(content, oldKey) as Buffer;

        // Re-encrypt with new key
        const encrypted = encrypt(content, newKey);
        const checksum = computeChecksum(encrypted);

        // Upload re-encrypted transcript
        await uploadTranscript(
          session.localSessionId,
          encrypted,
          true,
          checksum
        );

        successCount++;
      } catch (err) {
        console.error(
          chalk.red(`\nFailed to re-encrypt session ${session.id}: ${err instanceof Error ? err.message : err}`)
        );
        errorCount++;
      }
    }

    if (errorCount > 0) {
      spinner.warn(`Key rotation completed with ${errorCount} errors`);
      console.log(chalk.yellow(`\n${successCount} sessions re-encrypted successfully.`));
      console.log(chalk.red(`${errorCount} sessions failed to re-encrypt.`));
    } else if (encryptedSessions.length > 0) {
      spinner.succeed("Key rotation completed successfully!");
      console.log(chalk.green(`\n${successCount} sessions re-encrypted.`));
    } else {
      spinner.succeed("New encryption key generated!");
    }

    console.log(chalk.yellow("\nIMPORTANT: Back up your new encryption key!"));
    console.log(chalk.yellow(`Location: ${ENCRYPTION_KEY_FILE}`));
  } catch (error) {
    spinner.fail("Key rotation failed");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
