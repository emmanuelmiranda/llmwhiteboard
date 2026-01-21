import type { SessionStatus } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.llmwhiteboard.com";

interface ApiError {
  error: string;
  details?: unknown;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token");
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
      }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.request<{ token: string; user: User }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    this.setToken(response.token);
    return response;
  }

  async signup(email: string, password: string, name?: string) {
    const response = await this.request<{ token: string; user: User }>(
      "/api/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }
    );
    this.setToken(response.token);
    return response;
  }

  logout() {
    this.setToken(null);
  }

  // Sessions
  async getSessions(params?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    return this.request<SessionListResponse>(
      `/api/sessions?${searchParams.toString()}`
    );
  }

  async getSession(id: string) {
    const session = await this.request<SessionDetail>(`/api/sessions/${id}`);
    return { session };
  }

  async updateSession(
    id: string,
    data: { title?: string; description?: string; status?: string; tags?: string[] }
  ) {
    const session = await this.request<Session>(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { session };
  }

  async deleteSession(id: string) {
    return this.request<{ success: boolean }>(`/api/sessions/${id}`, {
      method: "DELETE",
    });
  }

  // Events
  async getEvents(params?: { limit?: number; offset?: number; sessionId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.sessionId) searchParams.set("sessionId", params.sessionId);

    return this.request<{ events: SessionEvent[] }>(
      `/api/events?${searchParams.toString()}`
    );
  }

  async getSessionEvents(sessionId: string, params?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    return this.request<SessionEventsResponse>(
      `/api/sessions/${sessionId}/events?${searchParams.toString()}`
    );
  }

  // Tokens
  async getTokens() {
    return this.request<{ tokens: ApiToken[] }>("/api/tokens");
  }

  async createToken(name: string) {
    return this.request<{ token: string; id: string; message: string }>(
      "/api/tokens",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      }
    );
  }

  async revokeToken(id: string) {
    return this.request<{ success: boolean }>(`/api/tokens?id=${id}`, {
      method: "DELETE",
    });
  }

  // Machines
  async getMachines() {
    return this.request<{ machines: Machine[] }>("/api/machines");
  }

  async updateMachine(id: string, data: { name?: string }) {
    return this.request<Machine>(`/api/machines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Snapshots
  async getSessionSnapshots(sessionId: string) {
    return this.request<SnapshotListResponse>(
      `/api/sessions/${sessionId}/snapshots`
    );
  }
}

// Types
interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface Session {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  description: string | null;
  status: SessionStatus;
  tags: string[];
  machine: {
    id: string;
    machineId: string;
    name: string | null;
  } | null;
  hasTranscript: boolean;
  isEncrypted: boolean;
  eventCount: number;
  compactionCount: number;
  totalTokensUsed: number;
  lastActivityAt: string;
  createdAt: string;
}

interface SessionDetail extends Session {
  events: SessionEvent[];
  transcript: {
    id: string;
    isEncrypted: boolean;
    sizeBytes: number;
    uploadedAt: string;
  } | null;
}

interface SessionListResponse {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
}

interface SessionEventsResponse {
  events: SessionEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: string;
  toolName: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface Machine {
  id: string;
  machineId: string;
  name: string | null;
  lastSeenAt: string | null;
  sessionCount: number;
}

interface Snapshot {
  id: string;
  sessionId: string;
  compactionCycle: number;
  type: "PostCompaction" | "Checkpoint" | "Delta";
  sizeBytes: number;
  contextPercentage: number | null;
  isEncrypted: boolean;
  createdAt: string;
}

interface SnapshotListResponse {
  snapshots: Snapshot[];
}

export const apiClient = new ApiClient();
export type {
  User,
  Session,
  SessionDetail,
  SessionListResponse,
  SessionEventsResponse,
  SessionEvent,
  ApiToken,
  Machine,
  Snapshot,
  SnapshotListResponse,
};
