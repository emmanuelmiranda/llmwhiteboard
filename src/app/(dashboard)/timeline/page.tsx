"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import {
  computeActivityState,
  matchesEventFilter,
  matchesSessionFilter,
  eventFilters,
  sessionFilters,
  type EventFilter,
  type SessionFilter,
} from "@/lib/session-utils";
import {
  Activity, Folder, Clock, ArrowRight, Monitor, Loader2, MessageSquareMore,
  Sparkles, Users,
} from "lucide-react";
import { apiClient, type Session, type Team, type TeamDetail, type TeamSession, type SessionEvent, type TeamActivityEvent } from "@/lib/api-client";
import type { SessionStatus } from "@/types";
import { useSignalRContext } from "@/components/signalr-provider";
import { ConnectionStatus } from "@/components/connection-status";
import { ActivityStats } from "@/components/activity-stats";
import { TimelinePixelProgress } from "@/components/pixel-progress";
import { getTimelineEventStyle, getToolDisplayInfo, getAskUserAnswer, getPermissionRequestInfo } from "@/components/events/event-utils";

// Unified event type covering both personal and team events
interface TimelineEvent {
  id: string;
  sessionId: string;
  sessionTitle?: string | null;
  eventType: string;
  toolName: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  memberName?: string;
  memberImage?: string | null;
}

// Unified session type covering both personal and team sessions
interface TimelineSession {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  status: SessionStatus;
  machine: { id: string; machineId: string; name: string | null } | null;
  lastActivityAt: string;
  createdAt: string;
  eventCount: number;
  lastEventType: string | null;
  lastEventToolName: string | null;
  lastEventAt: string | null;
  memberName?: string;
  memberImage?: string | null;
}

const statusColors: Record<SessionStatus, "default" | "success" | "warning" | "secondary"> = {
  Active: "success",
  Paused: "warning",
  Completed: "default",
  Archived: "secondary",
};

