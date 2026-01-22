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
import { Search, LayoutGrid, List, Inbox, Sparkles, Bot } from "lucide-react";
import { apiClient, type Session } from "@/lib/api-client";
import { useSignalRContext } from "@/components/signalr-provider";
import { ConnectionStatus } from "@/components/connection-status";
import { ActivityStats } from "@/components/activity-stats";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    getSessionActivityState,
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
      const data = await apiClient.getSessions({
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        cliType: cliFilter !== "all" ? cliFilter : undefined,
      });
      setSessions(data.sessions || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, cliFilter, toast]);

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
      updateSessionActivityState(event.sessionId, event.eventType);
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Paused">Paused</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
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
          {sessions.map((session) => {
            // Only show activity state for active sessions
            const activityState = session.status === "Active" ? getSessionActivityState(session.id) : "idle";
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
