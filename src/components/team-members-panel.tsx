"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { UserMinus } from "lucide-react";
import { apiClient, type TeamMember } from "@/lib/api-client";

interface TeamMembersPanelProps {
  teamId: string;
  members: TeamMember[];
  currentUserId: string;
  isOwner: boolean;
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  onMemberRemoved: () => void;
}

export function TeamMembersPanel({
  teamId,
  members,
  currentUserId,
  isOwner,
  selectedMemberId,
  onSelectMember,
  onMemberRemoved,
}: TeamMembersPanelProps) {
  const { toast } = useToast();

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return;

    try {
      await apiClient.removeMember(teamId, userId);
      toast({
        title: "Member removed",
        description: `${memberName} has been removed from the team.`,
      });
      onMemberRemoved();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Members ({members.length})</h3>
        {selectedMemberId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6"
            onClick={() => onSelectMember(null)}
          >
            Clear filter
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {members.map((member) => {
          const displayName = member.name || member.email || "Unknown";
          const isSelected = selectedMemberId === member.userId;

          return (
            <div
              key={member.id}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted"
              }`}
              onClick={() => onSelectMember(isSelected ? null : member.userId)}
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={member.image || undefined} alt={displayName} />
                <AvatarFallback className="text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
              </div>
              {member.role === "Owner" && (
                <Badge variant="outline" className="text-xs shrink-0">
                  Owner
                </Badge>
              )}
              {isOwner && member.userId !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveMember(member.userId, displayName);
                  }}
                >
                  <UserMinus className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
