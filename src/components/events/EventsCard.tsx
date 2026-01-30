"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { EventTimeline } from "./EventTimeline";
import { LastActionIndicator } from "./LastActionIndicator";
import { groupEventsIntoBlocks } from "./event-utils";
import type { BaseEvent } from "./types";

interface EventsCardProps {
  events: BaseEvent[];
  eventsTotal: number;
  eventsLoading?: boolean;
  glowingEventIds?: Set<string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  showFullDetails?: boolean;
}

export function EventsCard({
  events,
  eventsTotal,
  eventsLoading = false,
  glowingEventIds = new Set(),
  onLoadMore,
  hasMore = false,
  showFullDetails = true,
}: EventsCardProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  // Get all session block IDs for expand/collapse all
  const allBlockIds = useMemo(() => {
    const blocks = groupEventsIntoBlocks(events);
    return blocks
      .filter((b): b is { type: "session"; startEvent: BaseEvent; events: BaseEvent[]; stopEvent?: BaseEvent } => b.type === "session")
      .map(b => b.startEvent.id);
  }, [events]);

  const allExpanded = allBlockIds.length > 0 && allBlockIds.every(id => expandedBlocks.has(id));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedBlocks(new Set());
    } else {
      setExpandedBlocks(new Set(allBlockIds));
    }
  };

  const handleToggleBlock = (blockId: string) => {
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Events</CardTitle>
            <CardDescription>
              {eventsTotal > 0 ? (
                <>Showing {events.length} of {eventsTotal} events</>
              ) : (
                "Activity from this session"
              )}
            </CardDescription>
          </div>
          {events.length > 0 && allBlockIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleAll}
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="h-4 w-4 mr-1" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-4 w-4 mr-1" />
                  Expand All
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <LastActionIndicator
          event={events.length > 0 ? events[0] : null}
          showFullDetails={showFullDetails}
        />
        <EventTimeline
          events={events}
          eventsTotal={eventsTotal}
          eventsLoading={eventsLoading}
          glowingEventIds={glowingEventIds}
          expandedBlocks={expandedBlocks}
          onToggleBlock={handleToggleBlock}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          showFullDetails={showFullDetails}
          groupIntoBlocks={true}
        />
      </CardContent>
    </Card>
  );
}
