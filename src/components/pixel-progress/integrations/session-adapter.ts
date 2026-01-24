/**
 * Session Event Adapter
 *
 * Maps LLM Whiteboard session events to pixel-progress ProgressEvents.
 * This allows the pixel-progress component to visualize real session activity.
 */

import type { ProgressEvent } from '../types'

// =============================================================================
// SESSION EVENT TYPES
// =============================================================================

export interface SessionEvent {
  id: string
  sessionId: string
  eventType: string
  toolName: string | null
  summary: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

// =============================================================================
// CATEGORY MAPPING
// =============================================================================

/**
 * Map session event types to pixel-progress categories.
 * This determines what kind of "brick" each event creates.
 */
const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  // Lifecycle
  session_start: 'start',
  session_end: 'end',

  // User interaction
  user_prompt: 'input',
  permission_request: 'wait',

  // Tool execution
  tool_use: 'execute',
  tool_use_start: 'process',

  // Agent events
  agent_stop: 'end',
  session_paused: 'end',
  stop: 'end',
  subagent_stop: 'process',

  // System events
  context_compaction: 'optimize',
  notification: 'output',

  // Model events (reserved)
  model_request: 'analyze',
  model_response: 'output',
}

/**
 * Map specific tool names to more specific categories.
 * This provides finer-grained categorization based on what tool was used.
 */
const TOOL_NAME_TO_CATEGORY: Record<string, string> = {
  // File reading/searching
  Read: 'analyze',
  Glob: 'search',
  Grep: 'search',

  // File writing/editing
  Write: 'create',
  Edit: 'modify',
  NotebookEdit: 'modify',

  // Execution
  Bash: 'execute',

  // Communication
  AskUserQuestion: 'wait',

  // Planning/organization
  TodoWrite: 'process',
  Task: 'process',

  // Web
  WebFetch: 'search',
  WebSearch: 'search',
}

// =============================================================================
// ADAPTER FUNCTIONS
// =============================================================================

/**
 * Convert a session event to a pixel-progress ProgressEvent
 */
export function sessionEventToProgressEvent(event: SessionEvent): ProgressEvent {
  console.log('[session-adapter] Converting event:', event.id, 'eventType:', event.eventType, 'toolName:', event.toolName)

  // Determine category: tool name takes precedence over event type
  let category = 'process' // default

  if (event.toolName && TOOL_NAME_TO_CATEGORY[event.toolName]) {
    category = TOOL_NAME_TO_CATEGORY[event.toolName]
  } else if (EVENT_TYPE_TO_CATEGORY[event.eventType]) {
    category = EVENT_TYPE_TO_CATEGORY[event.eventType]
  }

  // Determine weight based on event importance
  let weight = 1
  if (event.eventType === 'user_prompt') weight = 2 // User input is important
  if (event.toolName === 'Write' || event.toolName === 'Edit') weight = 2 // Creation is important
  if (event.eventType === 'session_start') weight = 1.5
  if (event.eventType === 'session_end') weight = 0 // Just animation

  return {
    id: event.id,
    category,
    label: event.summary || formatEventLabel(event),
    weight,
    timestamp: new Date(event.createdAt),
    metadata: {
      ...event.metadata,  // Spread first so our explicit values take precedence
      eventType: event.eventType,
      toolName: event.toolName,
    },
  }
}

/**
 * Convert multiple session events to progress events
 */
export function sessionEventsToProgressEvents(events: SessionEvent[]): ProgressEvent[] {
  return events.map(sessionEventToProgressEvent)
}

/**
 * Format a human-readable label for an event
 */
function formatEventLabel(event: SessionEvent): string {
  if (event.toolName) {
    return `${event.toolName}`
  }

  switch (event.eventType) {
    case 'session_start':
      return 'Session started'
    case 'session_end':
      return 'Session ended'
    case 'user_prompt':
      return 'Prompt'
    case 'permission_request':
      return 'Waiting for permission'
    case 'context_compaction':
      return 'Context compacted'
    default:
      return event.eventType.replace(/_/g, ' ')
  }
}

// =============================================================================
// REAL-TIME ADAPTER HOOK
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseSessionProgressOptions {
  sessionId: string
  initialEvents?: SessionEvent[]
  onEvent?: (event: ProgressEvent) => void
}

export interface UseSessionProgressReturn {
  events: ProgressEvent[]
  addEvent: (event: SessionEvent) => void
  reset: () => void
}

/**
 * Hook to manage progress events for a session.
 * Can be connected to SignalR for real-time updates.
 */
export function useSessionProgress(
  options: UseSessionProgressOptions
): UseSessionProgressReturn {
  const { sessionId, initialEvents = [], onEvent } = options

  const [events, setEvents] = useState<ProgressEvent[]>(() =>
    sessionEventsToProgressEvents(initialEvents)
  )

  const processedIds = useRef<Set<string>>(new Set(initialEvents.map(e => e.id)))

  const addEvent = useCallback((sessionEvent: SessionEvent) => {
    // Skip if already processed
    if (processedIds.current.has(sessionEvent.id)) return
    processedIds.current.add(sessionEvent.id)

    const progressEvent = sessionEventToProgressEvent(sessionEvent)

    setEvents(prev => [...prev, progressEvent])
    onEvent?.(progressEvent)
  }, [onEvent])

  const reset = useCallback(() => {
    setEvents([])
    processedIds.current.clear()
  }, [])

  // Reset when session changes
  useEffect(() => {
    reset()
    const initialProgressEvents = sessionEventsToProgressEvents(initialEvents)
    setEvents(initialProgressEvents)
    initialEvents.forEach(e => processedIds.current.add(e.id))
  }, [sessionId, initialEvents, reset])

  return { events, addEvent, reset }
}
