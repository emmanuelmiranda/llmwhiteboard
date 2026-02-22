import {
  Activity, Clock, Loader2, MessageSquare, MessageSquareMore, Play, RefreshCw, Square, Wrench,
} from "lucide-react";

// --- Activity State ---

export type ActivityState = "idle" | "working" | "waiting";

/** Compute activity state from a session's last event data. */
export function computeActivityState(session: {
  status: string;
  lastEventType?: string | null;
  lastEventToolName?: string | null;
  lastEventAt?: string | null;
}): ActivityState {
  if (session.status !== "Active") return "idle";

  const eventType = session.lastEventType?.toLowerCase();
  const toolName = session.lastEventToolName;
  const eventTime = session.lastEventAt ? new Date(session.lastEventAt).getTime() : null;

  if (!eventType || !eventTime) return "idle";

  const IDLE_THRESHOLD_DEFAULT = 5 * 60 * 1000;
  const IDLE_THRESHOLD_USER_PROMPT = 60 * 1000;

  const threshold = eventType === "user_prompt" ? IDLE_THRESHOLD_USER_PROMPT : IDLE_THRESHOLD_DEFAULT;
  if (Date.now() - eventTime > threshold) return "idle";

  if (eventType === "stop" || eventType === "session_end" || eventType === "agent_stop") return "idle";
  if (eventType === "permission_request") return "waiting";
  if (eventType === "tool_use_start" && toolName?.toLowerCase() === "askuserquestion") return "waiting";

  return "working";
}

// --- Event Filtering ---

export type EventFilter = "all" | "prompts" | "tools" | "waiting" | "sessions" | "compaction";
export type SessionFilter = "all" | "active" | "working" | "waiting" | "idle";

export const eventFilters: { value: EventFilter; label: string; icon: typeof Activity }[] = [
  { value: "all", label: "All", icon: Activity },
  { value: "prompts", label: "Prompts", icon: MessageSquare },
  { value: "tools", label: "Tools", icon: Wrench },
  { value: "waiting", label: "Waiting", icon: MessageSquareMore },
  { value: "sessions", label: "Sessions", icon: Play },
  { value: "compaction", label: "Compaction", icon: RefreshCw },
];

export const sessionFilters: { value: SessionFilter; label: string; icon: typeof Activity }[] = [
  { value: "all", label: "All", icon: Clock },
  { value: "active", label: "Active", icon: Activity },
  { value: "working", label: "Working", icon: Loader2 },
  { value: "waiting", label: "Waiting", icon: MessageSquareMore },
  { value: "idle", label: "Idle", icon: Square },
];

export function matchesEventFilter(eventType: string, toolName: string | null, filter: EventFilter): boolean {
  if (filter === "all") return true;
  if (filter === "prompts") return eventType === "user_prompt";
  if (filter === "tools") return eventType === "tool_use" || eventType === "tool_use_start";
  if (filter === "waiting") {
    return eventType === "permission_request" ||
      ((eventType === "tool_use" || eventType === "tool_use_start") && toolName?.toLowerCase() === "askuserquestion");
  }
  if (filter === "sessions") return eventType === "session_start" || eventType === "session_end" || eventType === "stop";
  if (filter === "compaction") return eventType === "context_compaction";
  return true;
}

export function matchesSessionFilter(session: { status: string; lastEventType?: string | null; lastEventToolName?: string | null; lastEventAt?: string | null }, filter: SessionFilter): boolean {
  if (filter === "all") return true;
  const state = computeActivityState(session);
  if (filter === "active") return state === "working" || state === "waiting";
  if (filter === "working") return state === "working";
  if (filter === "waiting") return state === "waiting";
  if (filter === "idle") return state === "idle" || session.status !== "Active";
  return true;
}

// --- Formatting ---

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
