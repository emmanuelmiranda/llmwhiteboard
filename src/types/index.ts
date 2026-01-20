import type { Session, SessionEvent, SessionStatus, Machine } from "@prisma/client";

export type { SessionStatus };

export interface SyncPayload {
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

export interface SessionWithEvents extends Session {
  events: SessionEvent[];
  machine: Machine | null;
}

export interface ApiTokenInfo {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface TranscriptUpload {
  localSessionId: string;
  machineId: string;
  content: string; // base64 encoded
  isEncrypted: boolean;
  checksum: string;
}
