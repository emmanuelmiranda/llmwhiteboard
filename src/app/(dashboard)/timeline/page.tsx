"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, Folder, Clock, ArrowRight, Monitor, Loader2, MessageSquareMore, Square } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { SessionStatus } from "@/types";
import { useSignalRContext } from "@/components/signalr-provider";
import { ConnectionStatus } from "@/components/connection-status";
import { ActivityStats } from "@/components/activity-stats";

interface TimelineSession {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  status: SessionStatus;
  machine: {
    id: string;
    machineId: string;
    name: string | null;
  } | null;
  lastActivityAt: string;
  createdAt: string;
  eventCount: number;
}

interface TimelineEvent {
  id: string;
  sessionId: string;
  eventType: string;
  toolName: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Extract the most useful info from tool metadata for display
function getToolDisplayInfo(toolName: string | null, metadata: Record<string, unknown> | null): string | null {
  if (!toolName || !metadata) return null;

  const input = metadata.input as Record<string, unknown> | undefined;
  if (!input) return null;

  const tool = toolName.toLowerCase();

  // File operations - show the file path/name
  if (tool === "read" || tool === "write" || tool === "edit" || tool === "notebookedit") {
    const filePath = (input.file_path || input.path || input.notebook_path) as string | undefined;
    if (filePath) {
      // Show just the filename, not full path
      const fileName = filePath.split(/[/\\]/).pop();
      return fileName || filePath;
    }
  }

  // Search operations - show the pattern
  if (tool === "grep") {
    const pattern = input.pattern as string | undefined;
    if (pattern) {
      return pattern.length > 50 ? pattern.slice(0, 50) + "..." : pattern;
    }
  }

  if (tool === "glob") {
    const pattern = input.pattern as string | undefined;
    if (pattern) return pattern;
  }

  // Bash - show truncated command
  if (tool === "bash") {
    const command = input.command as string | undefined;
    if (command) {
      const firstLine = command.split("\n")[0];
      return firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
    }
  }

  // Web operations
  if (tool === "webfetch" || tool === "websearch") {
    const url = input.url as string | undefined;
    const query = input.query as string | undefined;
    if (url) {
      try {
        return new URL(url).hostname;
      } catch {
        return url.slice(0, 40);
      }
    }
    if (query) return query.length > 50 ? query.slice(0, 50) + "..." : query;
  }

  // Task tool - show description
  if (tool === "task") {
    const description = input.description as string | undefined;
    if (description) return description;
  }

  return null;
}

const statusColors: Record<SessionStatus, "default" | "success" | "warning" | "secondary"> = {
  Active: "success",
  Paused: "warning",
  Completed: "default",
  Archived: "secondary",
};

export default function TimelinePage() {
  const [sessions, setSessions] = useState<TimelineSession[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [glowingSessionIds, setGlowingSessionIds] = useState<Set<string>>(new Set());
  const [glowingEventIds, setGlowingEventIds] = useState<Set<string>>(new Set());
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [hoveredEventSessionId, setHoveredEventSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const {
    onSessionCreated,
    onSessionUpdated,
    onNewEvent,
    highlightType,
    hoverHighlightType,
    getSessionActivityState,
    updateSessionActivityState,
  } = useSignalRContext();

  // Wrapper to check session status before returning activity state
  const getActivityState = useCallback((sessionId: string, status: string) => {
    if (status !== "Active") return "idle";
    return getSessionActivityState(sessionId);
  }, [getSessionActivityState]);

  // Add glow effect to a session temporarily
  const addSessionGlow = useCallback((id: string) => {
    setGlowingSessionIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setGlowingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }, []);

  // Add glow effect to an event temporarily
  const addEventGlow = useCallback((id: string) => {
    setGlowingEventIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setGlowingEventIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [sessionsData, eventsData] = await Promise.all([
        apiClient.getSessions({ limit: 20 }),
        apiClient.getEvents({ limit: 50 }),
      ]);

      setSessions(sessionsData.sessions || []);
      setEvents(eventsData.events || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load timeline data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeNewEvent = onNewEvent((newEvent) => {
      // Prepend new event to the timeline
      setEvents((prev) => {
        // Check if event already exists
        if (prev.some((e) => e.id === newEvent.id)) {
          return prev;
        }
        // Keep only the most recent 50 events
        return [newEvent as TimelineEvent, ...prev].slice(0, 50);
      });
      addEventGlow(newEvent.id);
      // Track activity state
      updateSessionActivityState(newEvent.sessionId, newEvent.eventType);
    });

    const unsubscribeCreated = onSessionCreated((newSession) => {
      setSessions((prev) => {
        if (prev.some((s) => s.id === newSession.id)) {
          return prev;
        }
        // Keep only the most recent 20 sessions
        return [newSession as TimelineSession, ...prev].slice(0, 20);
      });
      addSessionGlow(newSession.id);
      // New sessions start as working
      updateSessionActivityState(newSession.id, "session_start");
    });

    const unsubscribeUpdated = onSessionUpdated((updatedSession) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === updatedSession.id ? (updatedSession as TimelineSession) : s
        )
      );
      addSessionGlow(updatedSession.id);
    });

    return () => {
      unsubscribeNewEvent();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [onNewEvent, onSessionCreated, onSessionUpdated, addEventGlow, addSessionGlow, updateSessionActivityState]);

  // Group events by date
  const groupedEvents = events.reduce(
    (groups, event) => {
      const date = new Date(event.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
      return groups;
    },
    {} as Record<string, TimelineEvent[]>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timeline</h1>
          <p className="text-muted-foreground">
            A chronological view of your session activity
          </p>
        </div>
        <ConnectionStatus />
      </div>

      <div className="p-3 rounded-lg border bg-card">
        <ActivityStats />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Sessions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Clock className="h-5 w-5 mr-2" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sessions yet</p>
            ) : (
              sessions.slice(0, 10).map((session) => {
                const activityState = getActivityState(session.id, session.status);
                const shouldPulse = highlightType && activityState === highlightType;
                const shouldStatsHover = hoverHighlightType && activityState === hoverHighlightType;
                const isEventHovered = hoveredEventSessionId === session.id;
                const isHighlighted = isEventHovered || shouldStatsHover;
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className={`block p-3 rounded-lg border transition-colors ${
                      glowingSessionIds.has(session.id) ? "realtime-glow" : ""
                    } ${activityState === "waiting" && !isHighlighted ? "border-amber-400 dark:border-amber-500" : ""} ${
                      shouldPulse ? `highlight-pulse-${highlightType}` : ""
                    } ${isHighlighted ? "bg-amber-100 dark:bg-amber-900/30 border-amber-400" : "hover:border-primary/50"}`}
                    onMouseEnter={() => setHoveredSessionId(session.id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm break-words">
                          {session.title ||
                            `Session ${session.localSessionId.slice(0, 8)}`}
                        </p>
                        {activityState === "waiting" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                            <MessageSquareMore className="h-3 w-3 mr-0.5" />
                            Waiting
                          </span>
                        ) : activityState === "working" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">
                            <Loader2 className="h-3 w-3 mr-0.5 animate-spin" />
                            Working
                          </span>
                        ) : (
                          <Badge variant={statusColors[session.status]} className="text-xs shrink-0">
                            {session.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground flex-wrap gap-x-2">
                        <span className="flex items-center">
                          <Folder className="h-3 w-3 mr-1 shrink-0" />
                          <span className="break-words">
                            {session.projectPath.split(/[/\\]/).pop()}
                          </span>
                        </span>
                        {session.machine && (
                          <span className="flex items-center">
                            <Monitor className="h-3 w-3 mr-1 shrink-0" />
                            <span className="break-words">
                              {session.machine.name || session.machine.machineId.slice(0, 8)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {formatRelativeTime(new Date(session.lastActivityAt))}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Event Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Activity className="h-5 w-5 mr-2" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No events yet. Start using Claude Code to see your activity here.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                  <div key={date}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {date}
                    </h3>
                    <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {dateEvents.map((event) => {
                        const session = sessions.find(
                          (s) => s.id === event.sessionId
                        );
                        const sessionActivityState = session ? getActivityState(session.id, session.status) : "idle";
                        const isSessionHovered = hoveredSessionId === event.sessionId;
                        const isStatsHovered = hoverHighlightType && sessionActivityState === hoverHighlightType;
                        const isHighlighted = isSessionHovered || isStatsHovered;
                        return (
                          <div
                            key={event.id}
                            className={`flex items-start pl-8 relative rounded-lg transition-colors duration-200 ${
                              glowingEventIds.has(event.id) ? "realtime-glow" : ""
                            } ${isHighlighted ? "bg-amber-100 dark:bg-amber-900/30" : ""}`}
                            onMouseEnter={() => setHoveredEventSessionId(event.sessionId)}
                            onMouseLeave={() => setHoveredEventSessionId(null)}
                          >
                            <div className={`absolute left-0 top-1 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              event.eventType === "session_end"
                                ? "border-red-500 bg-red-100 dark:bg-red-900/30"
                                : event.eventType === "stop"
                                ? "border-gray-400 bg-gray-100 dark:bg-gray-800"
                                : isHighlighted ? "border-amber-500 bg-amber-200 dark:bg-amber-800" : "border-primary bg-background"
                            }`}>
                              {event.eventType === "session_end" ? (
                                <Square className="h-3 w-3 text-red-500" />
                              ) : event.eventType === "stop" ? (
                                <Square className="h-3 w-3 text-gray-500" />
                              ) : (
                                <Activity className="h-3 w-3 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {event.eventType === "session_end" ? (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:border-red-700 dark:text-red-300">
                                    Session ended
                                  </Badge>
                                ) : event.eventType === "stop" ? (
                                  <Badge variant="outline" className="text-xs">
                                    Session paused
                                  </Badge>
                                ) : event.eventType === "tool_use" && event.toolName ? (
                                  <Badge variant="outline" className="text-xs">
                                    {event.toolName}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {event.eventType}
                                  </Badge>
                                )}
                                {(() => {
                                  const toolInfo = getToolDisplayInfo(event.toolName, event.metadata);
                                  if (toolInfo) {
                                    return (
                                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
                                        {toolInfo}
                                      </code>
                                    );
                                  }
                                  // Fall back to summary for non-tool events (like user_prompt)
                                  if (event.eventType !== "tool_use" && event.summary) {
                                    return (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {event.summary}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="flex items-center mt-1 text-xs text-muted-foreground">
                                <span>
                                  {new Date(event.createdAt).toLocaleTimeString()}
                                </span>
                                {session && (
                                  <>
                                    <ArrowRight className="h-3 w-3 mx-1" />
                                    <Link
                                      href={`/sessions/${session.id}`}
                                      className="hover:underline"
                                    >
                                      {session.title ||
                                        session.localSessionId.slice(0, 8)}
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
