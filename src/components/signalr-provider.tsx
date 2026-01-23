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
  // Highlight state for pulsing waiting/working sessions (on click)
  highlightType: HighlightType;
  triggerHighlight: (type: HighlightType) => void;
  // Hover highlight state (on hover)
  hoverHighlightType: HighlightType;
  setHoverHighlightType: (type: HighlightType) => void;
  // Shared activity state tracking
  getSessionActivityState: (sessionId: string) => ActivityState;
  updateSessionActivityState: (sessionId: string, eventType: string | undefined | null, toolName?: string | null) => void;
}

const SignalRContext = createContext<SignalRContextValue | null>(null);

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [highlightType, setHighlightType] = useState<HighlightType>(null);
  const [hoverHighlightType, setHoverHighlightType] = useState<HighlightType>(null);
  const [sessionActivityStates, setSessionActivityStates] = useState<Map<string, { state: ActivityState; lastEventTime: number }>>(new Map());

  // Time threshold for considering a session idle (5 minutes)
  const IDLE_THRESHOLD = 5 * 60 * 1000;

  const getActivityStateFromEvent = (eventType: string | undefined | null, toolName?: string | null): ActivityState => {
    if (!eventType) return "idle";
    const type = eventType.toLowerCase();
    // Session stopped or ended = idle
    if (type === "stop" || type === "session_end") {
      return "idle";
    }
    // Permission request = waiting for user approval
    if (type === "permission_request") {
      return "waiting";
    }
    // Claude asked a question = waiting for user input
    // tool_use_start is from PreToolUse hook (fires when question is asked)
    // tool_use is from PostToolUse hook (fires after user answers)
    if ((type === "tool_use_start" || type === "tool_use") && toolName?.toLowerCase() === "askuserquestion") {
      return "waiting";
    }
    // User submitted a prompt or any other activity = working
    return "working";
  };

  const updateSessionActivityState = useCallback((sessionId: string, eventType: string | undefined | null, toolName?: string | null) => {
    setSessionActivityStates((prev) => {
      const next = new Map(prev);
      next.set(sessionId, {
        state: getActivityStateFromEvent(eventType, toolName),
        lastEventTime: Date.now(),
      });
      return next;
    });
  }, []);

  const getSessionActivityState = useCallback((sessionId: string): ActivityState => {
    const info = sessionActivityStates.get(sessionId);
    if (!info) return "idle";
    if (Date.now() - info.lastEventTime > IDLE_THRESHOLD) return "idle";
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

  const onSessionCreated = (callback: (session: Session) => void) => {
    return on("SessionCreated", callback);
  };

  const onSessionUpdated = (callback: (session: Session) => void) => {
    return on("SessionUpdated", callback);
  };

  const onSessionDeleted = (callback: (sessionId: string) => void) => {
    return on("SessionDeleted", callback);
  };

  const onNewEvent = (callback: (event: SessionEvent) => void) => {
    return on("NewEvent", callback);
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
