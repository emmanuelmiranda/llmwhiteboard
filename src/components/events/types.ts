/**
 * Shared event types for the event timeline components
 */

export interface BaseEvent {
  id: string;
  sessionId: string;
  eventType: string;
  toolName?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EventTimelineProps {
  events: BaseEvent[];
  eventsTotal: number;
  eventsLoading?: boolean;
  glowingEventIds?: Set<string>;
  expandedBlocks?: Set<string>;
  onToggleBlock?: (blockId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  /** Whether to show full details (summaries, metadata, etc.) */
  showFullDetails?: boolean;
  /** Whether to show grouped blocks or flat list */
  groupIntoBlocks?: boolean;
}

export interface EventItemProps {
  event: BaseEvent;
  isGlowing?: boolean;
  showFullDetails?: boolean;
  compact?: boolean;
}

export interface SessionBlockProps {
  blockId: string;
  startEvent: BaseEvent;
  events: BaseEvent[];
  stopEvent?: BaseEvent;
  isExpanded: boolean;
  onToggle: () => void;
  glowingEventIds?: Set<string>;
  showFullDetails?: boolean;
}

export interface CompactionBlockProps {
  event: BaseEvent;
  isGlowing?: boolean;
  showFullDetails?: boolean;
}
