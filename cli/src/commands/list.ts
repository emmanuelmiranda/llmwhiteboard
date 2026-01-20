import chalk from "chalk";
import ora from "ora";
import { listSessions } from "../lib/api.js";
import { readConfig } from "../lib/config.js";

interface ListOptions {
  status?: string;
  limit?: string;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(chalk.red("Not configured. Run: npx llmwhiteboard init"));
    process.exit(1);
  }

  const spinner = ora("Fetching sessions...").start();

  try {
    const { sessions, total } = await listSessions({
      status: options.status,
      limit: parseInt(options.limit || "20"),
    });

    spinner.stop();

    if (sessions.length === 0) {
      console.log(chalk.yellow("\nNo sessions found."));
      console.log(chalk.dim("Start using Claude Code to sync your first session."));
      return;
    }

    console.log(chalk.bold(`\nYour Sessions (${sessions.length} of ${total}):\n`));

    for (const session of sessions) {
      const statusColor =
        session.status === "ACTIVE"
          ? chalk.green
          : session.status === "PAUSED"
          ? chalk.yellow
          : chalk.dim;

      const title = session.title || `Session ${session.localSessionId.slice(0, 8)}`;
      const project = session.projectPath.split(/[/\\]/).pop() || session.projectPath;

      console.log(`  ${chalk.bold(title)}`);
      console.log(`  ${chalk.dim("ID:")} ${session.id}`);
      console.log(`  ${chalk.dim("Project:")} ${project}`);
      console.log(`  ${chalk.dim("Status:")} ${statusColor(session.status)}`);
      console.log(
        `  ${chalk.dim("Last Activity:")} ${new Date(session.lastActivityAt).toLocaleString()}`
      );

      if (session.isEncrypted) {
        console.log(`  ${chalk.dim("Encrypted:")} Yes`);
      }

      if (session.hasTranscript) {
        console.log(`  ${chalk.dim("Transcript:")} Available`);
      }

      console.log();
    }

    console.log(chalk.dim("To resume a session: npx llmwhiteboard resume <session-id>"));
  } catch (error) {
    spinner.fail("Failed to fetch sessions");
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
