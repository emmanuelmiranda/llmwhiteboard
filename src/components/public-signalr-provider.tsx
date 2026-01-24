"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePublicSignalR, ConnectionState } from "@/hooks/usePublicSignalR";

export type ActivityState = "idle" | "working" | "waiting";

export interface PublicSession {
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

export interface PublicEvent {
  id: string;
  sessionId: string;
  eventType: string;
  toolName: string | null;
  createdAt: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

interface PublicSignalRContextValue {
  connectionState: ConnectionState;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: (sessionId: string) => Promise<void>;
  onSessionUpdated: (callback: (session: PublicSession) => void) => () => void;
  onNewEvent: (callback: (event: PublicEvent) => void) => () => void;
  // Shared activity state tracking
  getSessionActivityState: (sessionId: string) => ActivityState;
  updateSessionActivityState: (sessionId: string, eventType: string | undefined | null, toolName?: string | null) => void;
}

const PublicSignalRContext = createContext<PublicSignalRContextValue | null>(null);

interface PublicSignalRProviderProps {
  token: string;
  children: React.ReactNode;
}

export function PublicSignalRProvider({ token, children }: PublicSignalRProviderProps) {
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

  const {
    connectionState,
    on,
    joinSession,
    leaveSession,
  } = usePublicSignalR({ token, enabled: !!token });

  const onSessionUpdated = useCallback((callback: (session: PublicSession) => void) => {
    return on("PublicSessionUpdated", callback);
  }, [on]);

  const onNewEvent = useCallback((callback: (event: PublicEvent) => void) => {
    return on("PublicNewEvent", callback);
  }, [on]);

  return (
    <PublicSignalRContext.Provider
      value={{
        connectionState,
        joinSession,
        leaveSession,
        onSessionUpdated,
        onNewEvent,
        getSessionActivityState,
        updateSessionActivityState,
      }}
    >
      {children}
    </PublicSignalRContext.Provider>
  );
}

export function usePublicSignalRContext() {
  const context = useContext(PublicSignalRContext);
  if (!context) {
    throw new Error("usePublicSignalRContext must be used within a PublicSignalRProvider");
  }
  return context;
}
