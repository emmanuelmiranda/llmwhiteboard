import { MessageSquare, Wrench, Activity, Square, Play, Zap } from "lucide-react";
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
 * Get the icon component and color for an event type
 */
export function getEventIconInfo(eventType: string) {
  const isUserPrompt = eventType === "user_prompt";
  const isToolUse = eventType === "tool_use";
  const isCompaction = eventType === "compaction";
  const isStop = eventType === "stop" || eventType === "session_end";
  const isStart = eventType === "session_start";

  let Icon = Activity;
  let iconColor = "text-muted-foreground";

  if (isUserPrompt) {
    Icon = MessageSquare;
    iconColor = "text-blue-500";
  } else if (isToolUse) {
    Icon = Wrench;
    iconColor = "text-orange-500";
  } else if (isCompaction) {
    Icon = Zap;
    iconColor = "text-amber-500";
  } else if (isStop) {
    Icon = Square;
    iconColor = eventType === "session_end" ? "text-red-500" : "text-gray-500";
  } else if (isStart) {
    Icon = Play;
    iconColor = "text-green-500";
  }

  return { Icon, iconColor, isUserPrompt, isToolUse, isCompaction, isStop, isStart };
}
