import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.llmwhiteboard.com";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface UsePublicSignalROptions {
  token: string;
  enabled?: boolean;
}

export function usePublicSignalR(options: UsePublicSignalROptions) {
  const { token, enabled = true } = options;
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const listenersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());

  // Build connection
  const buildConnection = useCallback(() => {
    if (!token) {
      return null;
    }

    return new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/public?token=${encodeURIComponent(token)}`)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 4s, 8s, 16s, 30s max
          const delay = Math.min(Math.pow(2, retryContext.previousRetryCount) * 1000, 30000);
          return delay;
        },
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();
  }, [token]);

  // Start connection
  const start = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const connection = buildConnection();
    if (!connection) {
      return;
    }

    connectionRef.current = connection;

    // Set up connection state handlers
    connection.onclose(() => {
      setConnectionState("disconnected");
    });

    connection.onreconnecting(() => {
      setConnectionState("reconnecting");
    });

    connection.onreconnected(() => {
      setConnectionState("connected");
      // Re-register all listeners after reconnection
      listenersRef.current.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          connection.off(event, callback as (...args: unknown[]) => void);
          connection.on(event, callback as (...args: unknown[]) => void);
        });
      });
    });

    try {
      setConnectionState("connecting");
      await connection.start();
      setConnectionState("connected");
    } catch (err) {
      console.error("Public SignalR connection error:", err);
      setConnectionState("disconnected");
    }
  }, [buildConnection]);

  // Stop connection
  const stop = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
      setConnectionState("disconnected");
    }
  }, []);

  // Subscribe to an event
  const on = useCallback(<T extends unknown[]>(event: string, callback: (...args: T) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback as (...args: unknown[]) => void);

    if (connectionRef.current) {
      connectionRef.current.on(event, callback as (...args: unknown[]) => void);
    }

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(event)?.delete(callback as (...args: unknown[]) => void);
      connectionRef.current?.off(event, callback as (...args: unknown[]) => void);
    };
  }, []);

  // Join a session group (for UserFeed scope)
  const joinSession = useCallback(async (sessionId: string) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke("JoinSession", sessionId);
      } catch (err) {
        console.error("Error joining session:", err);
      }
    }
  }, []);

  // Leave a session group
  const leaveSession = useCallback(async (sessionId: string) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke("LeaveSession", sessionId);
      } catch (err) {
        console.error("Error leaving session:", err);
      }
    }
  }, []);

  // Auto-connect when enabled and token is available
  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    start();

    return () => {
      stop();
    };
  }, [enabled, token, start, stop]);

  return {
    connectionState,
    start,
    stop,
    on,
    joinSession,
    leaveSession,
  };
}
