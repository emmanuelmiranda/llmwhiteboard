"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Copy, RefreshCw, Trash2, Check } from "lucide-react";
import { apiClient, type TeamDetail } from "@/lib/api-client";

interface TeamSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  team: TeamDetail;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function TeamSettingsDialog({
  open,
  onClose,
  team,
  onUpdated,
  onDeleted,
}: TeamSettingsDialogProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await apiClient.updateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast({ title: "Team updated" });
      onUpdated();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update team",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateCode = async () => {
    setIsRegenerating(true);
    try {
      await apiClient.regenerateJoinCode(team.id);
      toast({
        title: "Join code regenerated",
        description: "The old join code is no longer valid.",
      });
      onUpdated();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to regenerate join code",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiClient.deleteTeam(team.id);
      toast({ title: "Team deleted" });
      onDeleted();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete team",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const copyJoinCode = () => {
    if (team.joinCode) {
      navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      toast({ title: "Copied", description: "Join code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>Team Settings</CardTitle>
          <CardDescription>
            Manage your team settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Edit team info */}
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Team Name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-description">Description</Label>
              <Input
                id="settings-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>

          {/* Join code management */}
          {team.joinCode && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Join Code</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm break-all">
                  {team.joinCode}
                </code>
                <Button variant="ghost" size="icon" onClick={copyJoinCode}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateCode}
                disabled={isRegenerating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                {isRegenerating ? "Regenerating..." : "Regenerate Code"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Regenerating will invalidate the current code.
              </p>
            </div>
          )}

          {/* Danger zone */}
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium text-destructive">Danger Zone</p>
            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Team
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This will permanently delete the team and remove all members. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
