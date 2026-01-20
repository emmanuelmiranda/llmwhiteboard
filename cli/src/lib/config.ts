import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

export interface Config {
  token: string;
  apiUrl: string;
  machineId: string;
  encryption?: {
    enabled: boolean;
    keyPath: string;
  };
}

const CONFIG_DIR = path.join(os.homedir(), ".llmwhiteboard");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const MACHINE_ID_FILE = path.join(CONFIG_DIR, "machine-id");
const ENCRYPTION_KEY_FILE = path.join(CONFIG_DIR, "encryption.key");

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function getMachineId(): Promise<string> {
  try {
    const id = await fs.readFile(MACHINE_ID_FILE, "utf-8");
    return id.trim();
  } catch {
    const id = crypto.randomUUID();
    await ensureConfigDir();
    await fs.writeFile(MACHINE_ID_FILE, id);
    return id;
  }
}

export async function readConfig(): Promise<Config | null> {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function deleteConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

export async function generateEncryptionKey(): Promise<string> {
  const key = crypto.randomBytes(32).toString("hex");
  await ensureConfigDir();
  await fs.writeFile(ENCRYPTION_KEY_FILE, key, { mode: 0o600 });
  return key;
}

export async function readEncryptionKey(): Promise<string | null> {
  try {
    const key = await fs.readFile(ENCRYPTION_KEY_FILE, "utf-8");
    return key.trim();
  } catch {
    return null;
  }
}

export function getKeyFingerprint(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export { CONFIG_DIR, ENCRYPTION_KEY_FILE };
