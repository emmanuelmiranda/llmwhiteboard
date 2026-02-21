"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Plus, Trash2, Key, Pencil, Users } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { apiClient, type ApiToken, type Team } from "@/lib/api-client";

export default function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("none");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string>("none");
  const { toast } = useToast();

  const fetchTokens = async () => {
    try {
      const data = await apiClient.getTokens();
      setTokens(data.tokens || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load tokens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const data = await apiClient.getTeams();
      setTeams(data.teams || []);
    } catch {
      // silently fail - teams dropdown will just be empty
    }
  };

  useEffect(() => {
    fetchTokens();
    fetchTeams();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;

    setIsCreating(true);
    try {
      const teamId = selectedTeamId === "none" ? undefined : selectedTeamId;
      const data = await apiClient.createToken(newTokenName, teamId);
      setNewToken(data.token);
      setNewTokenName("");
      setSelectedTeamId("none");
      fetchTokens();

      toast({
        title: "Token created",
        description: "Copy your token now - you won't see it again!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create token",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      await apiClient.revokeToken(tokenId);
      setTokens(tokens.filter((t) => t.id !== tokenId));
      toast({
        title: "Token revoked",
        description: "The token has been revoked and can no longer be used",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke token",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTeam = async (tokenId: string) => {
    try {
      const teamId = editTeamId === "none" ? null : editTeamId;
      const updated = await apiClient.updateTokenTeam(tokenId, teamId);
      setTokens(tokens.map((t) => (t.id === tokenId ? updated : t)));
      setEditingTokenId(null);
      toast({
        title: "Token updated",
        description: teamId ? "Token assigned to team" : "Token unassigned from team",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update token",
        variant: "destructive",
      });
    }
  };

  const startEditing = (token: ApiToken) => {
    setEditingTokenId(token.id);
    setEditTeamId(token.teamId || "none");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Token copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Tokens</h1>
        <p className="text-muted-foreground">
          Manage your API tokens for syncing sessions from the CLI
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Token</CardTitle>
          <CardDescription>
            Generate a new API token to sync sessions from a machine.
            {teams.length > 0 && " Assign it to a team to scope sessions to that team's dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {newToken ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Your new API token (copy it now - you won&apos;t see it again):
                </p>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-2 bg-background rounded border text-sm break-all">
                    {newToken}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(newToken)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => setNewToken(null)}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreateToken} className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Label htmlFor="tokenName" className="sr-only">
                    Token name
                  </Label>
                  <Input
                    id="tokenName"
                    placeholder="Token name (e.g., MacBook Pro)"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                {teams.length > 0 && (
                  <div className="sm:w-48">
                    <Label htmlFor="tokenTeam" className="sr-only">
                      Team (optional)
                    </Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger id="tokenTeam">
                        <SelectValue placeholder="No team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No team</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" disabled={isCreating || !newTokenName.trim()} className="whitespace-nowrap">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Token
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Tokens</CardTitle>
          <CardDescription>
            Active API tokens for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No API tokens yet</p>
              <p className="text-sm text-muted-foreground">
                Create a token to start syncing your sessions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-start justify-between gap-2 p-4 border rounded-lg"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{token.name}</p>
                      {token.teamName && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          <Users className="h-3 w-3 mr-1" />
                          {token.teamName}
                        </span>
                      )}
                      {!token.teamId && teams.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          No team
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <code>{token.tokenPrefix}...</code>
                      <span className="whitespace-nowrap">
                        Created {formatRelativeTime(new Date(token.createdAt))}
                      </span>
                      {token.lastUsedAt && (
                        <span className="whitespace-nowrap">
                          Last used {formatRelativeTime(new Date(token.lastUsedAt))}
                        </span>
                      )}
                    </div>
                    {editingTokenId === token.id && (
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={editTeamId} onValueChange={setEditTeamId}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="No team" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No team</SelectItem>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleUpdateTeam(token.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTokenId(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {teams.length > 0 && editingTokenId !== token.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(token)}
                        title="Change team assignment"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevokeToken(token.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            How to connect your local Claude Code sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium">1. Install the CLI</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-2 bg-muted rounded text-sm">
                npx llmwhiteboard init
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard("npx llmwhiteboard init")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium">2. Enter your API token when prompted</p>
            <p className="text-sm text-muted-foreground">
              The CLI will automatically configure Claude Code hooks to sync your
              sessions.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">3. Start using Claude Code</p>
            <p className="text-sm text-muted-foreground">
              Your sessions will automatically appear in the dashboard.
              {teams.length > 0 && " If you assigned the token to a team, sessions will show up in that team's dashboard."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
