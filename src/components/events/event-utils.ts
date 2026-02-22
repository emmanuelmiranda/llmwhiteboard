import { MessageSquare, Wrench, Activity, Square, Play, Zap, GitBranch, MessageSquareMore, ShieldAlert, RefreshCw } from "lucide-react";
import { getDisplayHints, resolveIcon, resolveColor } from "@/lib/display-hints";
import type { BaseEvent } from "./types";

export type SessionBlock = {
  type: "session";
  startEvent: BaseEvent;
  events: BaseEvent[];
  stopEvent?: BaseEvent;
};

export type CompactionBlock = {
  type: "compaction";
  event: BaseEvent;
};

export type EventBlock = SessionBlock | CompactionBlock;

/**
 * Group events into session blocks and compaction events
 * Events should be in reverse chronological order (newest first)
 */
export function groupEventsIntoBlocks(events: BaseEvent[]): EventBlock[] {
  const blocks: EventBlock[] = [];
  let currentBlock: SessionBlock | null = null;

  // Events are in reverse chronological order, so process in reverse to build blocks correctly
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

  return blocks;
}

/**
 * Get the icon component and color for an event type.
 * For tool events, checks metadata.display hints for custom icon/color.
 */
export function getEventIconInfo(eventType: string, metadata?: Record<string, unknown> | null) {
  const isUserPrompt = eventType === "user_prompt";
  const isToolUse = eventType === "tool_use";
  const isCompaction = eventType === "compaction";
  const isStop = eventType === "stop" || eventType === "session_end" || eventType === "agent_stop";
  const isSubagentStop = eventType === "subagent_stop";
  const isStart = eventType === "session_start";

  let Icon = Activity;
  let iconColor = "text-muted-foreground";

  if (isUserPrompt) {
    Icon = MessageSquare;
    iconColor = "text-blue-500";
  } else if (isToolUse) {
    const hints = getDisplayHints(metadata);
    Icon = resolveIcon(hints.icon, Wrench);
    iconColor = resolveColor(hints.color, "orange").iconColor;
  } else if (isCompaction) {
    Icon = Zap;
    iconColor = "text-amber-500";
  } else if (isSubagentStop) {
    Icon = GitBranch;
    iconColor = "text-purple-500";
  } else if (isStop) {
    Icon = Square;
    iconColor = eventType === "session_end" ? "text-red-500" : "text-gray-500";
  } else if (isStart) {
    Icon = Play;
    iconColor = "text-green-500";
  }

  return { Icon, iconColor, isUserPrompt, isToolUse, isCompaction, isStop, isSubagentStop, isStart };
}

/**
 * Extract the most useful info from tool metadata for display.
 * Checks metadata.display.detail first for custom tools.
 */
export function getToolDisplayInfo(toolName: string | null | undefined, metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;

  // Check display hints first (custom tools can set their own detail text)
  const displayDetail = getDisplayHints(metadata).detail;
  if (displayDetail) return displayDetail;

  if (!toolName) return null;

  const input = metadata.input as Record<string, unknown> | undefined;
  if (!input) return null;

  const tool = toolName.toLowerCase();

  // File operations - show the file path/name
  if (tool === "read" || tool === "write" || tool === "edit" || tool === "notebookedit") {
    const filePath = (input.file_path || input.path || input.notebook_path) as string | undefined;
    if (filePath) {
      const fileName = filePath.split(/[/\\]/).pop();
      return fileName || filePath;
    }
  }

  // Search operations - show the pattern
  if (tool === "grep") {
    const pattern = input.pattern as string | undefined;
    if (pattern) {
      return pattern.length > 50 ? pattern.slice(0, 50) + "..." : pattern;
    }
  }

  if (tool === "glob") {
    const pattern = input.pattern as string | undefined;
    if (pattern) return pattern;
  }

  // Bash - show first line of command
  if (tool === "bash") {
    const command = input.command as string | undefined;
    if (command) {
      return command.split("\n")[0];
    }
  }

  // Web operations
  if (tool === "webfetch" || tool === "websearch") {
    const url = input.url as string | undefined;
    const query = input.query as string | undefined;
    if (url) {
      try {
        return new URL(url).hostname;
      } catch {
        return url.slice(0, 40);
      }
    }
    if (query) return query.length > 50 ? query.slice(0, 50) + "..." : query;
  }

  // Task tool - show description
  if (tool === "task") {
    const description = input.description as string | undefined;
    if (description) return description;
  }

  // AskUserQuestion - show question
  if (tool === "askuserquestion") {
    const questions = input.questions as Array<{ question?: string }> | undefined;
    const firstQuestion = questions?.[0]?.question;
    return firstQuestion || null;
  }

  return null;
}

