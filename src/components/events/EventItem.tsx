"use client";

import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { getEventIconInfo } from "./event-utils";
import type { EventItemProps } from "./types";

export function EventItem({ event, isGlowing, showFullDetails = true, compact = false }: EventItemProps) {
  const { Icon, iconColor, isUserPrompt, isToolUse } = getEventIconInfo(event.eventType);

  if (compact) {
    // Compact inline view for nested events
    return (
      <div
        className={`flex items-start space-x-3 text-sm ${
          isUserPrompt ? "bg-blue-50 dark:bg-blue-950/30 -mx-1 px-2 py-2 rounded-md" : ""
        } ${isGlowing ? "ring-2 ring-green-500 ring-opacity-50" : ""}`}
      >
        <Icon className={`h-4 w-4 mt-0.5 ${iconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          {isUserPrompt ? (
            <p className="text-foreground">
              {showFullDetails ? (event.summary || "User prompt") : "User prompt"}
            </p>
          ) : (
            <>
              <Badge variant="outline" className="text-xs">
                {event.toolName || event.eventType}
              </Badge>
              {showFullDetails && event.summary && (
                <p className="text-muted-foreground mt-1 truncate">
                  {event.summary}
                </p>
              )}
              {showFullDetails && isToolUse && event.metadata?.input != null && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                  {JSON.stringify(event.metadata.input as object, null, 2)}
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
  }

  // Full card view for standalone events
  const isStop = event.eventType === "stop" || event.eventType === "session_end";

  return (
    <div
      className={`border rounded-lg p-3 ${
        isGlowing ? "ring-2 ring-green-500 ring-opacity-50 animate-pulse" : ""
      } ${isUserPrompt ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
    >
      <div className="flex items-start space-x-3">
        <Icon className={`h-4 w-4 mt-0.5 ${iconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isUserPrompt ? (
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                User Prompt
              </span>
            ) : isToolUse ? (
              <Badge variant="outline" className="text-xs">
                {event.toolName || "Tool"}
              </Badge>
            ) : isStop ? (
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {event.eventType === "session_end" ? "Session Ended" : "Session Paused"}
              </span>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {event.eventType}
              </Badge>
            )}
          </div>
          {showFullDetails && event.summary && (
            <p className={`text-sm mt-1 ${isUserPrompt ? "text-foreground" : "text-muted-foreground"}`}>
              {event.summary}
            </p>
          )}
          {showFullDetails && isToolUse && event.metadata?.input != null && (
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(event.metadata.input as object, null, 2)}
            </pre>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {formatRelativeTime(new Date(event.createdAt))}
        </span>
      </div>
    </div>
  );
}
