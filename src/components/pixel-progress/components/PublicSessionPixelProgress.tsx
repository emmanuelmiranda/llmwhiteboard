'use client'

/**
 * PublicSessionPixelProgress
 *
 * A pixel progress component for public share pages that uses the public SignalR
 * context and public API endpoints.
 */

import React, { useEffect, useCallback, useState } from 'react'
import { PixelProgress, type PixelProgressProps } from './PixelProgress'
import {
  useSessionProgress,
  type SessionEvent,
} from '../integrations/session-adapter'
import { usePublicSignalRContext, type PublicEvent } from '@/components/public-signalr-provider'
import { apiClient } from '@/lib/api-client'

export interface PublicSessionPixelProgressProps
  extends Omit<PixelProgressProps, 'id' | 'events'> {
  /** Share token for API authentication */
  token: string
  /** Session ID to visualize */
  sessionId: string
  /** Whether to load historical events on mount */
  loadHistory?: boolean
  /** Max historical events to load */
  maxHistoryEvents?: number
  /** Enable sound effects */
  soundEnabled?: boolean
  /** Callback when sound is toggled */
  onSoundToggle?: (enabled: boolean) => void
  /** Sound volume (0-1) */
  soundVolume?: number
}

/**
 * Convert PublicEvent to SessionEvent format
 */
function publicEventToSessionEvent(event: PublicEvent): SessionEvent {
  return {
    id: event.id,
    sessionId: event.sessionId,
    eventType: event.eventType,
    toolName: event.toolName,
    summary: event.summary ?? null,
    metadata: (event.metadata as Record<string, unknown>) ?? null,
    createdAt: event.createdAt,
  }
}

export function PublicSessionPixelProgress({
  token,
  sessionId,
  loadHistory = true,
  maxHistoryEvents = 100,
  theme = 'lego',
  soundEnabled = false,
  onSoundToggle,
  soundVolume = 0.3,
  ...props
}: PublicSessionPixelProgressProps) {
  const signalR = usePublicSignalRContext()
  const [initialEvents, setInitialEvents] = useState<SessionEvent[]>([])
  const [isLoading, setIsLoading] = useState(loadHistory)

  const { events, addEvent, reset } = useSessionProgress({
    sessionId,
    initialEvents,
  })

  // Load historical events using public API
  useEffect(() => {
    if (!loadHistory) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadEvents() {
      try {
        const response = await apiClient.getPublicSessionEvents(token, sessionId, {
          limit: maxHistoryEvents,
        })

        if (!cancelled && response.events) {
          // Convert PublicEvent[] to SessionEvent[]
          const sessionEvents = response.events.map(publicEventToSessionEvent)
          setInitialEvents(sessionEvents)
        }
      } catch (error) {
        console.error('Failed to load public session events:', error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [token, sessionId, loadHistory, maxHistoryEvents])

  // Subscribe to real-time events using public SignalR
  useEffect(() => {
    if (!signalR) return

    // Listen for new events
    const unsubscribe = signalR.onNewEvent((event: PublicEvent) => {
      if (event.sessionId === sessionId) {
        addEvent(publicEventToSessionEvent(event))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [signalR, sessionId, addEvent])

  // Reset when session changes
  useEffect(() => {
    reset()
  }, [sessionId, reset])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading session...
        </div>
      </div>
    )
  }

  return (
    <PixelProgress
      id={`public-session-${sessionId}`}
      events={events}
      theme={theme}
      soundEnabled={soundEnabled}
      onSoundToggle={onSoundToggle}
      soundVolume={soundVolume}
      {...props}
    />
  )
}
