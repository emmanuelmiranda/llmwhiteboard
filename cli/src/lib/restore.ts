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
  // Handle Windows paths (C:\foo\bar) and Unix paths (/foo/bar)
  const sanitizedProjectPath = projectPath
    .replace(/^([A-Za-z]):/, "$1") // Keep drive letter but remove colon
    .replace(/[:\\]/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");

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

  const sanitizedProjectPath = projectPath
    .replace(/^([A-Za-z]):/, "$1")
    .replace(/[:\\]/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");

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
