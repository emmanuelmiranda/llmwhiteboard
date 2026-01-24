"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Trash2, Link2, Eye, EyeOff, Users, FolderOpen } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { apiClient, type ShareToken } from "@/lib/api-client";

export default function SharesPage() {
  const [shares, setShares] = useState<ShareToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchShares = async () => {
    try {
      const data = await apiClient.getShares();
      setShares(data.shares || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load shares",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleRevokeShare = async (shareId: string) => {
    try {
      await apiClient.revokeShare(shareId);
      setShares(shares.filter((s) => s.id !== shareId));
      toast({
        title: "Share revoked",
        description: "The share link has been revoked and can no longer be used",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke share",
        variant: "destructive",
      });
    }
  };

  const copyShareUrl = (tokenPrefix: string) => {
    // Note: We can only show the prefix, not the full token
    toast({
      title: "Info",
      description: "Share URLs can only be copied when first created. This is for security.",
    });
  };

  const activeShares = shares.filter((s) => !s.isRevoked);
  const revokedShares = shares.filter((s) => s.isRevoked);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Share Links</h1>
        <p className="text-muted-foreground">
          Manage your public share links for sessions and activity
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Shares</CardTitle>
          <CardDescription>
            Share links that are currently accessible
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : activeShares.length === 0 ? (
            <div className="text-center py-8">
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No active share links</p>
              <p className="text-sm text-muted-foreground">
                Create a share link from a session detail page
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-start justify-between gap-2 p-4 border rounded-lg"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">
                        {share.name || `Share ${share.tokenPrefix}...`}
                      </p>
                      <Badge variant={share.scope === "Session" ? "default" : "secondary"}>
                        {share.scope === "Session" ? (
                          <FolderOpen className="h-3 w-3 mr-1" />
                        ) : (
                          <Users className="h-3 w-3 mr-1" />
                        )}
                        {share.scope}
                      </Badge>
                      <Badge variant={share.visibility === "Full" ? "default" : "outline"}>
                        {share.visibility === "Full" ? (
                          <Eye className="h-3 w-3 mr-1" />
                        ) : (
                          <EyeOff className="h-3 w-3 mr-1" />
                        )}
                        {share.visibility}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <code>{share.tokenPrefix}...</code>
                      <span className="whitespace-nowrap">
                        Created {formatRelativeTime(new Date(share.createdAt))}
                      </span>
                      {share.lastAccessedAt && (
                        <span className="whitespace-nowrap">
                          Last accessed {formatRelativeTime(new Date(share.lastAccessedAt))}
                        </span>
                      )}
                      <span className="whitespace-nowrap">{share.accessCount} views</span>
                      {share.expiresAt && (
                        <span className="whitespace-nowrap text-yellow-600">
                          Expires {formatRelativeTime(new Date(share.expiresAt))}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => handleRevokeShare(share.id)}
                    title="Revoke share"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {revokedShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revoked Shares</CardTitle>
            <CardDescription>
              Share links that have been revoked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revokedShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-start justify-between gap-2 p-4 border rounded-lg opacity-60"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {share.name || `Share ${share.tokenPrefix}...`}
                      </p>
                      <Badge variant="destructive">Revoked</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <code>{share.tokenPrefix}...</code>
                      <span className="whitespace-nowrap">
                        Created {formatRelativeTime(new Date(share.createdAt))}
                      </span>
                      <span className="whitespace-nowrap">{share.accessCount} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About Share Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium">Share Scopes</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>Session</strong>: Share a single session with its activity
              </li>
              <li>
                <strong>UserFeed</strong>: Share all your sessions as a live feed
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Visibility Levels</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>Full</strong>: Viewers see everything including prompts, file paths, and metadata
              </li>
              <li>
                <strong>ActivityOnly</strong>: Viewers only see event types and timestamps (no sensitive data)
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Security</p>
            <p className="text-sm text-muted-foreground">
              Share links use secure tokens that are hashed in our database. You can revoke a share
              at any time to immediately disable access. Consider using ActivityOnly visibility for
              public sharing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
