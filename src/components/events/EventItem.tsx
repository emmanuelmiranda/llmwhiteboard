"use client";

import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { getEventIconInfo, getTimelineEventStyle, getToolDisplayInfo, getAskUserAnswer, getPermissionRequestInfo } from "./event-utils";
import type { EventItemProps } from "./types";

export function EventItem({ event, isGlowing, showFullDetails = true, compact = false }: EventItemProps) {
  const { Icon, iconColor, isUserPrompt, isToolUse } = getEventIconInfo(event.eventType);

  if (compact) {
    // Timeline-style compact view for nested events
    const style = getTimelineEventStyle(event.eventType, event.toolName);
    const TimelineIcon = style.Icon;

    return (
      <div
        className={`flex items-start pl-8 relative text-sm ${isGlowing ? "ring-2 ring-green-500 ring-opacity-50 rounded-lg" : ""}`}
      >
        <div className={`absolute left-0 top-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center ${style.circleClass}`}>
          <TimelineIcon className={`h-3 w-3 ${style.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${style.badgeClass}`}>
              {style.badgeLabel}
            </Badge>
            {(() => {
              // AskUserQuestion: show question + answer
              if (event.toolName?.toLowerCase() === "askuserquestion") {
                const question = getToolDisplayInfo(event.toolName, event.metadata);
                const answer = getAskUserAnswer(event.toolName, event.metadata);
                const isWaiting = event.eventType === "tool_use_start";
                return (
                  <div className="flex flex-col gap-1 min-w-0">
                    {question && (
                      <span className="text-xs text-muted-foreground italic break-words">
                        &quot;{question}&quot;
                      </span>
                    )}
                    {isWaiting ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Waiting for response...
                      </span>
                    ) : answer ? (
                      <span className="text-xs text-green-600 dark:text-green-400 break-words">
                        → {answer}
                      </span>
                    ) : null}
                  </div>
                );
              }

              // Permission requests: show tool + action
              if (event.eventType === "permission_request") {
                const permInfo = getPermissionRequestInfo(event.eventType, event.toolName, event.metadata);
                if (permInfo) {
                  return (
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs text-muted-foreground break-words">
                        {permInfo.tool}{permInfo.action ? `: ${permInfo.action}` : ""}
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Waiting for approval...
                      </span>
                    </div>
                  );
                }
              }

              // Smart tool summary
              const toolInfo = getToolDisplayInfo(event.toolName, event.metadata);
              if (toolInfo) {
                return (
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded block truncate max-w-[200px] sm:max-w-[300px] md:max-w-full">
                    {toolInfo}
                  </code>
                );
              }

              // Fall back to summary for non-tool events
              if (event.eventType !== "tool_use" && event.eventType !== "tool_use_start" && event.summary) {
                return (
                  <span className="text-xs text-muted-foreground truncate block max-w-[200px] sm:max-w-[300px] md:max-w-full">
                    {event.summary}
                  </span>
                );
              }

              return null;
            })()}
          </div>
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
          {showFullDetails && event.summary && !event.metadata?.input && (
            <p className={`text-sm mt-1 ${isUserPrompt ? "text-foreground" : "text-muted-foreground"}`}>
              {event.summary}
            </p>
          )}
          {showFullDetails && isUserPrompt && event.metadata?.input != null && (
            <div className="mt-2">
              <pre className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                {typeof event.metadata.input === 'object' && 'message' in event.metadata.input
                  ? String((event.metadata.input as { message: string }).message)
                  : JSON.stringify(event.metadata.input, null, 2)}
              </pre>
            </div>
          )}
          {showFullDetails && event.eventType === 'agent_response' && event.metadata?.output != null && (
            <div className="mt-2">
              <pre className="p-2 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {typeof event.metadata.output === 'string' ? event.metadata.output : JSON.stringify(event.metadata.output, null, 2)}
              </pre>
            </div>
          )}
          {showFullDetails && isToolUse && event.metadata?.input != null && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Input:</div>
                <pre className="p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(event.metadata.input as object, null, 2)}
                </pre>
              </div>
              {event.metadata.output != null && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Output:</div>
                  <pre className="p-2 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                    {typeof event.metadata.output === 'string' ? event.metadata.output : JSON.stringify(event.metadata.output as object, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {formatRelativeTime(new Date(event.createdAt))}
        </span>
      </div>
    </div>
  );
}
