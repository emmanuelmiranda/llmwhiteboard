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
  async getAuthProviders(): Promise<AuthProviders> {
    return this.request<AuthProviders>("/api/auth/providers");
  }

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

  // GitHub OAuth
  async getGitHubAuthUrl(redirectUri: string): Promise<{ url: string; state: string }> {
    return this.request<{ url: string; state: string }>(
      `/api/auth/github/authorize?redirectUri=${encodeURIComponent(redirectUri)}`
    );
  }

  async githubCallback(code: string, state: string, redirectUri: string): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>(
      "/api/auth/github/callback",
      {
        method: "POST",
        body: JSON.stringify({ code, state, redirectUri }),
      }
    );
    this.setToken(response.token);
    return response;
  }

  // Sessions
  async getSessions(params?: {
    search?: string;
    status?: string;
    cliType?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.cliType) searchParams.set("cliType", params.cliType);
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

  async deleteMachine(id: string) {
    return this.request<{ success: boolean }>(`/api/machines/${id}`, {
      method: "DELETE",
    });
  }

  // Snapshots
  async getSessionSnapshots(sessionId: string) {
    return this.request<SnapshotListResponse>(
      `/api/sessions/${sessionId}/snapshots`
    );
  }

  // Shares
  async createShare(data: CreateShareRequest) {
    return this.request<CreateShareResponse>("/api/share", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getShares() {
    return this.request<ShareListResponse>("/api/share");
  }

  async getSessionShares(sessionId: string) {
    return this.request<ShareListResponse>(`/api/share/session/${sessionId}`);
  }

  async revokeShare(id: string) {
    return this.request<{ success: boolean }>(`/api/share/${id}`, {
      method: "DELETE",
    });
  }

  // Public endpoints (no auth required, use share token)
  async validateShareToken(token: string) {
    return this.publicRequest<ValidateShareResponse>(
      `/api/public/validate?token=${encodeURIComponent(token)}`
    );
  }

  async getPublicFeed(token: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    return this.publicRequest<PublicSessionListResponse>(
      `/api/public/feed?${params.toString()}`,
      token
    );
  }

  async getPublicSession(token: string, sessionId: string) {
    return this.publicRequest<PublicSession>(
      `/api/public/session/${sessionId}`,
      token
    );
  }

  async getPublicSessionEvents(
    token: string,
    sessionId: string,
    params?: { limit?: number; offset?: number }
  ) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    return this.publicRequest<PublicEventsResponse>(
      `/api/public/session/${sessionId}/events?${searchParams.toString()}`,
      token
    );
  }

  private async publicRequest<T>(endpoint: string, token?: string): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      (headers as Record<string, string>)["X-Share-Token"] = token;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
      }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }
}

// Types
interface AuthProviders {
  email: boolean;
  gitHub: boolean;
}

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
  cliType: string;
  machine: {
    id: string;
    machineId: string;
    name: string | null;
  } | null;
  hasTranscript: boolean;
  isEncrypted: boolean;
  transcriptSizeBytes: number;
  eventCount: number;
  compactionCount: number;
  totalTokensUsed: number;
  lastActivityAt: string;
  createdAt: string;
}

interface SessionDetail extends Session {
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

// Share types
type ShareScope = "Session" | "UserFeed";
type ShareVisibility = "Full" | "ActivityOnly";

interface CreateShareRequest {
  sessionId?: string;
  scope: ShareScope;
  visibility: ShareVisibility;
  name?: string;
  expiresAt?: string;
  maxViewers?: number;
}

interface CreateShareResponse {
  id: string;
  token: string;
  url: string;
  message: string;
}

export interface ShareToken {
  id: string;
  sessionId: string | null;
  scope: string;
  visibility: string;
  token: string;
  name: string | null;
  expiresAt: string | null;
  maxViewers: number | null;
  isRevoked: boolean;
  createdAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
}

interface ShareListResponse {
  shares: ShareToken[];
}

interface ValidateShareResponse {
  valid: boolean;
  scope?: string;
  visibility?: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
}

interface PublicSession {
  id: string;
  title: string | null;
  status: string;
  cliType: string;
  eventCount: number;
  lastActivityAt: string;
  createdAt: string;
  projectPath?: string;
  description?: string;
  tags?: string[];
  machineName?: string;
}

interface PublicEvent {
  id: string;
  sessionId: string;
  eventType: string;
  toolName: string | null;
  createdAt: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

interface PublicSessionListResponse {
  sessions: PublicSession[];
  total: number;
}

interface PublicEventsResponse {
  events: PublicEvent[];
  total: number;
  limit: number;
  offset: number;
}

export const apiClient = new ApiClient();
export type {
  AuthProviders,
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
  ShareScope,
  ShareVisibility,
  CreateShareRequest,
  CreateShareResponse,
  ShareListResponse,
  ValidateShareResponse,
  PublicSession,
  PublicEvent,
  PublicSessionListResponse,
  PublicEventsResponse,
};
