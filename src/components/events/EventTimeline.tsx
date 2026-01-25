"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { groupEventsIntoBlocks } from "./event-utils";
import { EventItem } from "./EventItem";
import { SessionBlock } from "./SessionBlock";
import { CompactionBlock } from "./CompactionBlock";
import type { EventTimelineProps } from "./types";

export function EventTimeline({
  events,
  eventsTotal,
  eventsLoading = false,
  glowingEventIds = new Set(),
  expandedBlocks: externalExpandedBlocks,
  onToggleBlock: externalOnToggleBlock,
  onLoadMore,
  hasMore = false,
  showFullDetails = true,
  groupIntoBlocks = true,
}: EventTimelineProps) {
  // Internal state for expanded blocks if not controlled externally
  const [internalExpandedBlocks, setInternalExpandedBlocks] = useState<Set<string>>(new Set());

  const expandedBlocks = externalExpandedBlocks ?? internalExpandedBlocks;
  const onToggleBlock = externalOnToggleBlock ?? ((blockId: string) => {
    setInternalExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  });

  // Group events into blocks
  const blocks = useMemo(() => {
    if (!groupIntoBlocks) return null;
    return groupEventsIntoBlocks(events);
  }, [events, groupIntoBlocks]);

  if (events.length === 0 && !eventsLoading) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No events recorded yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groupIntoBlocks && blocks ? (
        // Grouped block view
        blocks.map((block) => {
          if (block.type === "compaction") {
            return (
              <CompactionBlock
                key={block.event.id}
                event={block.event}
                isGlowing={glowingEventIds.has(block.event.id)}
                showFullDetails={showFullDetails}
              />
            );
          }

          // Session block
          const blockId = block.startEvent.id;
          return (
            <SessionBlock
              key={blockId}
              blockId={blockId}
              startEvent={block.startEvent}
              events={block.events}
              stopEvent={block.stopEvent}
              isExpanded={expandedBlocks.has(blockId)}
              onToggle={() => onToggleBlock(blockId)}
              glowingEventIds={glowingEventIds}
              showFullDetails={showFullDetails}
            />
          );
        })
      ) : (
        // Flat list view
        events.map((event) => {
          if (event.eventType === "compaction") {
            return (
              <CompactionBlock
                key={event.id}
                event={event}
                isGlowing={glowingEventIds.has(event.id)}
                showFullDetails={showFullDetails}
              />
            );
          }

          return (
            <EventItem
              key={event.id}
              event={event}
              isGlowing={glowingEventIds.has(event.id)}
              showFullDetails={showFullDetails}
            />
          );
        })
      )}

      {/* Load more button */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={eventsLoading}
          >
            {eventsLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              `Load more (${events.length} of ${eventsTotal})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
