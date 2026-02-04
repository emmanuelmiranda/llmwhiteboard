"use client";

import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { getEventIconInfo } from "./event-utils";
import type { BaseEvent } from "./types";

export interface LastActionIndicatorProps {
  event: BaseEvent | null;
  showFullDetails?: boolean;
}

export function LastActionIndicator({ event, showFullDetails = true }: LastActionIndicatorProps) {
  if (!event) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        Waiting for activity...
      </div>
    );
  }

  const { Icon, iconColor, isUserPrompt, isToolUse, isSubagentStop } = getEventIconInfo(event.eventType);
  const isStop = event.eventType === "stop" || event.eventType === "session_end" || event.eventType === "agent_stop";
  const isActive = event.eventType === "tool_use_start" || event.eventType === "user_prompt";

  // Get a concise label for the action
  const getActionLabel = () => {
    if (isUserPrompt) {
      return "User Prompt";
    }
    if (isToolUse) {
      return event.toolName || "Tool";
    }
    if (isSubagentStop) {
      return "Subagent Done";
    }
    if (isStop) {
      return event.eventType === "session_end" ? "Completed" : "Paused";
    }
    if (event.eventType === "tool_use_start") {
      return event.toolName ? `Running ${event.toolName}...` : "Running...";
    }
    return event.eventType;
  };

  // Get a summary, truncated if needed
  const getSummary = () => {
    if (!showFullDetails) return null;

    if (event.summary) {
      const maxLength = 60;
      if (event.summary.length > maxLength) {
        return event.summary.slice(0, maxLength) + "...";
      }
      return event.summary;
    }

    // For tool_use, try to extract relevant info from metadata
    if (isToolUse && event.metadata?.input) {
      const input = event.metadata.input as Record<string, unknown>;
      if (event.toolName?.toLowerCase() === "bash" && input.command) {
        const cmd = String(input.command);
        return cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd;
      }
      if (["read", "write", "edit"].includes(event.toolName?.toLowerCase() || "")) {
        const filePath = input.file_path || input.path;
        if (filePath) {
          const path = String(filePath);
          // Show just filename if path is long
          const parts = path.split(/[\/\\]/);
          return parts[parts.length - 1];
        }
      }
      if (event.toolName?.toLowerCase() === "grep" && input.pattern) {
        return `Pattern: ${input.pattern}`;
      }
    }

    return null;
  };

  const actionLabel = getActionLabel();
  const summary = getSummary();

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
      isActive ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" : "bg-muted/50"
    }`}>
      {/* Status indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        )}
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isToolUse || event.eventType === "tool_use_start" ? (
            <Badge variant="outline" className="text-xs">
              {actionLabel}
            </Badge>
          ) : (
            <span className={`font-medium ${isUserPrompt ? "text-blue-700 dark:text-blue-300" : ""}`}>
              {actionLabel}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(new Date(event.createdAt))}
          </span>
        </div>
        {summary && (
          <p className="text-xs text-muted-foreground mt-0.5 break-words">
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