export default function TimelinePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamParam = searchParams.get("team");

  const [sessions, setSessions] = useState<TimelineSession[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [glowingSessionIds, setGlowingSessionIds] = useState<Set<string>>(new Set());
  const [glowingEventIds, setGlowingEventIds] = useState<Set<string>>(new Set());
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [hoveredEventSessionId, setHoveredEventSessionId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [showPixelProgress, setShowPixelProgress] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const { toast } = useToast();
  const {
    onSessionCreated,
    onSessionUpdated,
    onNewEvent,
    onTeamSessionCreated,
    onTeamSessionUpdated,
    onTeamNewEvent,
    highlightType,
    hoverHighlightType,
    updateSessionActivityState,
  } = useSignalRContext();

  const isTeamMode = !!teamParam;

  // Fetch teams for context switcher
  useEffect(() => {
    apiClient.getTeams().then((data) => setTeams(data.teams || [])).catch(() => {});
  }, []);

  // Fetch team detail when in team mode
  useEffect(() => {
    if (teamParam) {
      apiClient.getTeamDetail(teamParam).then(setTeamDetail).catch(() => setTeamDetail(null));
    } else {
      setTeamDetail(null);
    }
  }, [teamParam]);

  const setTeamContext = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "personal") {
      params.delete("team");
    } else {
      params.set("team", value);
    }
    setSelectedMemberId("all");
    router.push(`/timeline?${params.toString()}`);
  };

  // Add glow effects
  const addSessionGlow = useCallback((id: string) => {
    setGlowingSessionIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setGlowingSessionIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 2000);
  }, []);

  const addEventGlow = useCallback((id: string) => {
    setGlowingEventIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setGlowingEventIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 2000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (teamParam) {
        const memberId = selectedMemberId === "all" ? undefined : selectedMemberId;
        const [sessionsData, eventsData] = await Promise.all([
          apiClient.getTeamSessions(teamParam, { memberId, limit: 20 }),
          apiClient.getTeamActivity(teamParam, { memberId, limit: 2000 }),
        ]);
        setSessions(sessionsData.sessions || []);
        setEvents(eventsData.events || []);
      } else {
        const [sessionsData, eventsData] = await Promise.all([
          apiClient.getSessions({ limit: 20 }),
          apiClient.getEvents({ limit: 2000 }),
        ]);
        setSessions(sessionsData.sessions || []);
        setEvents(eventsData.events || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load timeline data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [teamParam, selectedMemberId, toast]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Subscribe to real-time updates (personal or team mode)
  useEffect(() => {
    const handleNewEvent = (newEvent: SessionEvent) => {
      setEvents((prev) => {
        if (prev.some((e) => e.id === newEvent.id)) return prev;
        return [newEvent as TimelineEvent, ...prev].slice(0, 50);
      });
      addEventGlow(newEvent.id);
      updateSessionActivityState(newEvent.sessionId, newEvent.eventType, newEvent.toolName);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === newEvent.sessionId
            ? { ...s, lastEventType: newEvent.eventType, lastEventToolName: newEvent.toolName, lastEventAt: new Date().toISOString() }
            : s
        )
      );
    };

    const handleSessionCreated = (newSession: Session) => {
      setSessions((prev) => {
        if (prev.some((s) => s.id === newSession.id)) return prev;
        return [newSession as TimelineSession, ...prev].slice(0, 20);
      });
      addSessionGlow(newSession.id);
      updateSessionActivityState(newSession.id, "session_start");
    };

    const handleSessionUpdated = (updatedSession: Session) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === updatedSession.id ? (updatedSession as TimelineSession) : s))
      );
      addSessionGlow(updatedSession.id);
    };

    if (isTeamMode) {
      // Team mode: subscribe to team events
      const unsubNewEvent = onTeamNewEvent(handleNewEvent);
      const unsubCreated = onTeamSessionCreated(handleSessionCreated);
      const unsubUpdated = onTeamSessionUpdated(handleSessionUpdated);
      return () => { unsubNewEvent(); unsubCreated(); unsubUpdated(); };
    } else {
      // Personal mode: subscribe to personal events
      const unsubNewEvent = onNewEvent(handleNewEvent);
      const unsubCreated = onSessionCreated(handleSessionCreated);
      const unsubUpdated = onSessionUpdated(handleSessionUpdated);
      return () => { unsubNewEvent(); unsubCreated(); unsubUpdated(); };
    }
  }, [isTeamMode, onNewEvent, onSessionCreated, onSessionUpdated, onTeamNewEvent, onTeamSessionCreated, onTeamSessionUpdated, addEventGlow, addSessionGlow, updateSessionActivityState]);

  const filteredSessions = sessions.filter((s) => matchesSessionFilter(s, sessionFilter));
  const filteredSessionIds = new Set(filteredSessions.map((s) => s.id));

  const filteredEvents = events.filter((event) => {
    if (sessionFilter !== "all" && !filteredSessionIds.has(event.sessionId)) return false;
    return matchesEventFilter(event.eventType, event.toolName, eventFilter);
  });

  const groupedEvents = filteredEvents.reduce(
    (groups, event) => {
      const date = new Date(event.createdAt).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
      return groups;
    },
    {} as Record<string, TimelineEvent[]>
  );

  const currentTeam = teams.find((t) => t.id === teamParam);

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
          <h1 className="text-2xl sm:text-3xl font-bold">Timeline</h1>
          <p className="text-muted-foreground">
            {isTeamMode && currentTeam
              ? `Chronological view of ${currentTeam.name} activity`
              : "A chronological view of your session activity"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Context switcher */}
          {teams.length > 0 && (
            <Select value={teamParam || "personal"} onValueChange={setTeamContext}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">My Timeline</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {team.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Member filter (team mode) */}
          {isTeamMode && teamDetail && teamDetail.members.length > 1 && (
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {teamDetail.members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    <span className="flex items-center gap-1.5">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={m.image || undefined} />
                        <AvatarFallback className="text-[8px]">{(m.name || m.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {m.name || m.email}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ConnectionStatus />
        </div>
      </div>

      {!isTeamMode && (
        <div className="p-3 rounded-lg border bg-card">
          <ActivityStats />
        </div>
      )}

      {/* Pixel Progress Visualization Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Session Visualization</p>
            <p className="text-xs text-muted-foreground">Show pixel art progress for active sessions</p>
          </div>
        </div>
        <button
          onClick={() => setShowPixelProgress(!showPixelProgress)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showPixelProgress ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          {showPixelProgress ? 'Hide' : 'Show'}
        </button>
      </div>

      {showPixelProgress && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {isTeamMode ? "Team Activity Visualization" : "Combined Activity Visualization"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="w-full max-w-lg mx-auto" style={{ aspectRatio: '1.6 / 1' }}>
              <TimelinePixelProgress
                events={events}
                size="full"
                soundEnabled={soundEnabled}
                onSoundToggle={setSoundEnabled}
                teamMode={isTeamMode}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
                {sessions.length === 0
                  ? isTeamMode ? "No team sessions yet" : "No sessions yet"
                  : "No matching sessions"}
              </p>
            ) : (
              filteredSessions.slice(0, 10).map((session) => {
                const activityState = computeActivityState(session);
                const shouldPulse = !isTeamMode && highlightType && activityState === highlightType;
                const shouldStatsHover = !isTeamMode && hoverHighlightType && activityState === hoverHighlightType;
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
                      {/* Member attribution (team mode) */}
                      {isTeamMode && session.memberName && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={session.memberImage || undefined} />
                            <AvatarFallback className="text-[8px]">{session.memberName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{session.memberName}</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm break-words min-w-0">
                          {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
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
                        ) : activityState === "idle" && session.status === "Active" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 shrink-0">
                            <Clock className="h-3 w-3 mr-0.5" />
                            Idle
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
                          <span className="break-words">{session.projectPath.split(/[/\\]/).pop()}</span>
                        </span>
                        {session.machine && (
                          <span className="flex items-center">
                            <Monitor className="h-3 w-3 mr-1 shrink-0" />
                            <span className="break-words">{session.machine.name || session.machine.machineId.slice(0, 8)}</span>
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
              <div className="text-center py-8">
                {isTeamMode ? (
                  <>
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground mt-2">
                      {events.length === 0
                        ? "No team activity yet. Team members need to use tokens scoped to this team."
                        : `No ${eventFilter === "all" ? "" : eventFilter + " "}events found.`}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {events.length === 0
                      ? "No events yet. Start using Claude Code to see your activity here."
                      : `No ${eventFilter === "all" ? "" : eventFilter + " "}events found.`}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6 overflow-hidden">
                {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                  <div key={date}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">{date}</h3>
                    <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {dateEvents.map((event) => {
                        const session = sessions.find((s) => s.id === event.sessionId);
                        const sessionActivityState = session ? computeActivityState(session) : "idle";
                        const isSessionHovered = hoveredSessionId === event.sessionId;
                        const isStatsHovered = !isTeamMode && hoverHighlightType && sessionActivityState === hoverHighlightType;
                        const isHighlighted = isSessionHovered || isStatsHovered;
                        const eventStyle = getTimelineEventStyle(event.eventType, event.toolName, event.metadata);
                        const EventIcon = eventStyle.Icon;
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
                              isHighlighted && !eventStyle.circleClass.includes("border-") ? "border-amber-500 bg-amber-200 dark:bg-amber-800" : eventStyle.circleClass
                            }`}>
                              <EventIcon className={`h-3 w-3 ${eventStyle.iconColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-xs ${eventStyle.badgeClass}`}>
                                  {eventStyle.badgeLabel}
                                </Badge>
                                {(() => {
                                  if (event.toolName?.toLowerCase() === "askuserquestion") {
                                    const question = getToolDisplayInfo(event.toolName, event.metadata);
                                    const answer = getAskUserAnswer(event.toolName, event.metadata);
                                    const isWaiting = event.eventType === "tool_use_start";
                                    return (
                                      <div className="flex flex-col gap-1 min-w-0">
                                        {question && <span className="text-xs text-muted-foreground italic break-words">&quot;{question}&quot;</span>}
                                        {isWaiting ? (
                                          <span className="text-xs text-amber-600 dark:text-amber-400">Waiting for response...</span>
                                        ) : answer ? (
                                          <span className="text-xs text-green-600 dark:text-green-400 break-words">&rarr; {answer}</span>
                                        ) : null}
                                      </div>
                                    );
                                  }
                                  if (event.eventType === "permission_request") {
                                    const permInfo = getPermissionRequestInfo(event.eventType, event.toolName, event.metadata);
                                    if (permInfo) {
                                      return (
                                        <div className="flex flex-col gap-1 min-w-0">
                                          <span className="text-xs text-muted-foreground break-words">{permInfo.tool}{permInfo.action ? `: ${permInfo.action}` : ""}</span>
                                          <span className="text-xs text-amber-600 dark:text-amber-400">Waiting for approval...</span>
                                        </div>
                                      );
                                    }
                                  }
                                  const toolInfo = getToolDisplayInfo(event.toolName, event.metadata);
                                  if (toolInfo) {
                                    return <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded block truncate max-w-[200px] sm:max-w-[300px] md:max-w-full">{toolInfo}</code>;
                                  }
                                  if (event.eventType !== "tool_use" && event.eventType !== "tool_use_start" && event.summary) {
                                    return <span className="text-xs text-muted-foreground truncate block max-w-[200px] sm:max-w-[300px] md:max-w-full">{event.summary}</span>;
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="flex items-center mt-1 text-xs text-muted-foreground gap-1.5">
                                {/* Member attribution (team mode) */}
                                {isTeamMode && event.memberName && (
                                  <>
                                    <Avatar className="h-3.5 w-3.5">
                                      <AvatarImage src={event.memberImage || undefined} />
                                      <AvatarFallback className="text-[7px]">{event.memberName.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span>{event.memberName}</span>
                                    <span>&middot;</span>
                                  </>
                                )}
                                <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                                {(session || event.sessionTitle) && (
                                  <>
                                    <ArrowRight className="h-3 w-3" />
                                    <Link href={`/sessions/${event.sessionId}`} className="hover:underline">
                                      {session?.title || event.sessionTitle || event.sessionId.slice(0, 8)}
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
