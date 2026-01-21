"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
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
  History,
  GitBranch,
  Check,
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

interface Snapshot {
  id: string;
  sessionId: string;
  compactionCycle: number;
  type: "PostCompaction" | "Checkpoint" | "Delta";
  sizeBytes: number;
  contextPercentage: number | null;
  isEncrypted: boolean;
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
  // Events pagination
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);
  const EVENTS_PAGE_SIZE = 50;
  // Snapshots
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [copiedSnapshotId, setCopiedSnapshotId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const loadEvents = async (offset: number = 0, append: boolean = false) => {
    setEventsLoading(true);
    try {
      const data = await apiClient.getSessionEvents(id, { limit: EVENTS_PAGE_SIZE, offset });
      if (append) {
        setEvents(prev => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
      }
      setEventsTotal(data.total);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setEventsLoading(false);
    }
  };

  const loadSnapshots = async () => {
    setSnapshotsLoading(true);
    try {
      const data = await apiClient.getSessionSnapshots(id);
      setSnapshots(data.snapshots);
    } catch (error) {
      // Snapshots may not exist for older sessions
      setSnapshots([]);
    } finally {
      setSnapshotsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.getSession(id);
        setSession(data.session);
        setTitle(data.session.title || "");
        setDescription(data.session.description || "");
        setStatus(data.session.status);
        // Load events and snapshots in parallel
        await Promise.all([loadEvents(0), loadSnapshots()]);
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load session",
          variant: "destructive",
        });
        router.push("/sessions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.updateSession(id, {
        title: title || undefined,
        description: description || undefined,
        status,
      });

      toast({
        title: "Saved",
        description: "Session updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save session",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      await apiClient.deleteSession(id);

      toast({
        title: "Deleted",
        description: "Session deleted successfully",
      });
      router.push("/sessions");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete session",
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

  const copySnapshotResumeCommand = (snapshot: Snapshot) => {
    const command = `npx llmwhiteboard resume ${session?.id} --snapshot ${snapshot.id}`;
    navigator.clipboard.writeText(command);
    setCopiedSnapshotId(snapshot.id);
    toast({
      title: "Copied",
      description: `Resume command for ${getSnapshotLabel(snapshot)} copied`,
    });
    setTimeout(() => setCopiedSnapshotId(null), 2000);
  };

  const getSnapshotLabel = (snapshot: Snapshot) => {
    switch (snapshot.type) {
      case "PostCompaction":
        return `Fresh start (after compaction #${snapshot.compactionCycle})`;
      case "Checkpoint":
        return `${snapshot.contextPercentage || 80}% checkpoint (cycle #${snapshot.compactionCycle})`;
      case "Delta":
        return `Final 20% (cycle #${snapshot.compactionCycle})`;
      default:
        return snapshot.type;
    }
  };

  const getSnapshotDescription = (snapshot: Snapshot) => {
    switch (snapshot.type) {
      case "PostCompaction":
        return "Resume with fresh context after compaction summary";
      case "Checkpoint":
        return "Resume with ~80% context - recommended for most cases";
      case "Delta":
        return "View-only: shows what happened in the final stretch";
      default:
        return "";
    }
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
              <CardTitle>Events</CardTitle>
              <CardDescription>
                {eventsTotal > 0 ? (
                  <>Showing {events.length} of {eventsTotal} events</>
                ) : (
                  "Activity from this session"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 && !eventsLoading ? (
                <p className="text-muted-foreground text-center py-4">
                  No events recorded yet
                </p>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
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
                  {events.length < eventsTotal && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => loadEvents(events.length, true)}
                      disabled={eventsLoading}
                    >
                      {eventsLoading ? "Loading..." : `Load More (${eventsTotal - events.length} remaining)`}
                    </Button>
                  )}
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
                <span>{eventsTotal}</span>
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

          {snapshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  Time Travel
                </CardTitle>
                <CardDescription>
                  Resume from a previous checkpoint
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshots
                  .filter(s => s.type !== "Delta")
                  .map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {getSnapshotLabel(snapshot)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getSnapshotDescription(snapshot)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(snapshot.sizeBytes / 1024).toFixed(1)} KB • {formatRelativeTime(new Date(snapshot.createdAt))}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copySnapshotResumeCommand(snapshot)}
                        className="ml-2 shrink-0"
                      >
                        {copiedSnapshotId === snapshot.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}

                {snapshots.some(s => s.type === "Delta") && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      View-only (last 20% before compaction)
                    </p>
                    {snapshots
                      .filter(s => s.type === "Delta")
                      .map((snapshot) => (
                        <div
                          key={snapshot.id}
                          className="flex items-center justify-between p-2 text-xs text-muted-foreground"
                        >
                          <span>Cycle #{snapshot.compactionCycle} delta</span>
                          <span>{(snapshot.sizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      ))}
                  </div>
                )}

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>How to resume from a checkpoint:</strong>
                  </p>
                  <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
                    <li>Copy the resume command for your chosen checkpoint</li>
                    <li>Run it in your terminal on any machine</li>
                    <li>Then run: <code className="bg-muted px-1 rounded">claude --continue</code></li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
