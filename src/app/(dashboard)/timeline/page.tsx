"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, Folder, Clock, ArrowRight, Monitor, Loader2, MessageSquareMore, Square, Wrench, MessageSquare, Play, RefreshCw, AlertCircle, ShieldAlert } from "lucide-react";
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

  // Bash - show first line of command
  if (tool === "bash") {
    const command = input.command as string | undefined;
    if (command) {
      return command.split("\n")[0];
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

  // AskUserQuestion - show question and answer
  if (tool === "askuserquestion") {
    const questions = input.questions as Array<{ question?: string }> | undefined;
    const firstQuestion = questions?.[0]?.question;
    return firstQuestion || null;
  }

  return null;
}

// Get the answer for AskUserQuestion from tool response
function getAskUserAnswer(toolName: string | null, metadata: Record<string, unknown> | null): string | null {
  if (!toolName || toolName.toLowerCase() !== "askuserquestion" || !metadata) return null;

  const response = metadata.response as Record<string, unknown> | string | undefined;

  // Response might be a string directly or an object with answers
  if (typeof response === "string") {
    // Try to parse it if it looks like JSON
    try {
      const parsed = JSON.parse(response);
      if (parsed.answers) {
        const answers = Object.values(parsed.answers);
        if (answers.length > 0) return String(answers[0]);
      }
    } catch {
      return response;
    }
  }

  if (typeof response === "object" && response) {
    // Check for answers property
    const answers = (response as Record<string, unknown>).answers as Record<string, string> | undefined;
    if (answers) {
      const answerValues = Object.values(answers);
      if (answerValues.length > 0) return answerValues[0];
    }
  }

  return null;
}

// Get permission request details
function getPermissionRequestInfo(eventType: string, toolName: string | null, metadata: Record<string, unknown> | null): { tool: string; action?: string } | null {
  if (eventType !== "permission_request") return null;

  // toolName from the event indicates which tool needs permission
  // metadata might have additional info
  const tool = toolName || (metadata?.tool_name as string) || "Unknown";
  const input = metadata?.input as Record<string, unknown> | undefined;

  // Try to get a meaningful action description
  let action: string | undefined;
  if (input) {
    if (input.command) action = String(input.command).split("\n")[0];
    else if (input.file_path) action = String(input.file_path).split(/[/\\]/).pop();
  }

  return { tool, action };
}

const statusColors: Record<SessionStatus, "default" | "success" | "warning" | "secondary"> = {
  Active: "success",
  Paused: "warning",
  Completed: "default",
  Archived: "secondary",
};

type EventFilter = "all" | "prompts" | "tools" | "waiting" | "sessions" | "compaction";
type SessionFilter = "all" | "active" | "working" | "waiting" | "idle";

const eventFilters: { value: EventFilter; label: string; icon: typeof Activity }[] = [
  { value: "all", label: "All", icon: Activity },
  { value: "prompts", label: "Prompts", icon: MessageSquare },
  { value: "tools", label: "Tools", icon: Wrench },
  { value: "waiting", label: "Waiting", icon: MessageSquareMore },
  { value: "sessions", label: "Sessions", icon: Play },
  { value: "compaction", label: "Compaction", icon: RefreshCw },
];

const sessionFilters: { value: SessionFilter; label: string; icon: typeof Activity }[] = [
  { value: "all", label: "All", icon: Clock },
  { value: "active", label: "Active", icon: Activity },
  { value: "working", label: "Working", icon: Loader2 },
  { value: "waiting", label: "Waiting", icon: MessageSquareMore },
  { value: "idle", label: "Idle", icon: Square },
];

function matchesEventFilter(eventType: string, toolName: string | null, filter: EventFilter): boolean {
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

export default function TimelinePage() {
  const [sessions, setSessions] = useState<TimelineSession[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [glowingSessionIds, setGlowingSessionIds] = useState<Set<string>>(new Set());
  const [glowingEventIds, setGlowingEventIds] = useState<Set<string>>(new Set());
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [hoveredEventSessionId, setHoveredEventSessionId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
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
      updateSessionActivityState(newEvent.sessionId, newEvent.eventType, newEvent.toolName);
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

  // Filter sessions based on selected filter
  const matchesSessionFilter = useCallback((session: TimelineSession, filter: SessionFilter): boolean => {
    if (filter === "all") return true;
    const activityState = getActivityState(session.id, session.status);
    if (filter === "active") return session.status === "Active";
    if (filter === "working") return activityState === "working";
    if (filter === "waiting") return activityState === "waiting";
    if (filter === "idle") return activityState === "idle" || session.status !== "Active";
    return true;
  }, [getActivityState]);

  const filteredSessions = sessions.filter((session) => matchesSessionFilter(session, sessionFilter));
  const filteredSessionIds = new Set(filteredSessions.map((s) => s.id));

  // Filter events: cascade from session filter, then apply event filter
  const filteredEvents = events.filter((event) => {
    // If session filter is active, only show events from visible sessions
    if (sessionFilter !== "all" && !filteredSessionIds.has(event.sessionId)) {
      return false;
    }
    return matchesEventFilter(event.eventType, event.toolName, eventFilter);
  });

  // Group filtered events by date
  const groupedEvents = filteredEvents.reduce(
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
    <div className="space-y-6 overflow-hidden">
      <div className="flex items-start justify-between gap-2 flex-wrap">
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

      <div className="grid gap-6 lg:grid-cols-3 overflow-hidden">
        {/* Recent Sessions */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Clock className="h-5 w-5 mr-2" />
              Recent Sessions
            </CardTitle>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {sessionFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = sessionFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    onClick={() => setSessionFilter(filter.value)}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Icon className={`h-3 w-3 mr-1 ${filter.value === "working" && isActive ? "animate-spin" : ""}`} />
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 overflow-hidden">
            {filteredSessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {sessions.length === 0 ? "No sessions yet" : "No matching sessions"}
              </p>
            ) : (
              filteredSessions.slice(0, 10).map((session) => {
                const activityState = getActivityState(session.id, session.status);
                const shouldPulse = highlightType && activityState === highlightType;
                const shouldStatsHover = hoverHighlightType && activityState === hoverHighlightType;
                const isEventHovered = hoveredEventSessionId === session.id;
                const isHighlighted = isEventHovered || shouldStatsHover;
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className={`block p-3 rounded-lg border transition-colors overflow-hidden ${
                      glowingSessionIds.has(session.id) ? "realtime-glow" : ""
                    } ${activityState === "waiting" && !isHighlighted ? "border-amber-400 dark:border-amber-500" : ""} ${
                      shouldPulse ? `highlight-pulse-${highlightType}` : ""
                    } ${isHighlighted ? "bg-amber-100 dark:bg-amber-900/30 border-amber-400" : "hover:border-primary/50"}`}
                    onMouseEnter={() => setHoveredSessionId(session.id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm break-words min-w-0">
                          {session.title ||
                            `Session ${session.localSessionId.slice(0, 8)}`}
                        </p>
                        {activityState === "waiting" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                            <MessageSquareMore className="h-3 w-3 mr-0.5" />
                            Needs input
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
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Activity className="h-5 w-5 mr-2" />
              Activity Timeline
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-3">
              {eventFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = eventFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    onClick={() => setEventFilter(filter.value)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Icon className="h-3 w-3 mr-1.5" />
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {filteredEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {events.length === 0
                  ? "No events yet. Start using Claude Code to see your activity here."
                  : `No ${eventFilter === "all" ? "" : eventFilter + " "}events found.`}
              </p>
            ) : (
              <div className="space-y-6 overflow-hidden">
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
                            className={`flex items-start pl-8 relative rounded-lg transition-colors duration-200 min-w-0 ${
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
                                : event.eventType === "session_start"
                                ? "border-green-500 bg-green-100 dark:bg-green-900/30"
                                : event.eventType === "user_prompt"
                                ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30"
                                : event.eventType === "permission_request"
                                ? "border-amber-500 bg-amber-100 dark:bg-amber-900/30"
                                : (event.eventType === "tool_use" || event.eventType === "tool_use_start") && event.toolName?.toLowerCase() === "askuserquestion"
                                ? "border-amber-500 bg-amber-100 dark:bg-amber-900/30"
                                : event.eventType === "tool_use" || event.eventType === "tool_use_start"
                                ? "border-purple-500 bg-purple-100 dark:bg-purple-900/30"
                                : event.eventType === "context_compaction"
                                ? "border-orange-500 bg-orange-100 dark:bg-orange-900/30"
                                : isHighlighted ? "border-amber-500 bg-amber-200 dark:bg-amber-800" : "border-primary bg-background"
                            }`}>
                              {event.eventType === "session_end" ? (
                                <Square className="h-3 w-3 text-red-500" />
                              ) : event.eventType === "stop" ? (
                                <Square className="h-3 w-3 text-gray-500" />
                              ) : event.eventType === "session_start" ? (
                                <Play className="h-3 w-3 text-green-500" />
                              ) : event.eventType === "user_prompt" ? (
                                <MessageSquare className="h-3 w-3 text-blue-500" />
                              ) : event.eventType === "permission_request" ? (
                                <ShieldAlert className="h-3 w-3 text-amber-500" />
                              ) : (event.eventType === "tool_use" || event.eventType === "tool_use_start") && event.toolName?.toLowerCase() === "askuserquestion" ? (
                                <MessageSquareMore className="h-3 w-3 text-amber-500" />
                              ) : event.eventType === "tool_use" || event.eventType === "tool_use_start" ? (
                                <Wrench className="h-3 w-3 text-purple-500" />
                              ) : event.eventType === "context_compaction" ? (
                                <RefreshCw className="h-3 w-3 text-orange-500" />
                              ) : (
                                <Activity className="h-3 w-3 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {event.eventType === "session_end" ? (
                                  <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:border-red-700 dark:text-red-300">
                                    Session ended
                                  </Badge>
                                ) : event.eventType === "stop" ? (
                                  <Badge variant="outline" className="text-xs">
                                    Session paused
                                  </Badge>
                                ) : event.eventType === "session_start" ? (
                                  <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-300">
                                    Session started
                                  </Badge>
                                ) : event.eventType === "user_prompt" ? (
                                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                                    User prompt
                                  </Badge>
                                ) : event.eventType === "permission_request" ? (
                                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                                    Permission needed
                                  </Badge>
                                ) : event.eventType === "context_compaction" ? (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300">
                                    Compaction
                                  </Badge>
                                ) : (event.eventType === "tool_use" || event.eventType === "tool_use_start") && event.toolName ? (
                                  <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300">
                                    {event.toolName}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {event.eventType}
                                  </Badge>
                                )}
                                {(() => {
                                  // Special handling for AskUserQuestion
                                  if (event.toolName?.toLowerCase() === "askuserquestion") {
                                    const question = getToolDisplayInfo(event.toolName, event.metadata);
                                    const answer = getAskUserAnswer(event.toolName, event.metadata);
                                    const isWaiting = event.eventType === "tool_use_start";
                                    return (
                                      <div className="flex flex-col gap-1 min-w-0">
                                        {question && (
                                          <span className="text-xs text-muted-foreground italic break-words">
                                            &quot;{question}&quot;
                                          </span>
                                        )}
                                        {isWaiting ? (
                                          <span className="text-xs text-amber-600 dark:text-amber-400">
                                            Waiting for response...
                                          </span>
                                        ) : answer ? (
                                          <span className="text-xs text-green-600 dark:text-green-400 break-words">
                                            → {answer}
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  }

                                  // Special handling for permission requests
                                  if (event.eventType === "permission_request") {
                                    const permInfo = getPermissionRequestInfo(event.eventType, event.toolName, event.metadata);
                                    if (permInfo) {
                                      return (
                                        <div className="flex flex-col gap-1 min-w-0">
                                          <span className="text-xs text-muted-foreground break-words">
                                            {permInfo.tool}{permInfo.action ? `: ${permInfo.action}` : ""}
                                          </span>
                                          <span className="text-xs text-amber-600 dark:text-amber-400">
                                            Waiting for approval...
                                          </span>
                                        </div>
                                      );
                                    }
                                  }

                                  const toolInfo = getToolDisplayInfo(event.toolName, event.metadata);
                                  if (toolInfo) {
                                    return (
                                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded block truncate max-w-[200px] sm:max-w-[300px] md:max-w-full">
                                        {toolInfo}
                                      </code>
                                    );
                                  }
                                  // Fall back to summary for non-tool events (like user_prompt)
                                  if (event.eventType !== "tool_use" && event.eventType !== "tool_use_start" && event.summary) {
                                    return (
                                      <span className="text-xs text-muted-foreground truncate block max-w-[200px] sm:max-w-[300px] md:max-w-full">
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
