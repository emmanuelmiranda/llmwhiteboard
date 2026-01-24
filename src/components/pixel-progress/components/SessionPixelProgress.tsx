'use client'

/**
 * SessionPixelProgress
 *
 * A pixel progress component that automatically connects to SignalR
 * and visualizes session events in real-time.
 */

import React, { useEffect, useCallback, useState } from 'react'
import { PixelProgress, type PixelProgressProps } from './PixelProgress'
import {
  useSessionProgress,
  type SessionEvent,
} from '../integrations/session-adapter'
import { useSignalRContext } from '@/components/signalr-provider'
import { apiClient } from '@/lib/api-client'

export interface SessionPixelProgressProps
  extends Omit<PixelProgressProps, 'id' | 'events'> {
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

export function SessionPixelProgress({
  sessionId,
  loadHistory = true,
  maxHistoryEvents = 100,
  theme = 'lego',
  soundEnabled = false,
  onSoundToggle,
  soundVolume = 0.3,
  ...props
}: SessionPixelProgressProps) {
  const signalR = useSignalRContext()
  const [initialEvents, setInitialEvents] = useState<SessionEvent[]>([])
  const [isLoading, setIsLoading] = useState(loadHistory)

  const { events, addEvent, reset } = useSessionProgress({
    sessionId,
    initialEvents,
  })

  // Load historical events
  useEffect(() => {
    if (!loadHistory) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadEvents() {
      try {
        const response = await apiClient.getSessionEvents(sessionId, {
          limit: maxHistoryEvents,
        })

        if (!cancelled && response.events) {
          setInitialEvents(response.events)
        }
      } catch (error) {
        console.error('Failed to load session events:', error)
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
  }, [sessionId, loadHistory, maxHistoryEvents])

  // Subscribe to real-time events
  useEffect(() => {
    if (!signalR) return

    // Join the session room for real-time updates
    signalR.joinSession(sessionId)

    // Listen for new events
    const unsubscribe = signalR.onNewEvent((event: SessionEvent) => {
      if (event.sessionId === sessionId) {
        addEvent(event)
      }
    })

    return () => {
      unsubscribe()
      signalR.leaveSession(sessionId)
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
      id={`session-${sessionId}`}
      events={events}
      theme={theme}
      soundEnabled={soundEnabled}
      onSoundToggle={onSoundToggle}
      soundVolume={soundVolume}
      {...props}
    />
  )
}

// Also export a simpler hook for custom implementations
export function useSessionPixelProgress(sessionId: string) {
  const signalR = useSignalRContext()
  const [initialEvents, setInitialEvents] = useState<SessionEvent[]>([])

  const { events, addEvent, reset } = useSessionProgress({
    sessionId,
    initialEvents,
  })

  // Subscribe to real-time events
  useEffect(() => {
    if (!signalR) return

    signalR.joinSession(sessionId)

    const unsubscribe = signalR.onNewEvent((event: SessionEvent) => {
      if (event.sessionId === sessionId) {
        addEvent(event)
      }
    })

    return () => {
      unsubscribe()
      signalR.leaveSession(sessionId)
    }
  }, [signalR, sessionId, addEvent])

  return {
    events,
    addEvent,
    reset,
    loadHistory: async (limit = 100) => {
      try {
        const response = await apiClient.getSessionEvents(sessionId, { limit })
        if (response.events) {
          setInitialEvents(response.events)
        }
      } catch (error) {
        console.error('Failed to load session events:', error)
      }
    },
  }
}
