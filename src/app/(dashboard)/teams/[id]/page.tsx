"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Settings,
  LogOut,
  Activity,
  Clock,
  Users,
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";
import { apiClient, type TeamDetail } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { TeamMembersPanel } from "@/components/team-members-panel";
import { TeamSettingsDialog } from "@/components/team-settings-dialog";

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

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

      {/* Quick links to unified views */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/sessions?team=${teamId}`}>
          <div className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Sessions</p>
              <p className="text-sm text-muted-foreground">View all team sessions</p>
            </div>
          </div>
        </Link>
        <Link href={`/timeline?team=${teamId}`}>
          <div className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Timeline</p>
              <p className="text-sm text-muted-foreground">Chronological team activity</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Members */}
      <TeamMembersPanel
        teamId={teamId}
        members={team.members}
        currentUserId={currentUserId}
        isOwner={isOwner}
        selectedMemberId={null}
        onSelectMember={() => {}}
        onMemberRemoved={fetchTeam}
      />

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
