"use client";

import { ChevronDown, ChevronRight, Play, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { EventItem } from "./EventItem";
import type { SessionBlockProps } from "./types";

export function SessionBlock({
  blockId,
  startEvent,
  events,
  stopEvent,
  isExpanded,
  onToggle,
  glowingEventIds = new Set(),
  showFullDetails = true,
}: SessionBlockProps) {
  const userPrompts = events.filter(e => e.eventType === "user_prompt");
  const promptCount = userPrompts.length;
  const toolCount = events.filter(e => e.eventType === "tool_use").length;
  const startTime = new Date(startEvent.createdAt);
  const firstPrompt = userPrompts[0];

  // Check if any event in the block is glowing
  const hasGlowingEvent =
    events.some(e => glowingEventIds.has(e.id)) ||
    glowingEventIds.has(startEvent.id) ||
    (stopEvent && glowingEventIds.has(stopEvent.id));

  const isOrphanStop = stopEvent && events.length === 0 && startEvent.id === stopEvent.id;

  return (
    <div className={`border rounded-lg overflow-hidden ${hasGlowingEvent ? "ring-2 ring-green-500 ring-opacity-50 animate-pulse" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        {isOrphanStop ? (
          <Square className={`h-4 w-4 flex-shrink-0 ${stopEvent.eventType === "session_end" ? "text-red-500" : "text-gray-500"}`} />
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
          {isOrphanStop ? (
            <p className="text-sm text-foreground mt-1">
              {stopEvent.eventType === "session_end" ? "Session ended" : "Session paused"}
              {showFullDetails && stopEvent.summary ? ` - ${stopEvent.summary}` : ""}
            </p>
          ) : firstPrompt ? (
            <p className="text-sm text-foreground mt-1 truncate">
              {showFullDetails ? (firstPrompt.summary || "User prompt") : "User prompt"}
            </p>
          ) : null}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
          {events.map((event) => (
            <EventItem
              key={event.id}
              event={event}
              isGlowing={glowingEventIds.has(event.id)}
              showFullDetails={showFullDetails}
              compact
            />
          ))}
          {events.length === 0 && !stopEvent && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No events in this session block
            </p>
          )}
          {/* Show stop event at the end */}
          {stopEvent && !isOrphanStop && (
            <div className="flex items-start space-x-3 text-sm bg-gray-50 dark:bg-gray-900/30 -mx-1 px-2 py-2 rounded-md mt-2 border-t pt-3">
              <Square className={`h-4 w-4 mt-0.5 flex-shrink-0 ${stopEvent.eventType === "session_end" ? "text-red-500" : "text-gray-500"}`} />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {stopEvent.eventType === "session_end" ? "Session ended" : "Session paused"}
                </span>
                {showFullDetails && stopEvent.summary && (
                  <p className="text-muted-foreground mt-0.5">
                    {stopEvent.summary}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                {formatRelativeTime(new Date(stopEvent.createdAt))}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
