"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient, type SessionEvent as ApiSessionEvent } from "@/lib/api-client";
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
  MessageSquare,
  Wrench,
  Square,
  Play,
  ChevronRight,
  ChevronDown,
  Zap,
  Sparkles,
  Bot,
  Download,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { SessionStatus } from "@/types";
import { useSignalRContext } from "@/components/signalr-provider";
import { ConnectionStatus } from "@/components/connection-status";

interface SessionEvent {
  id: string;
  eventType: string;
  toolName: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
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
  cliType: string;
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

const cliConfig: Record<string, { label: string; icon: typeof Sparkles; className: string; resumeCommand: string }> = {
  "claude-code": {
    label: "Claude Code",
    icon: Sparkles,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    resumeCommand: "claude --continue",
  },
  "gemini-cli": {
    label: "Gemini CLI",
    icon: Bot,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    resumeCommand: "gemini",
  },
};

const statusLabels: Record<SessionStatus, string> = {
  Active: "Active",
  Paused: "Paused",
  Completed: "Completed",
  Archived: "Archived",
};

export default function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SessionStatus>("Active");
  // Events pagination
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);
  const EVENTS_PAGE_SIZE = 50;
  // Snapshots
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [copiedSnapshotId, setCopiedSnapshotId] = useState<string | null>(null);
  // Expanded session blocks (by session_start event id)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  // Glowing events for real-time updates
  const [glowingEventIds, setGlowingEventIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { toast } = useToast();
  const {
    joinSession,
    leaveSession,
    onSessionUpdated,
    onSessionDeleted,
    onNewEvent,
  } = useSignalRContext();

  // Add glow effect to an event temporarily
  const addEventGlow = useCallback((id: string) => {
    setGlowingEventIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setGlowingEventIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }, []);

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

  // Join session group for real-time updates
  useEffect(() => {
    joinSession(id);
    return () => {
      leaveSession(id);
    };
  }, [id, joinSession, leaveSession]);

  // Subscribe to real-time updates for this session
  useEffect(() => {
    const unsubscribeUpdated = onSessionUpdated((updatedSession) => {
      if (updatedSession.id === id) {
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            title: updatedSession.title,
            description: updatedSession.description,
            status: updatedSession.status,
            lastActivityAt: updatedSession.lastActivityAt,
            compactionCount: updatedSession.compactionCount,
            totalTokensUsed: updatedSession.totalTokensUsed,
          };
        });
        // Don't update the form fields if the user hasn't touched them
        // This prevents overwriting user input while they're editing
      }
    });

    const unsubscribeDeleted = onSessionDeleted((sessionId) => {
      if (sessionId === id) {
        toast({
          title: "Session Deleted",
          description: "This session has been deleted",
        });
        router.push("/sessions");
      }
    });

    const unsubscribeNewEvent = onNewEvent((newEvent: ApiSessionEvent) => {
      if (newEvent.sessionId === id) {
        // Prepend new event to the events list
        setEvents((prev) => {
          // Check if event already exists
          if (prev.some((e) => e.id === newEvent.id)) {
            return prev;
          }
          const mappedEvent: SessionEvent = {
            id: newEvent.id,
            eventType: newEvent.eventType,
            toolName: newEvent.toolName,
            summary: newEvent.summary,
            metadata: newEvent.metadata as Record<string, unknown> | null,
            createdAt: newEvent.createdAt,
          };
          return [mappedEvent, ...prev];
        });
        setEventsTotal((prev) => prev + 1);
        addEventGlow(newEvent.id);
      }
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeNewEvent();
    };
  }, [id, onSessionUpdated, onSessionDeleted, onNewEvent, toast, router, addEventGlow]);

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

  const exportAsMarkdown = () => {
    if (!session) return;

    const lines: string[] = [];

    // Header
    lines.push(`# ${session.title || `Session ${session.localSessionId.slice(0, 8)}`}`);
    lines.push("");

    // Metadata
    lines.push("## Session Info");
    lines.push("");
    lines.push(`- **Project**: ${session.projectPath}`);
    lines.push(`- **Status**: ${session.status}`);
    lines.push(`- **CLI**: ${session.cliType}`);
    if (session.machine) {
      lines.push(`- **Machine**: ${session.machine.name || session.machine.machineId}`);
    }
    lines.push(`- **Created**: ${new Date(session.createdAt).toLocaleString()}`);
    lines.push(`- **Last Activity**: ${new Date(session.lastActivityAt).toLocaleString()}`);
    if (session.description) {
      lines.push(`- **Description**: ${session.description}`);
    }
    if (session.tags.length > 0) {
      lines.push(`- **Tags**: ${session.tags.join(", ")}`);
    }
    lines.push("");

    // Events
    lines.push("## Activity Timeline");
    lines.push("");

    // Sort events by date (oldest first for reading)
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const event of sortedEvents) {
      const time = new Date(event.createdAt).toLocaleTimeString();
      const date = new Date(event.createdAt).toLocaleDateString();

      if (event.eventType === "user_prompt") {
        lines.push(`### 💬 User Prompt (${date} ${time})`);
        lines.push("");
        if (event.summary) {
          lines.push(event.summary);
        }
      } else if (event.eventType === "tool_use") {
        lines.push(`### 🔧 ${event.toolName || "Tool"} (${date} ${time})`);
        lines.push("");
        if (event.metadata?.input) {
          const input = event.metadata.input as Record<string, unknown>;
          // Show relevant input based on tool type
          if (event.toolName?.toLowerCase() === "bash" && input.command) {
            lines.push("```bash");
            lines.push(String(input.command));
            lines.push("```");
          } else if (["read", "write", "edit"].includes(event.toolName?.toLowerCase() || "")) {
            const filePath = input.file_path || input.path;
            if (filePath) lines.push(`File: \`${filePath}\``);
          } else if (event.toolName?.toLowerCase() === "grep" && input.pattern) {
            lines.push(`Pattern: \`${input.pattern}\``);
          }
        }
        if (event.summary) {
          lines.push("");
          lines.push(event.summary);
        }
      } else if (event.eventType === "stop" || event.eventType === "session_end") {
        lines.push(`### ⏹️ ${event.eventType === "stop" ? "Stopped" : "Session End"} (${date} ${time})`);
        if (event.summary) {
          lines.push("");
          lines.push(event.summary);
        }
      } else {
        lines.push(`### ${event.eventType} (${date} ${time})`);
        if (event.summary) {
          lines.push("");
          lines.push(event.summary);
        }
      }
      lines.push("");
    }

    // Create and download file
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${session.localSessionId.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Session exported as Markdown",
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
            </h1>
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <Folder className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{session.projectPath}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <ConnectionStatus />
          <Button
            variant="outline"
            size="icon"
            onClick={exportAsMarkdown}
            title="Export as Markdown"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
            title="Delete session"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={copyResumeCommand} className="whitespace-nowrap">
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Copy Resume Command</span>
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
                <div className="space-y-2">
                  {(() => {
                    // Group events into session blocks and compaction events
                    type BlockType =
                      | { type: "session"; startEvent: SessionEvent; events: SessionEvent[]; stopEvent?: SessionEvent }
                      | { type: "compaction"; event: SessionEvent };

                    const blocks: BlockType[] = [];
                    let currentBlock: { type: "session"; startEvent: SessionEvent; events: SessionEvent[]; stopEvent?: SessionEvent } | null = null;

                    // Events are in reverse chronological order, so process accordingly
                    const reversedEvents = [...events].reverse();

                    for (const event of reversedEvents) {
                      if (event.eventType === "compaction") {
                        // Compaction is always its own block
                        if (currentBlock) {
                          blocks.push(currentBlock);
                          currentBlock = null;
                        }
                        blocks.push({ type: "compaction", event });
                      } else if (event.eventType === "session_start") {
                        if (currentBlock) {
                          blocks.push(currentBlock);
                        }
                        currentBlock = { type: "session", startEvent: event, events: [] };
                      } else if (event.eventType === "stop" || event.eventType === "session_end") {
                        if (currentBlock) {
                          currentBlock.stopEvent = event;
                          blocks.push(currentBlock);
                          currentBlock = null;
                        } else {
                          // Orphan stop event
                          blocks.push({ type: "session", startEvent: event, events: [], stopEvent: event });
                        }
                      } else if (currentBlock) {
                        currentBlock.events.push(event);
                      } else {
                        // Events before any session_start - create implicit block
                        currentBlock = { type: "session", startEvent: event, events: [event] };
                      }
                    }
                    if (currentBlock) {
                      blocks.push(currentBlock);
                    }

                    // Reverse to show newest first
                    blocks.reverse();

                    return blocks.map((block, blockIndex) => {
                      // Render compaction blocks separately
                      if (block.type === "compaction") {
                        const isGlowing = glowingEventIds.has(block.event.id);
                        return (
                          <div
                            key={block.event.id}
                            className={`border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 ${isGlowing ? "realtime-glow" : ""}`}
                          >
                            <div className="flex items-center space-x-3">
                              <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                  Context Compaction
                                </span>
                                {block.event.summary && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                    {block.event.summary}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                {formatRelativeTime(new Date(block.event.createdAt))}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Render session blocks
                      const blockId = block.startEvent.id;
                      const isExpanded = expandedBlocks.has(blockId);
                      const userPrompts = block.events.filter(e => e.eventType === "user_prompt");
                      const promptCount = userPrompts.length;
                      const toolCount = block.events.filter(e => e.eventType === "tool_use").length;
                      const startTime = new Date(block.startEvent.createdAt);
                      const firstPrompt = userPrompts[0];

                      // Check if any event in the block is glowing
                      const hasGlowingEvent = block.events.some(e => glowingEventIds.has(e.id)) ||
                        glowingEventIds.has(block.startEvent.id) ||
                        (block.stopEvent && glowingEventIds.has(block.stopEvent.id));

                      const toggleBlock = () => {
                        setExpandedBlocks(prev => {
                          const next = new Set(prev);
                          if (next.has(blockId)) {
                            next.delete(blockId);
                          } else {
                            next.add(blockId);
                          }
                          return next;
                        });
                      };

                      return (
                        <div key={blockId} className={`border rounded-lg overflow-hidden ${hasGlowingEvent ? "realtime-glow" : ""}`}>
                          <button
                            onClick={toggleBlock}
                            className="w-full flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            {block.stopEvent && block.events.length === 0 ? (
                              <Square className={`h-4 w-4 flex-shrink-0 ${block.stopEvent.eventType === "session_end" ? "text-red-500" : "text-gray-500"}`} />
                            ) : (
                              <Play className="h-4 w-4 text-green-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 flex-wrap gap-1">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                  {formatRelativeTime(startTime)}
                                </span>
                                {promptCount > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{promptCount - 1} more
                                  </Badge>
                                )}
                                {toolCount > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {toolCount} tool{toolCount !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                              {block.stopEvent && block.events.length === 0 ? (
                                <p className="text-sm text-foreground mt-1">
                                  {block.stopEvent.eventType === "session_end" ? "Session ended" : "Session paused"}{block.stopEvent.summary ? ` - ${block.stopEvent.summary}` : ""}
                                </p>
                              ) : firstPrompt ? (
                                <p className="text-sm text-foreground mt-1">
                                  {firstPrompt.summary || "User prompt"}
                                </p>
                              ) : null}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
                              {block.events.map((event) => {
                                const isUserPrompt = event.eventType === "user_prompt";
                                const isToolUse = event.eventType === "tool_use";

                                const EventIcon = isUserPrompt
                                  ? MessageSquare
                                  : isToolUse
                                  ? Wrench
                                  : Activity;

                                const iconColor = isUserPrompt
                                  ? "text-blue-500"
                                  : isToolUse
                                  ? "text-orange-500"
                                  : "text-muted-foreground";

                                return (
                                  <div
                                    key={event.id}
                                    className={`flex items-start space-x-3 text-sm ${
                                      isUserPrompt ? "bg-blue-50 dark:bg-blue-950/30 -mx-1 px-2 py-2 rounded-md" : ""
                                    }`}
                                  >
                                    <EventIcon className={`h-4 w-4 mt-0.5 ${iconColor} flex-shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                      {isUserPrompt ? (
                                        <p className="text-foreground">
                                          {event.summary || "User prompt"}
                                        </p>
                                      ) : (
                                        <>
                                          <Badge variant="outline" className="text-xs">
                                            {event.toolName || event.eventType}
                                          </Badge>
                                          {event.summary && (
                                            <p className="text-muted-foreground mt-1 truncate">
                                              {event.summary}
                                            </p>
                                          )}
                                          {isToolUse && event.metadata?.input && (
                                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                                              {JSON.stringify(event.metadata.input, null, 2)}
                                            </pre>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                      {formatRelativeTime(new Date(event.createdAt))}
                                    </span>
                                  </div>
                                );
                              })}
                              {block.events.length === 0 && !block.stopEvent && (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                  No events in this session block
                                </p>
                              )}
                              {/* Show stop event at the end */}
                              {block.stopEvent && (
                                <div className="flex items-start space-x-3 text-sm bg-gray-50 dark:bg-gray-900/30 -mx-1 px-2 py-2 rounded-md mt-2 border-t pt-3">
                                  <Square className={`h-4 w-4 mt-0.5 flex-shrink-0 ${block.stopEvent.eventType === "session_end" ? "text-red-500" : "text-gray-500"}`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {block.stopEvent.eventType === "session_end" ? "Session ended" : "Session paused"}
                                    </span>
                                    {block.stopEvent.summary && (
                                      <p className="text-muted-foreground mt-0.5">
                                        {block.stopEvent.summary}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                    {formatRelativeTime(new Date(block.stopEvent.createdAt))}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
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
              {(() => {
                const cliInfo = cliConfig[session.cliType] || {
                  label: session.cliType,
                  icon: Bot,
                  className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                  resumeCommand: "",
                };
                const CliIcon = cliInfo.icon;
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <CliIcon className="h-4 w-4 mr-2" />
                      CLI Tool
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cliInfo.className}`}>
                      {cliInfo.label}
                    </span>
                  </div>
                );
              })()}
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
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs overflow-x-auto break-all">
                  npx llmwhiteboard resume {session.id}
                </code>
                <Button size="icon" variant="outline" onClick={copyResumeCommand} className="flex-shrink-0">
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
                    <li>Then run: <code className="bg-muted px-1 rounded">{cliConfig[session.cliType]?.resumeCommand || "your CLI tool"}</code></li>
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
