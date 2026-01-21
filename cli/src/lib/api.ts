import { readConfig, getMachineId } from "./config.js";

interface SyncPayload {
  localSessionId: string;
  projectPath: string;
  machineId: string;
  event: {
    type: "session_start" | "session_end" | "tool_use" | "message" | "stop";
    toolName?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: string;
}

interface Session {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  description: string | null;
  status: string;
  tags: string[];
  cliType: string; // claude-code or gemini-cli
  machine: {
    id: string;
    machineId: string;
    name: string | null;
  } | null;
  hasTranscript: boolean;
  isEncrypted: boolean;
  eventCount: number;
  lastActivityAt: string;
  createdAt: string;
}

interface ListSessionsResponse {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
}

interface TranscriptResponse {
  sessionId: string;
  localSessionId: string;
  projectPath: string;
  machineId: string;
  cliType: string; // claude-code or gemini-cli
  content: string; // base64
  isEncrypted: boolean;
  checksum: string;
  sizeBytes: number;
}

async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = await readConfig();
  if (!config) {
    throw new Error("Not configured. Run: npx llmwhiteboard init");
  }

  const url = `${config.apiUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new Error(errorBody.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function syncEvent(payload: Omit<SyncPayload, "machineId">): Promise<void> {
  const machineId = await getMachineId();
  await makeRequest("/api/sync", {
    method: "POST",
    body: JSON.stringify({ ...payload, machineId }),
  });
}

export async function uploadTranscript(
  localSessionId: string,
  content: Buffer,
  isEncrypted: boolean,
  checksum: string
): Promise<void> {
  const machineId = await getMachineId();
  await makeRequest("/api/sync/transcript", {
    method: "POST",
    body: JSON.stringify({
      localSessionId,
      machineId,
      content: content.toString("base64"),
      isEncrypted,
      checksum,
    }),
  });
}

export async function listSessions(options?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<ListSessionsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);
  if (options?.limit) params.set("limit", options.limit.toString());

  return makeRequest<ListSessionsResponse>(`/api/sync/sessions?${params}`);
}

export async function downloadTranscript(sessionId: string): Promise<TranscriptResponse> {
  return makeRequest<TranscriptResponse>(`/api/sync/transcript/${sessionId}`);
}

export async function downloadSnapshot(snapshotId: string): Promise<TranscriptResponse> {
  return makeRequest<TranscriptResponse>(`/api/sync/snapshot/${snapshotId}`);
}

export { type Session, type TranscriptResponse };
