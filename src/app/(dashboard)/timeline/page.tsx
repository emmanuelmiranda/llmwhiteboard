"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, Folder, Clock, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { SessionStatus } from "@/types";

interface TimelineSession {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  status: SessionStatus;
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
  createdAt: string;
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
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
    };

    fetchData();
  }, [toast]);

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
      <div>
        <h1 className="text-3xl font-bold">Timeline</h1>
        <p className="text-muted-foreground">
          A chronological view of your session activity
        </p>
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
              sessions.slice(0, 10).map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block p-3 rounded-lg border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {session.title ||
                          `Session ${session.localSessionId.slice(0, 8)}`}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Folder className="h-3 w-3 mr-1" />
                        <span className="truncate">
                          {session.projectPath.split(/[/\\]/).pop()}
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusColors[session.status]} className="ml-2 text-xs">
                      {session.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {formatRelativeTime(new Date(session.lastActivityAt))}
                  </div>
                </Link>
              ))
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
                        return (
                          <div key={event.id} className="flex items-start pl-8 relative">
                            <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                              <Activity className="h-3 w-3 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {event.eventType}
                                </Badge>
                                {event.toolName && (
                                  <span className="text-xs text-muted-foreground">
                                    {event.toolName}
                                  </span>
                                )}
                              </div>
                              {event.summary && (
                                <p className="text-sm text-muted-foreground mt-1 truncate">
                                  {event.summary}
                                </p>
                              )}
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
