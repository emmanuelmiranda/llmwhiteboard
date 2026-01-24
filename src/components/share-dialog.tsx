"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Share2, Copy, Check, Eye, EyeOff, Link2 } from "lucide-react";
import { apiClient, type ShareVisibility } from "@/lib/api-client";

interface ShareDialogProps {
  sessionId: string;
  sessionTitle?: string;
  trigger?: React.ReactNode;
}

export function ShareDialog({ sessionId, sessionTitle, trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ShareVisibility>("Full");
  const { toast } = useToast();

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
    }, 200);
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
            Create a public link to share this session
            {sessionTitle && ` "${sessionTitle}"`}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
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
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-muted-foreground">
                  Anyone with this link can view this session
                  {visibility === "ActivityOnly" && " (activity only, no sensitive data)"}.
                </p>
              </div>
              <SheetFooter>
                <Button onClick={handleClose} className="w-full">Done</Button>
              </SheetFooter>
            </div>
          ) : (
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
                <Button variant="outline" onClick={handleClose} className="w-full">
                  Cancel
                </Button>
              </SheetFooter>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
