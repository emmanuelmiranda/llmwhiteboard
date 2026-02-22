"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSignalR, ConnectionState } from "@/hooks/useSignalR";
import { useAuth } from "./auth-provider";
import type { Session, SessionEvent } from "@/lib/api-client";

export type HighlightType = "waiting" | "working" | null;
export type ActivityState = "idle" | "working" | "waiting";

interface SignalRContextValue {
  connectionState: ConnectionState;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: (sessionId: string) => Promise<void>;
  onSessionCreated: (callback: (session: Session) => void) => () => void;
  onSessionUpdated: (callback: (session: Session) => void) => () => void;
  onSessionDeleted: (callback: (sessionId: string) => void) => () => void;
  onNewEvent: (callback: (event: SessionEvent) => void) => () => void;
  // Team event callbacks (same shape, different SignalR method names)
  onTeamSessionCreated: (callback: (session: Session) => void) => () => void;
  onTeamSessionUpdated: (callback: (session: Session) => void) => () => void;
  onTeamNewEvent: (callback: (event: SessionEvent) => void) => () => void;
  // Highlight state for pulsing waiting/working sessions (on click)
  highlightType: HighlightType;
  triggerHighlight: (type: HighlightType) => void;
  // Hover highlight state (on hover)
  hoverHighlightType: HighlightType;
  setHoverHighlightType: (type: HighlightType) => void;
  // Shared activity state tracking
  getSessionActivityState: (sessionId: string) => ActivityState;
  updateSessionActivityState: (sessionId: string, eventType: string | undefined | null, toolName?: string | null, eventTime?: number) => void;
}

const SignalRContext = createContext<SignalRContextValue | null>(null);

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [highlightType, setHighlightType] = useState<HighlightType>(null);
  const [hoverHighlightType, setHoverHighlightType] = useState<HighlightType>(null);
  const [sessionActivityStates, setSessionActivityStates] = useState<Map<string, { state: ActivityState; eventType: string; lastEventTime: number }>>(new Map());

  // Time thresholds for considering a session idle
  const IDLE_THRESHOLD_DEFAULT = 5 * 60 * 1000; // 5 minutes for most events
  const IDLE_THRESHOLD_USER_PROMPT = 60 * 1000; // 1 minute for user_prompt (Claude should respond quickly)

  const getActivityStateFromEvent = (eventType: string | undefined | null, toolName?: string | null): ActivityState => {
    if (!eventType) return "idle";
    const type = eventType.toLowerCase();
    // Session stopped or ended = idle
    if (type === "stop" || type === "session_end" || type === "agent_stop") {
      return "idle";
    }
    // Permission request = waiting for user approval
    if (type === "permission_request") {
      return "waiting";
    }
    // Claude asked a question = waiting for user input
    // tool_use_start is from PreToolUse hook (fires when question is asked) = waiting
    // tool_use is from PostToolUse hook (fires after user answers) = working
    if (type === "tool_use_start" && toolName?.toLowerCase() === "askuserquestion") {
      return "waiting";
    }
    // User submitted a prompt or any other activity = working
    return "working";
  };

  const updateSessionActivityState = useCallback((sessionId: string, eventType: string | undefined | null, toolName?: string | null, eventTime?: number) => {
    setSessionActivityStates((prev) => {
      const next = new Map(prev);
      next.set(sessionId, {
        state: getActivityStateFromEvent(eventType, toolName),
        eventType: eventType?.toLowerCase() || "",
        lastEventTime: eventTime ?? Date.now(),
      });
      return next;
    });
  }, []);

  const getSessionActivityState = useCallback((sessionId: string): ActivityState => {
    const info = sessionActivityStates.get(sessionId);
    if (!info) return "idle";

    // Use shorter threshold for user_prompt events
    // If Claude was going to respond with tools, we'd see tool_use events quickly
    // If no activity after a user_prompt, Claude likely finished with text-only response
    const threshold = info.eventType === "user_prompt"
      ? IDLE_THRESHOLD_USER_PROMPT
      : IDLE_THRESHOLD_DEFAULT;

    if (Date.now() - info.lastEventTime > threshold) return "idle";
    return info.state;
  }, [sessionActivityStates]);

  // Only enable SignalR when user is authenticated
  useEffect(() => {
    setIsEnabled(!!user);
  }, [user]);

  const {
    connectionState,
    on,
    joinSession,
    leaveSession,
  } = useSignalR({ enabled: isEnabled });

  // Trigger highlight with auto-clear after 2 seconds
  const triggerHighlight = useCallback((type: HighlightType) => {
    setHighlightType(type);
    if (type) {
      setTimeout(() => setHighlightType(null), 2000);
    }
  }, []);

  // Note: SignalR normalizes method names to lowercase when using System.Text.Json
  const onSessionCreated = (callback: (session: Session) => void) => {
    return on("sessionCreated", callback);
  };

  const onSessionUpdated = (callback: (session: Session) => void) => {
    return on("sessionUpdated", callback);
  };

  const onSessionDeleted = (callback: (sessionId: string) => void) => {
    return on("sessionDeleted", callback);
  };

  const onNewEvent = (callback: (event: SessionEvent) => void) => {
    return on("newEvent", callback);
  };

  const onTeamSessionCreated = (callback: (session: Session) => void) => {
    return on("teamSessionCreated", callback);
  };

  const onTeamSessionUpdated = (callback: (session: Session) => void) => {
    return on("teamSessionUpdated", callback);
  };

  const onTeamNewEvent = (callback: (event: SessionEvent) => void) => {
    return on("teamNewEvent", callback);
  };

  return (
    <SignalRContext.Provider
      value={{
        connectionState,
        joinSession,
        leaveSession,
        onSessionCreated,
        onSessionUpdated,
        onSessionDeleted,
        onNewEvent,
        onTeamSessionCreated,
        onTeamSessionUpdated,
        onTeamNewEvent,
        highlightType,
        triggerHighlight,
        hoverHighlightType,
        setHoverHighlightType,
        getSessionActivityState,
        updateSessionActivityState,
      }}
    >
      {children}
    </SignalRContext.Provider>
  );
}

export function useSignalRContext() {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error("useSignalRContext must be used within a SignalRProvider");
  }
  return context;
}
