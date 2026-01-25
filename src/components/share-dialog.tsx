"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Share2, Copy, Check, Eye, EyeOff, Link2, Trash2, Plus } from "lucide-react";
import { apiClient, type ShareVisibility, type ShareToken } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

interface ShareDialogProps {
  sessionId: string;
  sessionTitle?: string;
  trigger?: React.ReactNode;
}

export function ShareDialog({ sessionId, sessionTitle, trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingShares, setExistingShares] = useState<ShareToken[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ShareVisibility>("Full");
  const { toast } = useToast();

  const getShareUrl = (token: string) => {
    const frontendUrl = typeof window !== "undefined"
      ? window.location.origin
      : "https://llmwhiteboard.com";
    return `${frontendUrl}/share/${token}`;
  };

  const loadExistingShares = async () => {
    setIsLoading(true);
    try {
      const result = await apiClient.getSessionShares(sessionId);
      // Filter out revoked shares
      setExistingShares(result.shares.filter(s => !s.isRevoked));
    } catch (error) {
      console.error("Failed to load shares:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadExistingShares();
    }
  }, [open, sessionId]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const result = await apiClient.createShare({
        sessionId,
        scope: "Session",
        visibility,
        name: name || undefined,
      });
      setShareUrl(result.url);
      // Reload shares to include the new one
      await loadExistingShares();
      toast({
        title: "Share link created",
        description: "Copy the link to share this session",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create share link",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await apiClient.revokeShare(shareId);
      setExistingShares(prev => prev.filter(s => s.id !== shareId));
      toast({
        title: "Share revoked",
        description: "The share link has been deactivated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke share",
        variant: "destructive",
      });
    }
  };

  const handleCopyShareUrl = (share: ShareToken) => {
    const url = getShareUrl(share.token);
    navigator.clipboard.writeText(url);
    setCopiedShareId(share.id);
    toast({
      title: "Copied",
      description: "Share link copied to clipboard",
    });
    setTimeout(() => setCopiedShareId(null), 2000);
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Share link copied to clipboard",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after closing
    setTimeout(() => {
      setShareUrl(null);
      setName("");
      setVisibility("Full");
      setCopied(false);
      setShowCreateForm(false);
    }, 200);
  };

  const resetToList = () => {
    setShareUrl(null);
    setName("");
    setVisibility("Full");
    setShowCreateForm(false);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Share Session</SheetTitle>
          <SheetDescription>
            {sessionTitle ? `Manage share links for "${sessionTitle}"` : "Manage share links for this session"}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Show newly created share URL */}
          {shareUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Share URL</Label>
                <div className="flex items-center space-x-2">
                  <Input value={shareUrl} readOnly className="font-mono text-sm" />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 text-sm">
                <p className="text-green-700 dark:text-green-300">
                  Share link created! Anyone with this link can view the session.
                </p>
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button onClick={resetToList} variant="outline" className="w-full">
                  Back to Share Links
                </Button>
                <Button onClick={handleClose} className="w-full">Done</Button>
              </SheetFooter>
            </div>
          ) : showCreateForm ? (
            /* Create new share form */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  placeholder="e.g., Team review link"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as ShareVisibility)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full">
                      <div className="flex items-center">
                        <Eye className="h-4 w-4 mr-2" />
                        Full - All details visible
                      </div>
                    </SelectItem>
                    <SelectItem value="ActivityOnly">
                      <div className="flex items-center">
                        <EyeOff className="h-4 w-4 mr-2" />
                        Activity Only - No sensitive data
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {visibility === "Full"
                    ? "Viewers will see prompts, file paths, tool inputs, and all metadata"
                    : "Viewers will only see event types, tool names, and timestamps"}
                </p>
              </div>

              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                  <Link2 className="h-4 w-4 mr-2" />
                  {isCreating ? "Creating..." : "Create Link"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)} className="w-full">
                  Cancel
                </Button>
              </SheetFooter>
            </div>
          ) : (
            /* List existing shares */
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-16 bg-muted animate-pulse rounded" />
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </div>
              ) : existingShares.length > 0 ? (
                <div className="space-y-3">
                  <Label>Active Share Links</Label>
                  {existingShares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {share.name || `Share ${share.token.slice(-8)}`}
                          </span>
                          <Badge variant={share.visibility === "Full" ? "default" : "secondary"} className="text-xs">
                            {share.visibility === "Full" ? (
                              <><Eye className="h-3 w-3 mr-1" /> Full</>
                            ) : (
                              <><EyeOff className="h-3 w-3 mr-1" /> Activity</>
                            )}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p>Created {formatRelativeTime(new Date(share.createdAt))}</p>
                          {share.accessCount > 0 && (
                            <p>{share.accessCount} view{share.accessCount !== 1 ? "s" : ""}</p>
                          )}
                          {share.expiresAt && (
                            <p>Expires {formatRelativeTime(new Date(share.expiresAt))}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyShareUrl(share)}
                          title="Copy share link"
                        >
                          {copiedShareId === share.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevoke(share.id)}
                          title="Revoke share"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active share links</p>
                  <p className="text-xs mt-1">Create a link to share this session</p>
                </div>
              )}

              <SheetFooter className="flex-col gap-2 sm:flex-col pt-4 border-t">
                <Button onClick={() => setShowCreateForm(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Share Link
                </Button>
              </SheetFooter>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