/**
 * Get the answer for AskUserQuestion from tool response
 */
export function getAskUserAnswer(toolName: string | null | undefined, metadata: Record<string, unknown> | null | undefined): string | null {
  if (!toolName || toolName.toLowerCase() !== "askuserquestion" || !metadata) return null;

  const response = metadata.response as Record<string, unknown> | string | undefined;

  if (typeof response === "string") {
    try {
      const parsed = JSON.parse(response);
      if (parsed.answers) {
        const answers = Object.values(parsed.answers);
        if (answers.length > 0) return String(answers[0]);
      }
    } catch {
      return response;
    }
  }

  if (typeof response === "object" && response) {
    const answers = (response as Record<string, unknown>).answers as Record<string, string> | undefined;
    if (answers) {
      const answerValues = Object.values(answers);
      if (answerValues.length > 0) return answerValues[0];
    }
  }

  return null;
}

/**
 * Get permission request details
 */
export function getPermissionRequestInfo(eventType: string, toolName: string | null | undefined, metadata: Record<string, unknown> | null | undefined): { tool: string; action?: string } | null {
  if (eventType !== "permission_request") return null;

  const tool = toolName || (metadata?.tool_name as string) || "Unknown";
  const input = metadata?.input as Record<string, unknown> | undefined;

  let action: string | undefined;
  if (input) {
    if (input.command) action = String(input.command).split("\n")[0];
    else if (input.file_path) action = String(input.file_path).split(/[/\\]/).pop();
  }

  return { tool, action };
}

/**
 * Get timeline-style circle and badge colors for an event.
 * For tool events, checks metadata.display hints for custom icon/color/label.
 */
export function getTimelineEventStyle(eventType: string, toolName: string | null | undefined, metadata?: Record<string, unknown> | null) {
  const isAskUser = (eventType === "tool_use" || eventType === "tool_use_start") && toolName?.toLowerCase() === "askuserquestion";

  if (eventType === "session_end") {
    return {
      circleClass: "border-red-500 bg-red-100 dark:bg-red-900/30",
      badgeClass: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300",
      badgeLabel: "Session ended",
      Icon: Square,
      iconColor: "text-red-500",
    };
  }
  if (eventType === "stop") {
    return {
      circleClass: "border-gray-400 bg-gray-100 dark:bg-gray-800",
      badgeClass: "",
      badgeLabel: "Session paused",
      Icon: Square,
      iconColor: "text-gray-500",
    };
  }
  if (eventType === "session_start") {
    return {
      circleClass: "border-green-500 bg-green-100 dark:bg-green-900/30",
      badgeClass: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300",
      badgeLabel: "Session started",
      Icon: Play,
      iconColor: "text-green-500",
    };
  }
  if (eventType === "user_prompt") {
    return {
      circleClass: "border-blue-500 bg-blue-100 dark:bg-blue-900/30",
      badgeClass: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300",
      badgeLabel: "Prompt",
      Icon: MessageSquare,
      iconColor: "text-blue-500",
    };
  }
  if (eventType === "permission_request") {
    return {
      circleClass: "border-amber-500 bg-amber-100 dark:bg-amber-900/30",
      badgeClass: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300",
      badgeLabel: "Permission needed",
      Icon: ShieldAlert,
      iconColor: "text-amber-500",
    };
  }
  if (isAskUser) {
    return {
      circleClass: "border-amber-500 bg-amber-100 dark:bg-amber-900/30",
      badgeClass: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300",
      badgeLabel: "AskUserQuestion",
      Icon: MessageSquareMore,
      iconColor: "text-amber-500",
    };
  }
  if (eventType === "context_compaction") {
    return {
      circleClass: "border-orange-500 bg-orange-100 dark:bg-orange-900/30",
      badgeClass: "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300",
      badgeLabel: "Compaction",
      Icon: RefreshCw,
      iconColor: "text-orange-500",
    };
  }
  if (eventType === "tool_use" || eventType === "tool_use_start") {
    const hints = getDisplayHints(metadata);
    const colors = resolveColor(hints.color, "purple");
    return {
      circleClass: colors.circleClass,
      badgeClass: colors.badgeClass,
      badgeLabel: hints.label || toolName || "Tool",
      Icon: resolveIcon(hints.icon, Wrench),
      iconColor: colors.iconColor,
    };
  }
  return {
    circleClass: "border-primary bg-background",
    badgeClass: "",
    badgeLabel: eventType,
    Icon: Activity,
    iconColor: "text-primary",
  };
}
