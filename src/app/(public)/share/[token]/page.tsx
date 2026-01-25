"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient, type PublicSession, type PublicEvent } from "@/lib/api-client";
import { PublicSignalRProvider, usePublicSignalRContext } from "@/components/public-signalr-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Folder,
  Clock,
  Activity,
  Sparkles,
  Bot,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { PublicSessionPixelProgress } from "@/components/pixel-progress";
import { EventTimeline, type BaseEvent } from "@/components/events";

const cliConfig: Record<string, { label: string; icon: typeof Sparkles; className: string }> = {
  "claude-code": {
    label: "Claude Code",
    icon: Sparkles,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "gemini-cli": {
    label: "Gemini CLI",
    icon: Bot,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
};

interface ShareInfo {
  scope: string;
  visibility: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
}

function PublicSessionView({
  token,
  shareInfo,
}: {
  token: string;
  shareInfo: ShareInfo;
}) {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [glowingEventIds, setGlowingEventIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(false);

  const { onSessionUpdated, onNewEvent, joinSession, leaveSession, connectionState } =
    usePublicSignalRContext();

  const EVENTS_PAGE_SIZE = 50;
  const isFullVisibility = shareInfo.visibility === "Full";

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

  const loadEvents = async (offset: number = 0, append: boolean = false) => {
    if (!shareInfo.sessionId) return;
    setEventsLoading(true);
    try {
      const data = await apiClient.getPublicSessionEvents(token, shareInfo.sessionId, {
        limit: EVENTS_PAGE_SIZE,
        offset,
      });
      if (append) {
        setEvents((prev) => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
      }
      setEventsTotal(data.total);
    } catch {
      setError("Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      if (!shareInfo.sessionId) return;
      try {
        const sessionData = await apiClient.getPublicSession(token, shareInfo.sessionId);
        setSession(sessionData);
        await loadEvents(0);
      } catch {
        setError("Failed to load session");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [token, shareInfo.sessionId]);

  // Join session for real-time updates
  useEffect(() => {
    if (shareInfo.sessionId) {
      joinSession(shareInfo.sessionId);
      return () => {
        leaveSession(shareInfo.sessionId!);
      };
    }
  }, [shareInfo.sessionId, joinSession, leaveSession]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeUpdated = onSessionUpdated((updatedSession) => {
      if (updatedSession.id === shareInfo.sessionId) {
        setSession((prev) => {
          if (!prev) return updatedSession;
          return { ...prev, ...updatedSession };
        });
      }
    });

    const unsubscribeNewEvent = onNewEvent((newEvent) => {
      if (newEvent.sessionId === shareInfo.sessionId) {
        setEvents((prev) => {
          if (prev.some((e) => e.id === newEvent.id)) {
            return prev;
          }
          return [newEvent, ...prev];
        });
        setEventsTotal((prev) => prev + 1);
        addEventGlow(newEvent.id);
      }
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeNewEvent();
    };
  }, [shareInfo.sessionId, onSessionUpdated, onNewEvent, addEventGlow]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{error || "Session not found"}</p>
      </div>
    );
  }

  const cliInfo = cliConfig[session.cliType] || {
    label: session.cliType,
    icon: Bot,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  const CliIcon = cliInfo.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {session.title || "Untitled Session"}
            </h1>
            <Badge variant={isFullVisibility ? "default" : "secondary"}>
              {isFullVisibility ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              {shareInfo.visibility}
            </Badge>
          </div>
          {isFullVisibility && session.projectPath && (
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <Folder className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{session.projectPath}</span>
            </div>
          )}
          {shareInfo.userName && (
            <p className="text-sm text-muted-foreground mt-1">
              Shared by {shareInfo.userName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500"}`} />
          {connectionState === "connected" ? "Live" : connectionState}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                {eventsTotal > 0 ? (
                  <>
                    Showing {events.length} of {eventsTotal} events
                  </>
                ) : (
                  "Activity from this session"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventTimeline
                events={events as BaseEvent[]}
                eventsTotal={eventsTotal}
                eventsLoading={eventsLoading}
                glowingEventIds={glowingEventIds}
                expandedBlocks={expandedBlocks}
                onToggleBlock={(blockId) => {
                  setExpandedBlocks(prev => {
                    const next = new Set(prev);
                    if (next.has(blockId)) {
                      next.delete(blockId);
                    } else {
                      next.add(blockId);
                    }
                    return next;
                  });
                }}
                onLoadMore={() => loadEvents(events.length, true)}
                hasMore={events.length < eventsTotal}
                showFullDetails={isFullVisibility}
                groupIntoBlocks={true}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Pixel Progress Animation */}
          {shareInfo.sessionId && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Session Progress</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PublicSessionPixelProgress
                  token={token}
                  sessionId={shareInfo.sessionId}
                  theme="lego"
                  size="sm"
                  soundEnabled={soundEnabled}
                  onSoundToggle={setSoundEnabled}
                  soundVolume={0.3}
                  showProgress={true}
                  expandable={true}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <CliIcon className="h-4 w-4 mr-2" />
                  CLI Tool
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cliInfo.className}`}>
                  {cliInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Status
                </span>
                <Badge variant={session.status === "Active" ? "default" : "secondary"}>
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Last Activity
                </span>
                <span>{formatRelativeTime(new Date(session.lastActivityAt))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Created
                </span>
                <span>{formatRelativeTime(new Date(session.createdAt))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Events
                </span>
                <span>{eventsTotal}</span>
              </div>
              {isFullVisibility && session.machineName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Machine</span>
                  <span>{session.machineName}</span>
                </div>
              )}
              {isFullVisibility && session.description && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Description</span>
                  <p className="mt-1">{session.description}</p>
                </div>
              )}
              {isFullVisibility && session.tags && session.tags.length > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {session.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {isFullVisibility ? (
                  <Eye className="h-4 w-4 text-green-500" />
                ) : (
                  <EyeOff className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-sm">
                  {isFullVisibility
                    ? "Full access - all details visible"
                    : "Activity only - sensitive details hidden"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PublicFeedView({ token, shareInfo }: { token: string; shareInfo: ShareInfo }) {
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { onSessionUpdated, connectionState } = usePublicSignalRContext();

  const isFullVisibility = shareInfo.visibility === "Full";

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const data = await apiClient.getPublicFeed(token);
        setSessions(data.sessions);
      } catch {
        setError("Failed to load feed");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, [token]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = onSessionUpdated((updatedSession) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === updatedSession.id ? { ...s, ...updatedSession } : s))
      );
    });

    return () => {
      unsubscribe();
    };
  }, [onSessionUpdated]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {shareInfo.userName ? `${shareInfo.userName}'s Activity` : "Shared Activity Feed"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={isFullVisibility ? "default" : "secondary"}>
              {isFullVisibility ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              {shareInfo.visibility}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500"}`} />
          {connectionState === "connected" ? "Live" : connectionState}
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No sessions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const cliInfo = cliConfig[session.cliType] || {
              label: session.cliType,
              icon: Bot,
              className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
            };
            const CliIcon = cliInfo.icon;

            return (
              <Card key={session.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-medium truncate">
                        {session.title || "Untitled Session"}
                      </h3>
                      {isFullVisibility && session.projectPath && (
                        <p className="text-sm text-muted-foreground truncate">
                          <Folder className="h-3 w-3 inline mr-1" />
                          {session.projectPath}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${cliInfo.className}`}>
                          <CliIcon className="h-3 w-3 mr-1" />
                          {cliInfo.label}
                        </span>
                        <span>{session.eventCount} events</span>
                        <span>{formatRelativeTime(new Date(session.lastActivityAt))}</span>
                      </div>
                    </div>
                    <Badge variant={session.status === "Active" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PublicSharePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await apiClient.validateShareToken(token);
        if (!response.valid) {
          setError("This share link is invalid or has expired");
        } else {
          setShareInfo({
            scope: response.scope!,
            visibility: response.visibility!,
            sessionId: response.sessionId,
            userId: response.userId,
            userName: response.userName,
          });
        }
      } catch {
        setError("Failed to validate share link");
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !shareInfo) {
    return (
      <div className="text-center py-24">
        <h1 className="text-2xl font-bold mb-4">Share Link Error</h1>
        <p className="text-muted-foreground mb-6">{error || "Invalid share link"}</p>
        <Button asChild>
          <a href="/">Go to Homepage</a>
        </Button>
      </div>
    );
  }

  return (
    <PublicSignalRProvider token={token}>
      {shareInfo.scope === "Session" && shareInfo.sessionId ? (
        <PublicSessionView token={token} shareInfo={shareInfo} />
      ) : (
        <PublicFeedView token={token} shareInfo={shareInfo} />
      )}
    </PublicSignalRProvider>
  );
}
