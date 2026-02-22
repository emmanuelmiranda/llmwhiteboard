"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SessionCard } from "@/components/SessionCard";
import { useToast } from "@/components/ui/use-toast";
import { computeActivityState } from "@/lib/session-utils";
import {
  Search, LayoutGrid, List, Inbox, Sparkles, Bot, Loader2, MessageSquareMore,
  Clock, Pause, CheckCircle, Archive, ArrowUpDown, ArrowDown, ArrowUp, Users,
} from "lucide-react";
import { apiClient, type Session, type Team, type TeamSession, type TeamDetail } from "@/lib/api-client";
import { useSignalRContext } from "@/components/signalr-provider";
import { ConnectionStatus } from "@/components/connection-status";
import { ActivityStats } from "@/components/activity-stats";

export default function SessionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamParam = searchParams.get("team");

  const [sessions, setSessions] = useState<(Session | TeamSession)[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [cliFilter, setCliFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("lastActive");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const { toast } = useToast();
  const {
    onSessionCreated,
    onSessionUpdated,
    onSessionDeleted,
    onNewEvent,
    highlightType,
    hoverHighlightType,
    updateSessionActivityState,
  } = useSignalRContext();

  const isTeamMode = !!teamParam;

  // Fetch teams for context switcher
  useEffect(() => {
    apiClient.getTeams().then((data) => setTeams(data.teams || [])).catch(() => {});
  }, []);

  // Fetch team detail when in team mode (for member list)
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
    router.push(`/sessions?${params.toString()}`);
  };

  // Add glow effect temporarily
  const addGlow = useCallback((id: string) => {
    setGlowingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setGlowingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }, []);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      if (teamParam) {
        // Team mode
        const memberId = selectedMemberId === "all" ? undefined : selectedMemberId;
        const data = await apiClient.getTeamSessions(teamParam, { memberId });
        setSessions(data.sessions || []);
      } else {
        // Personal mode
        let apiStatus: string | undefined;
        if (stateFilter === "paused") apiStatus = "Paused";
        else if (stateFilter === "completed") apiStatus = "Completed";
        else if (stateFilter === "archived") apiStatus = "Archived";
        else if (stateFilter === "working" || stateFilter === "waiting" || stateFilter === "idle") apiStatus = "Active";

        const data = await apiClient.getSessions({
          search: search || undefined,
          status: apiStatus,
          cliType: cliFilter !== "all" ? cliFilter : undefined,
        });
        setSessions(data.sessions || []);

        // Initialize activity state from API data
        for (const session of data.sessions || []) {
          if (session.lastEventType && session.lastEventAt) {
            const eventTime = new Date(session.lastEventAt).getTime();
            updateSessionActivityState(session.id, session.lastEventType, session.lastEventToolName, eventTime);
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [teamParam, selectedMemberId, search, stateFilter, cliFilter, toast, updateSessionActivityState]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Subscribe to real-time session updates (personal mode only)
  useEffect(() => {
    if (isTeamMode) return;

    const unsubscribeCreated = onSessionCreated((newSession) => {
      setSessions((prev) => {
        if (prev.some((s) => s.id === newSession.id)) return prev;
        return [newSession, ...prev];
      });
      addGlow(newSession.id);
      updateSessionActivityState(newSession.id, "session_start");
    });

    const unsubscribeUpdated = onSessionUpdated((updatedSession) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
      );
      addGlow(updatedSession.id);
    });

    const unsubscribeDeleted = onSessionDeleted((sessionId) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    });

    const unsubscribeNewEvent = onNewEvent((event) => {
      updateSessionActivityState(event.sessionId, event.eventType, event.toolName);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === event.sessionId
            ? {
                ...s,
                lastEventType: event.eventType,
                lastEventToolName: event.toolName,
                lastEventAt: new Date().toISOString(),
              }
            : s
        )
      );
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeNewEvent();
    };
  }, [isTeamMode, onSessionCreated, onSessionUpdated, onSessionDeleted, onNewEvent, addGlow, updateSessionActivityState]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSessions();
  };

  const currentTeam = teams.find((t) => t.id === teamParam);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            {isTeamMode && currentTeam
              ? `Team sessions for ${currentTeam.name}`
              : "View and manage your LLM CLI sessions"}
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
                <SelectItem value="personal">My Sessions</SelectItem>
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
          {/* Member filter (team mode only) */}
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
          {!isTeamMode && <ConnectionStatus />}
        </div>
      </div>

      {!isTeamMode && (
        <div className="p-3 rounded-lg border bg-card">
          <ActivityStats />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px]">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="working">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 text-blue-500" />
                  Working
                </span>
              </SelectItem>
              <SelectItem value="waiting">
                <span className="flex items-center gap-1.5">
                  <MessageSquareMore className="h-3.5 w-3.5 text-amber-500" />
                  Waiting
                </span>
              </SelectItem>
              <SelectItem value="idle">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-500" />
                  Idle
                </span>
              </SelectItem>
              <SelectItem value="paused">
                <span className="flex items-center gap-1.5">
                  <Pause className="h-3.5 w-3.5 text-yellow-500" />
                  Paused
                </span>
              </SelectItem>
              <SelectItem value="completed">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  Completed
                </span>
              </SelectItem>
              <SelectItem value="archived">
                <span className="flex items-center gap-1.5">
                  <Archive className="h-3.5 w-3.5 text-gray-400" />
                  Archived
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={cliFilter} onValueChange={setCliFilter}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]">
              <SelectValue placeholder="CLI Tool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CLIs</SelectItem>
              <SelectItem value="claude-code">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                  Claude
                </span>
              </SelectItem>
              <SelectItem value="gemini-cli">
                <span className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-blue-500" />
                  Gemini
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 w-full sm:w-auto">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-[150px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastActive">Last Active</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="created">Created</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
              title={sortDir === "desc" ? "Descending (newest/largest first)" : "Ascending (oldest/smallest first)"}
            >
              {sortDir === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            {isTeamMode ? "No team sessions yet" : "No sessions yet"}
          </h3>
          <p className="text-muted-foreground mt-2">
            {search
              ? "No sessions match your search"
              : isTeamMode
              ? "Team members need to use tokens scoped to this team"
              : "Run the CLI to sync your first session"}
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              : "space-y-4"
          }
        >
          {sessions
            .slice()
            .sort((a, b) => {
              let comparison = 0;
              switch (sortBy) {
                case "size":
                  comparison = (a.transcriptSizeBytes || 0) - (b.transcriptSizeBytes || 0);
                  break;
                case "events":
                  comparison = (a.eventCount || 0) - (b.eventCount || 0);
                  break;
                case "created":
                  comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                  break;
                case "lastActive":
                default:
                  comparison = new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime();
                  break;
              }
              return sortDir === "desc" ? -comparison : comparison;
            })
            .map((session) => {
              const activityState = computeActivityState(session);
              const unifiedState = session.status === "Active"
                ? activityState
                : session.status.toLowerCase();
              return { session, activityState, unifiedState };
            })
            .filter(({ unifiedState }) => {
              if (stateFilter === "all") return true;
              return unifiedState === stateFilter;
            })
            .map(({ session, activityState }) => {
              const teamSession = isTeamMode ? (session as TeamSession) : null;
              const shouldPulse = !isTeamMode && highlightType && activityState === highlightType;
              const shouldHoverHighlight = !isTeamMode && hoverHighlightType && activityState === hoverHighlightType;
              return (
                <div
                  key={session.id}
                  className={`rounded-lg transition-colors ${glowingIds.has(session.id) ? "realtime-glow" : ""} ${
                    shouldPulse ? `highlight-pulse-${highlightType}` : ""
                  } ${shouldHoverHighlight ? (hoverHighlightType === "waiting" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-blue-100 dark:bg-blue-900/30") : ""}`}
                >
                  <SessionCard
                    session={session}
                    activityState={activityState}
                    memberName={teamSession?.memberName}
                    memberImage={teamSession?.memberImage}
                  />
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
