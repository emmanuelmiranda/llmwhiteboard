"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowLeft,
  Copy,
  Folder,
  Monitor,
  Clock,
  Activity,
  Lock,
  Save,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { SessionStatus } from "@/types";

interface SessionEvent {
  id: string;
  eventType: string;
  toolName: string | null;
  summary: string | null;
  createdAt: string;
}

interface SessionDetail {
  id: string;
  localSessionId: string;
  projectPath: string;
  title: string | null;
  description: string | null;
  status: SessionStatus;
  tags: string[];
  machine: {
    id: string;
    machineId: string;
    name: string | null;
  } | null;
  transcript: {
    id: string;
    isEncrypted: boolean;
    sizeBytes: number;
    uploadedAt: string;
  } | null;
  events: SessionEvent[];
  compactionCount: number;
  totalTokensUsed: number;
  lastActivityAt: string;
  createdAt: string;
}

const statusLabels: Record<SessionStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SessionStatus>("ACTIVE");
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error);
        }

        setSession(data.session);
        setTitle(data.session.title || "");
        setDescription(data.session.description || "");
        setStatus(data.session.status);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load session",
          variant: "destructive",
        });
        router.push("/sessions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [id, router, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          status,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      toast({
        title: "Saved",
        description: "Session updated successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save session",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      toast({
        title: "Deleted",
        description: "Session deleted successfully",
      });
      router.push("/sessions");
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive",
      });
    }
  };

  const copyResumeCommand = () => {
    const command = `npx llmwhiteboard resume ${session?.id}`;
    navigator.clipboard.writeText(command);
    toast({
      title: "Copied",
      description: "Resume command copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
            </h1>
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <Folder className="h-4 w-4 mr-1" />
              {session.projectPath}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={copyResumeCommand}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Resume Command
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>
                Edit session information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Give your session a name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="What is this session about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as SessionStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Activity from this session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session.events.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No events recorded yet
                </p>
              ) : (
                <div className="space-y-4">
                  {session.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start space-x-3 text-sm"
                    >
                      <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{event.eventType}</Badge>
                          {event.toolName && (
                            <span className="text-muted-foreground">
                              {event.toolName}
                            </span>
                          )}
                        </div>
                        {event.summary && (
                          <p className="text-muted-foreground mt-1 truncate">
                            {event.summary}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(new Date(event.createdAt))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Last Activity
                </span>
                <span>{formatRelativeTime(new Date(session.lastActivityAt))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Created
                </span>
                <span>{formatRelativeTime(new Date(session.createdAt))}</span>
              </div>
              {session.machine && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center">
                    <Monitor className="h-4 w-4 mr-2" />
                    Machine
                  </span>
                  <span>
                    {session.machine.name || session.machine.machineId.slice(0, 8)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Events
                </span>
                <span>{session.events.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Compactions
                </span>
                <span className="flex items-center">
                  {session.compactionCount}
                  {session.compactionCount > 0 && (
                    <span
                      className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        session.compactionCount >= 5
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : session.compactionCount >= 3
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {session.compactionCount >= 5
                        ? "High context rot"
                        : session.compactionCount >= 3
                        ? "Some context rot"
                        : "Low context rot"}
                    </span>
                  )}
                </span>
              </div>
              {session.totalTokensUsed > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Total Tokens
                  </span>
                  <span>{session.totalTokensUsed.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {session.transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Transcript
                  {session.transcript.isEncrypted && (
                    <Lock className="h-4 w-4 ml-2 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span>
                    {(session.transcript.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Uploaded</span>
                  <span>
                    {formatRelativeTime(new Date(session.transcript.uploadedAt))}
                  </span>
                </div>
                {session.transcript.isEncrypted && (
                  <p className="text-xs text-muted-foreground pt-2">
                    This transcript is encrypted. You need your encryption key
                    to resume this session.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Resume Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To resume this session on another machine, run:
              </p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                  npx llmwhiteboard resume {session.id}
                </code>
                <Button size="icon" variant="outline" onClick={copyResumeCommand}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
