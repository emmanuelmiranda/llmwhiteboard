import fs from "fs/promises";
import path from "path";
import os from "os";

interface RestoreResult {
  transcriptPath: string;
  projectPath: string;
  localSessionId: string;
}

export async function restoreTranscript(
  content: Buffer,
  projectPath: string,
  localSessionId: string
): Promise<RestoreResult> {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");

  // Create a sanitized project path for storage
  // Must match Claude Code's format: D:\sources\foo -> D--sources-foo
  const sanitizedProjectPath = projectPath.split("").map(c => {
    const code = c.charCodeAt(0);
    if (code === 58 || code === 92 || code === 47) return "-"; // : \ /
    return c;
  }).join("").replace(/^-+/, "");

  const targetDir = path.join(claudeProjectsDir, sanitizedProjectPath);

  // Create directory structure
  await fs.mkdir(targetDir, { recursive: true });

  // Write the transcript file
  const transcriptPath = path.join(targetDir, `${localSessionId}.jsonl`);
  await fs.writeFile(transcriptPath, content);

  return {
    transcriptPath,
    projectPath,
    localSessionId,
  };
}

export async function findExistingTranscript(
  projectPath: string,
  localSessionId: string
): Promise<string | null> {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");

  // Must match Claude Code's format: D:\sources\foo -> D--sources-foo
  const sanitizedProjectPath = projectPath.split("").map(c => {
    const code = c.charCodeAt(0);
    if (code === 58 || code === 92 || code === 47) return "-"; // : \ /
    return c;
  }).join("").replace(/^-+/, "");

  const transcriptPath = path.join(
    claudeProjectsDir,
    sanitizedProjectPath,
    `${localSessionId}.jsonl`
  );

  try {
    await fs.access(transcriptPath);
    return transcriptPath;
  } catch {
    return null;
  }
}
