"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  Settings,
  LogOut,
  Folder,
  Activity,
  Clock,
  Monitor,
  Lock,
  RefreshCw,
  Sparkles,
  Bot,
  Loader2,
  MessageSquareMore,
  Users,
  ArrowLeft,
} from "lucide-react";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { apiClient, type TeamDetail, type TeamSession } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { TeamMembersPanel } from "@/components/team-members-panel";
import { TeamSettingsDialog } from "@/components/team-settings-dialog";
import type { SessionStatus } from "@/types";

type ActivityState = "idle" | "working" | "waiting";

function computeActivityState(session: TeamSession): ActivityState {
  if (session.status !== "Active") return "idle";

  const eventType = session.lastEventType?.toLowerCase();
  const toolName = session.lastEventToolName;
  const eventTime = session.lastEventAt ? new Date(session.lastEventAt).getTime() : null;

  if (!eventType || !eventTime) return "idle";

  const IDLE_THRESHOLD_DEFAULT = 5 * 60 * 1000;
  const IDLE_THRESHOLD_USER_PROMPT = 60 * 1000;

  const threshold = eventType === "user_prompt" ? IDLE_THRESHOLD_USER_PROMPT : IDLE_THRESHOLD_DEFAULT;
  if (Date.now() - eventTime > threshold) return "idle";

  if (eventType === "stop" || eventType === "session_end" || eventType === "agent_stop") return "idle";
  if (eventType === "permission_request") return "waiting";
  if (eventType === "tool_use_start" && toolName?.toLowerCase() === "askuserquestion") return "waiting";

  return "working";
}

const statusColors: Record<SessionStatus, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Archived: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const cliConfig: Record<string, { label: string; icon: typeof Sparkles; className: string }> = {
  "claude-code": {
    label: "Claude",
    icon: Sparkles,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "gemini-cli": {
    label: "Gemini",
    icon: Bot,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
};

const activityConfig: Record<ActivityState, { label: string; icon: typeof Loader2; className: string; animate?: boolean }> = {
  working: {
    label: "Working",
    icon: Loader2,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    animate: true,
  },
  waiting: {
    label: "Needs input",
    icon: MessageSquareMore,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-2 ring-amber-400 ring-offset-1",
  },
  idle: {
    label: "Idle",
    icon: Clock,
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [sessions, setSessions] = useState<TeamSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const isOwner = team?.joinCode != null;
  const currentUserId = user?.id || "";

  const fetchTeam = useCallback(async () => {
    try {
      const data = await apiClient.getTeamDetail(teamId);
      setTeam(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load team",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [teamId, toast]);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const data = await apiClient.getTeamSessions(teamId, {
        memberId: selectedMemberId || undefined,
      });
      setSessions(data.sessions || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSessions(false);
    }
  }, [teamId, selectedMemberId, toast]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleLeaveTeam = async () => {
    if (!confirm("Are you sure you want to leave this team?")) return;

    try {
      await apiClient.leaveTeam(teamId);
      toast({ title: "Left team" });
      router.push("/teams");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave team",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Team not found</h3>
        <Link href="/teams">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teams
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/teams" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
          </div>
          {team.description && (
            <p className="text-muted-foreground">{team.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Owned by {team.ownerName}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner ? (
            <Button variant="outline" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          ) : (
            <Button variant="outline" onClick={handleLeaveTeam}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave Team
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_250px]">
        {/* Sessions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Sessions
            {selectedMemberId && team.members.find(m => m.userId === selectedMemberId) && (
              <span className="text-muted-foreground font-normal">
                {" "}by {team.members.find(m => m.userId === selectedMemberId)?.name || "member"}
              </span>
            )}
          </h2>

          {isLoadingSessions ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                {selectedMemberId ? "No sessions from this member" : "No sessions from team members yet"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sessions.map((session) => {
                const activityState = computeActivityState(session);
                const showActivityState = activityState !== "idle" && session.status === "Active";
                const activityInfo = showActivityState ? activityConfig[activityState] : null;
                const ActivityIcon = activityInfo?.icon;
                const projectName = session.projectPath.split(/[/\\]/).pop() || session.projectPath;
                const cliInfo = cliConfig[session.cliType] || {
                  label: session.cliType,
                  icon: Bot,
                  className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                };
                const CliIcon = cliInfo.icon;

                return (
                  <Link key={session.id} href={`/sessions/${session.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <div className="space-y-2">
                          {/* Member info */}
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={session.memberImage || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {session.memberName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{session.memberName}</span>
                          </div>

                          {/* Title */}
                          <h3 className="font-semibold leading-tight break-words">
                            {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
                          </h3>

                          {/* Project path */}
                          <div className="flex items-start text-sm text-muted-foreground">
                            <Folder className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                            <span className="break-words">{projectName}</span>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {activityInfo && ActivityIcon && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activityInfo.className}`}>
                                <ActivityIcon className={`h-3 w-3 mr-1 ${activityInfo.animate ? "animate-spin" : ""}`} />
                                {activityInfo.label}
                              </span>
                            )}
                            {!activityInfo && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                statusColors[session.status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }`}>
                                {session.status}
                              </span>
                            )}
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cliInfo.className}`}>
                              <CliIcon className="h-3 w-3 mr-0.5" />
                              {cliInfo.label}
                            </span>
                            {session.compactionCount > 0 && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                session.compactionCount >= 5
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : session.compactionCount >= 3
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              }`}>
                                <RefreshCw className="h-3 w-3 mr-0.5" />
                                {session.compactionCount}
                              </span>
                            )}
                            {session.isEncrypted && (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {session.description && (
                          <p className="text-sm text-muted-foreground">
                            {truncate(session.description, 100)}
                          </p>
                        )}

                        {session.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {session.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {session.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{session.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                          <span className="flex items-center">
                            <Activity className="h-3 w-3 mr-1 flex-shrink-0" />
                            {session.eventCount} events
                          </span>
                          {session.transcriptSizeBytes > 0 && (
                            <span className="flex items-center">
                              {formatBytes(session.transcriptSizeBytes)}
                            </span>
                          )}
                          {session.machine && (
                            <span className="flex items-center">
                              <Monitor className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="break-words">{session.machine.name || session.machine.machineId.slice(0, 8)}</span>
                            </span>
                          )}
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            {formatRelativeTime(new Date(session.lastActivityAt))}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Members sidebar */}
        <div className="lg:border-l lg:pl-6">
          <TeamMembersPanel
            teamId={teamId}
            members={team.members}
            currentUserId={currentUserId}
            isOwner={isOwner}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            onMemberRemoved={fetchTeam}
          />
        </div>
      </div>

      {showSettings && team && (
        <TeamSettingsDialog
          open={showSettings}
          onClose={() => setShowSettings(false)}
          team={team}
          onUpdated={() => {
            fetchTeam();
            setShowSettings(false);
          }}
          onDeleted={() => router.push("/teams")}
        />
      )}
    </div>
  );
}
