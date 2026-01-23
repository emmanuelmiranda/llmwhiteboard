"use client";

import { useState, useEffect, useCallback } from "react";
import { useSignalRContext, type HighlightType } from "./signalr-provider";
import { apiClient } from "@/lib/api-client";
import { MessageSquare, Wrench, Zap, MessageSquareMore, Loader2 } from "lucide-react";

const STORAGE_KEY = "activity-stats";

interface RecentEvent {
  id: string;
  type: string;
  sessionId: string;
  timestamp: number;
}

interface SessionEventInfo {
  eventType: string;
  toolName?: string | null;
}

interface PersistedState {
  recentEvents: RecentEvent[];
  promptCount: number;
  toolCount: number;
  sessionLastEvents: Record<string, SessionEventInfo>;
  savedAt: number;
}

function loadPersistedState(): Partial<PersistedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PersistedState;
    // Only use data less than 10 minutes old
    if (Date.now() - parsed.savedAt > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function ActivityStats() {
  // Get context first (needed for persisted state loading)
  const { onNewEvent, onSessionCreated, onSessionUpdated, triggerHighlight, setHoverHighlightType, updateSessionActivityState } = useSignalRContext();

  // Local state
  const [initialized, setInitialized] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [promptCount, setPromptCount] = useState(0);
  const [toolCount, setToolCount] = useState(0);

  // Session stats
  const [activeSessionCount, setActiveSessionCount] = useState(0);

  // Track sessions waiting for input
  const [sessionLastEvents, setSessionLastEvents] = useState<Map<string, SessionEventInfo>>(new Map());

  // Load persisted state on mount
  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted) {
      if (persisted.recentEvents) {
        // Filter out old events
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        setRecentEvents(persisted.recentEvents.filter(e => e.timestamp > fiveMinutesAgo));
      }
      if (persisted.promptCount) setPromptCount(persisted.promptCount);
      if (persisted.toolCount) setToolCount(persisted.toolCount);
      if (persisted.sessionLastEvents) {
        const entries = Object.entries(persisted.sessionLastEvents);
        setSessionLastEvents(new Map(entries));
        // Also update shared context state
        entries.forEach(([sessionId, info]) => {
          updateSessionActivityState(sessionId, info.eventType, info.toolName);
        });
      }
    }
    setInitialized(true);
  }, [updateSessionActivityState]);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!initialized) return;
    savePersistedState({
      recentEvents,
      promptCount,
      toolCount,
      sessionLastEvents: Object.fromEntries(sessionLastEvents),
      savedAt: Date.now(),
    });
  }, [initialized, recentEvents, promptCount, toolCount, sessionLastEvents]);

  // Track events for rate calculation (keep last 5 minutes)
  const addEvent = useCallback((eventType: string, eventId: string, sessionId: string, toolName?: string | null) => {
    const now = Date.now();
    setRecentEvents((prev) => {
      // Add new event and filter out events older than 5 minutes
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const updated = [...prev, { id: eventId, type: eventType, sessionId, timestamp: now }]
        .filter((e) => e.timestamp > fiveMinutesAgo);
      return updated;
    });

    // Track prompt vs tool counts
    if (eventType === "user_prompt") {
      setPromptCount((prev) => prev + 1);
    } else if (eventType === "tool_use") {
      setToolCount((prev) => prev + 1);
    }

    // Track last event per session for waiting detection
    setSessionLastEvents((prev) => {
      const next = new Map(prev);
      next.set(sessionId, { eventType, toolName });
      return next;
    });

    // Update shared context state
    updateSessionActivityState(sessionId, eventType, toolName);
  }, [updateSessionActivityState]);

  // Count sessions by state
  // tool_use_start is from PreToolUse hook (fires when question is asked)
  // tool_use is from PostToolUse hook (fires after user answers)
  // permission_request is when waiting for user to approve an action
  const isWaitingEvent = (info: SessionEventInfo) => {
    if (info.eventType === "permission_request") return true;
    if ((info.eventType === "tool_use_start" || info.eventType === "tool_use") && info.toolName?.toLowerCase() === "askuserquestion") return true;
    return false;
  };

  const waitingCount = Array.from(sessionLastEvents.values()).filter(isWaitingEvent).length;

  const idleCount = Array.from(sessionLastEvents.values()).filter(
    (info) => !info.eventType || info.eventType === "stop" || info.eventType === "session_end"
  ).length;

  const workingCount = Array.from(sessionLastEvents.values()).filter(
    (info) => {
      if (!info.eventType) return false;
      if (info.eventType === "stop" || info.eventType === "session_end") return false;
      if (isWaitingEvent(info)) return false;
      return true;
    }
  ).length;

  // Calculate events per minute from recent events
  const eventsPerMinute = (() => {
    if (recentEvents.length < 2) return 0;
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const eventsInLastMinute = recentEvents.filter((e) => e.timestamp > oneMinuteAgo);
    return eventsInLastMinute.length;
  })();

  // Calculate prompt:tool ratio
  const promptToolRatio = (() => {
    if (promptCount === 0) return null;
    const ratio = toolCount / promptCount;
    return Math.round(ratio);
  })();

  // Fetch initial session stats
  const fetchSessionStats = useCallback(async () => {
    try {
      const data = await apiClient.getSessions({ status: "Active", limit: 100 });
      const activeSessions = data.sessions || [];
      setActiveSessionCount(activeSessions.length);
    } catch (error) {
      // Silently fail - stats are non-critical
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSessionStats();
  }, [fetchSessionStats]);

  // Subscribe to real-time events
  useEffect(() => {
    const unsubscribeEvent = onNewEvent((event) => {
      addEvent(event.eventType, event.id, event.sessionId, event.toolName);
    });

    const unsubscribeCreated = onSessionCreated(() => {
      // Refresh session stats when a new session is created
      fetchSessionStats();
    });

    const unsubscribeUpdated = onSessionUpdated(() => {
      // Refresh session stats when a session is updated
      fetchSessionStats();
    });

    return () => {
      unsubscribeEvent();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [onNewEvent, onSessionCreated, onSessionUpdated, addEvent, fetchSessionStats]);

  // Cleanup old events periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      setRecentEvents((prev) => prev.filter((e) => e.timestamp > fiveMinutesAgo));
    }, 30000); // Clean up every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 text-sm flex-wrap">
      {/* Active Sessions */}
      <div
        className="flex items-center gap-1.5 text-muted-foreground cursor-help"
        title="Total sessions with Active status"
      >
        <div className={`h-2 w-2 rounded-full ${activeSessionCount > 0 ? "bg-green-500" : "bg-gray-400"}`} />
        <span className="font-medium text-foreground">{activeSessionCount}</span>
        <span className="hidden sm:inline">Active</span>
      </div>

      {/* Working sessions */}
      {workingCount > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => triggerHighlight("working")}
            onMouseEnter={() => setHoverHighlightType("working")}
            onMouseLeave={() => setHoverHighlightType(null)}
            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 cursor-pointer hover:opacity-80 transition-opacity"
            title="Hover to highlight working sessions, click to pulse"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-medium">{workingCount}</span>
            <span className="hidden sm:inline">working</span>
          </button>
        </>
      )}

      {/* Waiting for input */}
      {waitingCount > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => triggerHighlight("waiting")}
            onMouseEnter={() => setHoverHighlightType("waiting")}
            onMouseLeave={() => setHoverHighlightType(null)}
            className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 cursor-pointer hover:opacity-80 transition-opacity"
            title="Hover to highlight waiting sessions, click to pulse"
          >
            <MessageSquareMore className="h-3.5 w-3.5" />
            <span className="font-medium">{waitingCount}</span>
            <span className="hidden sm:inline">waiting</span>
          </button>
        </>
      )}

      <div className="h-4 w-px bg-border" />

      {/* Events per minute */}
      <div
        className="flex items-center gap-1.5 text-muted-foreground cursor-help"
        title="Events received in the last 60 seconds (prompts, tool uses, etc.)"
      >
        <Zap className={`h-3.5 w-3.5 ${eventsPerMinute > 0 ? "text-yellow-500" : ""}`} />
        <span className="font-medium text-foreground">{eventsPerMinute}</span>
        <span className="hidden sm:inline">/min</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Prompt:Tool ratio */}
      <div
        className="flex items-center gap-1.5 text-muted-foreground cursor-help"
        title={`Prompt to tool ratio since page load: ${promptCount} prompts → ${toolCount} tool uses. Higher ratio = Claude doing more per prompt.`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">1</span>
        <span>:</span>
        <span className="font-medium text-foreground">{promptToolRatio ?? "—"}</span>
        <Wrench className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
