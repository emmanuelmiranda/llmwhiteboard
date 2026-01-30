"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionCard, type SessionActivityState } from "@/components/SessionCard";
import { useToast } from "@/components/ui/use-toast";
import { Search, LayoutGrid, List, Inbox, Sparkles, Bot, Loader2, MessageSquareMore, Clock, Pause, CheckCircle, Archive } from "lucide-react";
import { apiClient, type Session } from "@/lib/api-client";

// Compute activity state from session's last event data
// This is used for initial render before SignalR context is updated
function computeActivityStateFromSession(session: Session): "working" | "waiting" | "idle" {
  if (session.status !== "Active") return "idle";

  const eventType = session.lastEventType?.toLowerCase();
  const toolName = session.lastEventToolName;
  const eventTime = session.lastEventAt ? new Date(session.lastEventAt).getTime() : null;

  if (!eventType || !eventTime) return "idle";

  // Time thresholds
  const IDLE_THRESHOLD_DEFAULT = 5 * 60 * 1000; // 5 minutes
  const IDLE_THRESHOLD_USER_PROMPT = 60 * 1000; // 1 minute for user_prompt

  const threshold = eventType === "user_prompt" ? IDLE_THRESHOLD_USER_PROMPT : IDLE_THRESHOLD_DEFAULT;
  const timeSinceEvent = Date.now() - eventTime;

  // Check if too old
  if (timeSinceEvent > threshold) return "idle";

  // Session stopped or ended = idle
  if (eventType === "stop" || eventType === "session_end" || eventType === "agent_stop") {
    return "idle";
  }

  // Permission request = waiting
  if (eventType === "permission_request") {
    return "waiting";
  }

  // AskUserQuestion tool_use_start = waiting (question asked, waiting for answer)
  // tool_use = answer received, so that's "working"
  if (eventType === "tool_use_start" && toolName?.toLowerCase() === "askuserquestion") {
    return "waiting";
  }

  // Everything else = working
  return "working";
}
import { useSignalRContext } from "@/components/signalr-provider";
import { ConnectionStatus } from "@/components/connection-status";
import { ActivityStats } from "@/components/activity-stats";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Unified state filter: working/waiting/idle (hook-driven) + paused/completed/archived (manual)
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [cliFilter, setCliFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
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

  // Add glow effect to an item temporarily
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
      // Map state filter to API status filter
      // working/waiting/idle = Active sessions (filtered client-side)
      // paused/completed/archived = direct database status
      let apiStatus: string | undefined;
      if (stateFilter === "paused") apiStatus = "Paused";
      else if (stateFilter === "completed") apiStatus = "Completed";
      else if (stateFilter === "archived") apiStatus = "Archived";
      else if (stateFilter === "working" || stateFilter === "waiting" || stateFilter === "idle") apiStatus = "Active";
      // "all" = undefined (fetch all)

      const data = await apiClient.getSessions({
        search: search || undefined,
        status: apiStatus,
        cliType: cliFilter !== "all" ? cliFilter : undefined,
      });
      setSessions(data.sessions || []);

      // Initialize activity state from API data (last event info)
      for (const session of data.sessions || []) {
        if (session.lastEventType && session.lastEventAt) {
          const eventTime = new Date(session.lastEventAt).getTime();
          updateSessionActivityState(session.id, session.lastEventType, session.lastEventToolName, eventTime);
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
  }, [search, stateFilter, cliFilter, toast, updateSessionActivityState]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Subscribe to real-time session updates
  useEffect(() => {
    const unsubscribeCreated = onSessionCreated((newSession) => {
      // Add new session at the top
      setSessions((prev) => {
        // Check if session already exists
        if (prev.some((s) => s.id === newSession.id)) {
          return prev;
        }
        return [newSession, ...prev];
      });
      addGlow(newSession.id);
      // New sessions start as "working"
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
      // Update activity state based on event type
      updateSessionActivityState(event.sessionId, event.eventType, event.toolName);
      // Also update the session's last event info so computeActivityStateFromSession works
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
  }, [onSessionCreated, onSessionUpdated, onSessionDeleted, onNewEvent, addGlow, updateSessionActivityState]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSessions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            View and manage your LLM CLI sessions
          </p>
        </div>
        <ConnectionStatus />
      </div>

      <div className="p-3 rounded-lg border bg-card">
        <ActivityStats />
      </div>

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

        <div className="flex gap-2 flex-wrap">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[130px] sm:w-[150px]">
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
            <SelectTrigger className="w-[120px] sm:w-[140px]">
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
          <h3 className="mt-4 text-lg font-medium">No sessions yet</h3>
          <p className="text-muted-foreground mt-2">
            {search
              ? "No sessions match your search"
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
            .map((session) => {
              // Compute activity state directly from session's last event data
              // This is reliable and doesn't depend on context timing
              const activityState: SessionActivityState = computeActivityStateFromSession(session);

              // Unified state combines activity state with manual statuses (paused, completed, archived)
              const unifiedState = session.status === "Active"
                ? activityState
                : session.status.toLowerCase();
              return { session, activityState, unifiedState };
            })
            .filter(({ unifiedState }) => {
              // Filter by unified state
              if (stateFilter === "all") return true;
              return unifiedState === stateFilter;
            })
            .map(({ session, activityState }) => {
              const shouldPulse = highlightType && activityState === highlightType;
              const shouldHoverHighlight = hoverHighlightType && activityState === hoverHighlightType;
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
                  />
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
