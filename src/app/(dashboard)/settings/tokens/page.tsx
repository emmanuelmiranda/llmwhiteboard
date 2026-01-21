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
import { useToast } from "@/components/ui/use-toast";
import { Copy, Plus, Trash2, Key } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { apiClient, type ApiToken } from "@/lib/api-client";

export default function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
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

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;

    setIsCreating(true);
    try {
      const data = await apiClient.createToken(newTokenName);
      setNewToken(data.token);
      setNewTokenName("");
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
            Generate a new API token to sync sessions from a machine
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
            <form onSubmit={handleCreateToken} className="flex flex-col sm:flex-row gap-2">
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
              <Button type="submit" disabled={isCreating || !newTokenName.trim()} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
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
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium truncate">{token.name}</p>
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
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => handleRevokeToken(token.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
