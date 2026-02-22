"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Folder, Activity, GripVertical, Plus, X, Users } from "lucide-react";
import { apiClient, type Team, type TeamDetail, type TeamSession } from "@/lib/api-client";
import type { SessionStatus } from "@/types";

interface WhiteboardSession {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  status: SessionStatus;
  lastActivityAt: string;
  eventCount: number;
  memberName?: string;
  memberImage?: string | null;
}

interface Group {
  id: string;
  name: string;
  sessions: string[];
  position: { x: number; y: number };
  color: string;
}

const statusColors: Record<SessionStatus, "default" | "success" | "warning" | "secondary"> = {
  Active: "success",
  Paused: "warning",
  Completed: "default",
  Archived: "secondary",
};

const groupColors = [
  "bg-blue-500/10 border-blue-500/30",
  "bg-green-500/10 border-green-500/30",
  "bg-purple-500/10 border-purple-500/30",
  "bg-orange-500/10 border-orange-500/30",
  "bg-pink-500/10 border-pink-500/30",
];

export default function WhiteboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamParam = searchParams.get("team");

  const [sessions, setSessions] = useState<WhiteboardSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const { toast } = useToast();

  const isTeamMode = !!teamParam;
  const groupsKey = teamParam ? `llmwhiteboard-groups-team-${teamParam}` : "llmwhiteboard-groups";

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
    router.push(`/whiteboard?${params.toString()}`);
  };

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        if (teamParam) {
          const memberId = selectedMemberId === "all" ? undefined : selectedMemberId;
          const data = await apiClient.getTeamSessions(teamParam, { memberId, limit: 50 });
          setSessions(data.sessions || []);
        } else {
          const data = await apiClient.getSessions({ limit: 50 });
          setSessions(data.sessions || []);
        }

        // Load saved groups from localStorage (scoped by context)
        const savedGroups = localStorage.getItem(groupsKey);
        if (savedGroups) {
          setGroups(JSON.parse(savedGroups));
        } else {
          setGroups([]);
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
    };

    fetchSessions();
  }, [teamParam, selectedMemberId, groupsKey, toast]);

  const saveGroups = useCallback((newGroups: Group[]) => {
    setGroups(newGroups);
    localStorage.setItem(groupsKey, JSON.stringify(newGroups));
  }, [groupsKey]);

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

    const newGroups = groups.map((g) => ({
      ...g,
      sessions: g.sessions.filter((s) => s !== draggedSession),
    }));

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

  const currentTeam = teams.find((t) => t.id === teamParam);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Whiteboard</h1>
          <p className="text-muted-foreground">
            {isTeamMode && currentTeam
              ? `Organize ${currentTeam.name} sessions visually`
              : "Organize and group your sessions visually"}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
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
          <Button onClick={addGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>
      </div>

      {/* Custom Groups */}
      {groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const groupSessions = sessions.filter((s) =>
              group.sessions.includes(s.id)
            );
            return (
              <Card
                key={group.id}
                className={`${group.color} border-2 overflow-hidden`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(group.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg break-words min-w-0">{group.name}</CardTitle>
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
                        showMember={isTeamMode}
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
          <Card key={project} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg min-w-0">
                <Folder className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                <span className="break-words">{project}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projectSessions.map((session) => (
                  <SessionMiniCard
                    key={session.id}
                    session={session}
                    onDragStart={handleDragStart}
                    showMember={isTeamMode}
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
            <h3 className="mt-4 text-lg font-medium">
              {isTeamMode ? "No team sessions yet" : "No sessions yet"}
            </h3>
            <p className="text-muted-foreground mt-2">
              {isTeamMode
                ? "Team members need to use tokens scoped to this team"
                : "Start using Claude Code to see your sessions here"}
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
  showMember,
}: {
  session: WhiteboardSession;
  onDragStart: (id: string) => void;
  showMember?: boolean;
}) {
  return (
    <div
      className="flex items-start p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors overflow-hidden"
    >
      <div
        draggable
        onDragStart={() => onDragStart(session.id)}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground mr-2 mt-0.5 flex-shrink-0" />
      </div>
      <Link href={`/sessions/${session.id}`} className="min-w-0 flex-1 overflow-hidden" draggable={false}>
        <div className="space-y-1">
          {showMember && session.memberName && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-4 w-4">
                <AvatarImage src={session.memberImage || undefined} />
                <AvatarFallback className="text-[8px]">{session.memberName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">{session.memberName}</span>
            </div>
          )}
          <p className="font-medium text-sm break-words">
            {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
          </p>
          <Badge
            variant={statusColors[session.status] || "default"}
            className="text-xs"
          >
            {session.status || "Unknown"}
          </Badge>
        </div>
        <div className="flex items-center text-xs text-muted-foreground mt-2 flex-wrap gap-1">
          <span className="flex items-center">
            <Activity className="h-3 w-3 mr-1 flex-shrink-0" />
            {session.eventCount} events
          </span>
          <span>·</span>
          <span>{formatRelativeTime(new Date(session.lastActivityAt))}</span>
        </div>
      </Link>
    </div>
  );
}
