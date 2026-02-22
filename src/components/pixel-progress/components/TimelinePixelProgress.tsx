'use client'

/**
 * TimelinePixelProgress
 *
 * A pixel progress component that visualizes events from ALL sessions
 * combined into a single unified construction.
 */

import React, { useEffect, useMemo, useCallback, useRef } from 'react'
import { PixelProgress } from './PixelProgress'
import type { ProgressEvent } from '../types'
import { useSignalRContext } from '@/components/signalr-provider'
import { getDisplayHints, resolveHexColor, VALID_CATEGORIES } from '@/lib/display-hints'

// Map session event types to pixel-progress categories
const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  session_start: 'start',
  session_end: 'end',
  user_prompt: 'input',
  permission_request: 'wait',
  tool_use: 'execute',
  tool_use_start: 'process',
  agent_stop: 'end',
  subagent_stop: 'success',  // Subagent completed successfully
  stop: 'end',
  context_compaction: 'optimize',
  notification: 'output',
  model_request: 'analyze',
  model_response: 'output',
}

const TOOL_NAME_TO_CATEGORY: Record<string, string> = {
  Read: 'analyze',
  Glob: 'search',
  Grep: 'search',
  Write: 'create',
  Edit: 'modify',
  NotebookEdit: 'modify',
  Bash: 'execute',
  AskUserQuestion: 'wait',
  TodoWrite: 'process',
  Task: 'process',
  WebFetch: 'search',
  WebSearch: 'search',
}

interface TimelineEvent {
  id: string
  sessionId: string
  eventType: string
  toolName: string | null
  summary: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface TimelinePixelProgressProps {
  /** Initial events to display */
  events: TimelineEvent[]
  /** Enable sound effects */
  soundEnabled?: boolean
  /** Callback when sound is toggled */
  onSoundToggle?: (enabled: boolean) => void
  /** Sound volume (0-1) */
  soundVolume?: number
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Theme to use */
  theme?: string
  /** Additional class name */
  className?: string
  /** Subscribe to team events instead of personal events */
  teamMode?: boolean
}

function timelineEventToProgressEvent(event: TimelineEvent): ProgressEvent {
  const hints = getDisplayHints(event.metadata)

  // Determine category: display hint > tool name > event type
  let category = 'process'

  if (hints.category && VALID_CATEGORIES.has(hints.category)) {
    category = hints.category
  } else if (event.toolName && TOOL_NAME_TO_CATEGORY[event.toolName]) {
    category = TOOL_NAME_TO_CATEGORY[event.toolName]
  } else if (EVENT_TYPE_TO_CATEGORY[event.eventType]) {
    category = EVENT_TYPE_TO_CATEGORY[event.eventType]
  }

  // Determine weight: display hint > hardcoded defaults
  let weight = 1
  if (hints.weight !== null) {
    weight = hints.weight
  } else {
    if (event.eventType === 'user_prompt') weight = 2
    if (event.toolName === 'Write' || event.toolName === 'Edit') weight = 2
    if (event.eventType === 'session_start') weight = 1.5
    if (event.eventType === 'session_end') weight = 0
  }

  // Resolve display color to hex for pixel art themes
  const displayHexColor = resolveHexColor(hints.color)

  return {
    id: event.id,
    category,
    label: hints.label || event.summary || event.toolName || event.eventType,
    weight,
    timestamp: new Date(event.createdAt),
    metadata: {
      eventType: event.eventType,
      toolName: event.toolName,
      sessionId: event.sessionId,
      ...event.metadata,
      ...(displayHexColor ? { displayHexColor } : {}),
    },
  }
}

export function TimelinePixelProgress({
  events: initialEvents,
  soundEnabled = false,
  onSoundToggle,
  soundVolume = 0.3,
  size = 'md',
  theme = 'lego',
  className,
  teamMode = false,
}: TimelinePixelProgressProps) {
  const signalR = useSignalRContext()
  const [events, setEvents] = React.useState<ProgressEvent[]>([])
  const processedIds = useRef<Set<string>>(new Set())

  // Convert initial events to progress events
  useEffect(() => {
    console.log('[TimelinePixelProgress] Converting', initialEvents.length, 'initial events')
    const progressEvents = initialEvents.map(timelineEventToProgressEvent)
    setEvents(progressEvents)
    processedIds.current = new Set(initialEvents.map(e => e.id))
  }, [initialEvents])

  // Subscribe to real-time events from ALL sessions (personal or team)
  useEffect(() => {
    if (!signalR) return

    const handler = (event: TimelineEvent) => {
      // Skip if already processed
      if (processedIds.current.has(event.id)) return
      processedIds.current.add(event.id)

      const progressEvent = timelineEventToProgressEvent(event)
      setEvents(prev => [...prev, progressEvent])
    }

    const unsubscribe = teamMode
      ? signalR.onTeamNewEvent(handler)
      : signalR.onNewEvent(handler)

    return unsubscribe
  }, [signalR, teamMode])

  console.log('[TimelinePixelProgress] Rendering with', events.length, 'events, size:', size)

  return (
    <PixelProgress
      id="timeline-combined"
      events={events}
      theme={theme}
      size={size}
      soundEnabled={soundEnabled}
      onSoundToggle={onSoundToggle}
      soundVolume={soundVolume}
      className={className}
    />
  )
}

export default TimelinePixelProgress
