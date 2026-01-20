"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { Folder, Activity, GripVertical, Plus, X } from "lucide-react";
import type { SessionStatus } from "@/types";

interface WhiteboardSession {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  status: SessionStatus;
  lastActivityAt: string;
  eventCount: number;
}

interface Group {
  id: string;
  name: string;
  sessions: string[];
  position: { x: number; y: number };
  color: string;
}

const statusColors: Record<SessionStatus, "default" | "success" | "warning" | "secondary"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "default",
  ARCHIVED: "secondary",
};

const groupColors = [
  "bg-blue-500/10 border-blue-500/30",
  "bg-green-500/10 border-green-500/30",
  "bg-purple-500/10 border-purple-500/30",
  "bg-orange-500/10 border-orange-500/30",
  "bg-pink-500/10 border-pink-500/30",
];

export default function WhiteboardPage() {
  const [sessions, setSessions] = useState<WhiteboardSession[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/sessions?limit=50");
        const data = await res.json();
        setSessions(data.sessions || []);

        // Load saved groups from localStorage
        const savedGroups = localStorage.getItem("llmwhiteboard-groups");
        if (savedGroups) {
          setGroups(JSON.parse(savedGroups));
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load sessions",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [toast]);

  const saveGroups = useCallback((newGroups: Group[]) => {
    setGroups(newGroups);
    localStorage.setItem("llmwhiteboard-groups", JSON.stringify(newGroups));
  }, []);

  const addGroup = () => {
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: `Group ${groups.length + 1}`,
      sessions: [],
      position: { x: 100 + groups.length * 50, y: 100 + groups.length * 50 },
      color: groupColors[groups.length % groupColors.length],
    };
    saveGroups([...groups, newGroup]);
  };

  const removeGroup = (groupId: string) => {
    saveGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleDragStart = (sessionId: string) => {
    setDraggedSession(sessionId);
  };

  const handleDrop = (groupId: string) => {
    if (!draggedSession) return;

    // Remove from other groups
    const newGroups = groups.map((g) => ({
      ...g,
      sessions: g.sessions.filter((s) => s !== draggedSession),
    }));

    // Add to target group
    const targetGroup = newGroups.find((g) => g.id === groupId);
    if (targetGroup && !targetGroup.sessions.includes(draggedSession)) {
      targetGroup.sessions.push(draggedSession);
    }

    saveGroups(newGroups);
    setDraggedSession(null);
  };

  // Get ungrouped sessions
  const groupedSessionIds = new Set(groups.flatMap((g) => g.sessions));
  const ungroupedSessions = sessions.filter((s) => !groupedSessionIds.has(s.id));

  // Group sessions by project
  const sessionsByProject = ungroupedSessions.reduce(
    (acc, session) => {
      const project = session.projectPath.split(/[/\\]/).pop() || session.projectPath;
      if (!acc[project]) {
        acc[project] = [];
      }
      acc[project].push(session);
      return acc;
    },
    {} as Record<string, WhiteboardSession[]>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Whiteboard</h1>
          <p className="text-muted-foreground">
            Organize and group your sessions visually
          </p>
        </div>
        <Button onClick={addGroup}>
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      </div>

      {/* Custom Groups */}
      {groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const groupSessions = sessions.filter((s) =>
              group.sessions.includes(s.id)
            );
            return (
              <Card
                key={group.id}
                className={`${group.color} border-2`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(group.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeGroup(group.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 min-h-[100px]">
                  {groupSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Drag sessions here
                    </p>
                  ) : (
                    groupSessions.map((session) => (
                      <SessionMiniCard
                        key={session.id}
                        session={session}
                        onDragStart={handleDragStart}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sessions by Project */}
      <div className="space-y-6">
        {Object.entries(sessionsByProject).map(([project, projectSessions]) => (
          <Card key={project}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <Folder className="h-5 w-5 mr-2 text-muted-foreground" />
                {project}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {projectSessions.map((session) => (
                  <SessionMiniCard
                    key={session.id}
                    session={session}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sessions.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Folder className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No sessions yet</h3>
            <p className="text-muted-foreground mt-2">
              Start using Claude Code to see your sessions here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionMiniCard({
  session,
  onDragStart,
}: {
  session: WhiteboardSession;
  onDragStart: (id: string) => void;
}) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      draggable
      onDragStart={() => onDragStart(session.id)}
      className="block p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start">
        <GripVertical className="h-4 w-4 text-muted-foreground mr-2 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm truncate">
              {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
            </p>
            <Badge
              variant={statusColors[session.status]}
              className="ml-2 text-xs"
            >
              {session.status}
            </Badge>
          </div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            <Activity className="h-3 w-3 mr-1" />
            <span>{session.eventCount} events</span>
            <span className="mx-1">·</span>
            <span>{formatRelativeTime(new Date(session.lastActivityAt))}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
