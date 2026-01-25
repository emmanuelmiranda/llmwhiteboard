'use client'

/**
 * Pixel Progress Demo Page
 *
 * Test page for developing and previewing pixel progress animations.
 */

import React, { useState, useCallback, useRef } from 'react'
import { PixelProgress } from '@/components/pixel-progress'
import type { ProgressEvent } from '@/components/pixel-progress'
import { STANDARD_CATEGORIES } from '@/components/pixel-progress'

// =============================================================================
// MOCK EVENT SCENARIOS
// =============================================================================

const SCENARIOS: Record<string, Omit<ProgressEvent, 'id' | 'timestamp'>[]> = {
  'typical-coding': [
    { category: 'start', label: 'Session started' },
    { category: 'analyze', label: 'Reading package.json' },
    { category: 'search', label: 'Searching for components' },
    { category: 'analyze', label: 'Reading src/index.ts' },
    { category: 'analyze', label: 'Understanding codebase' },
    { category: 'process', label: 'Planning implementation' },
    { category: 'create', label: 'Writing new-feature.ts', weight: 2 },
    { category: 'create', label: 'Writing tests', weight: 1.5 },
    { category: 'execute', label: 'Running npm build' },
    { category: 'error', label: 'Type error found' },
    { category: 'modify', label: 'Fixing type error' },
    { category: 'execute', label: 'Running npm build' },
    { category: 'success', label: 'Build successful' },
    { category: 'create', label: 'Adding documentation', weight: 1 },
    { category: 'end', label: 'Session complete' },
  ],

  'heavy-research': [
    { category: 'start', label: 'Session started' },
    { category: 'search', label: 'Finding auth files' },
    { category: 'analyze', label: 'Reading auth/provider.ts' },
    { category: 'search', label: 'Searching for middleware' },
    { category: 'analyze', label: 'Reading middleware/auth.ts' },
    { category: 'search', label: 'Looking for tests' },
    { category: 'analyze', label: 'Reading auth.test.ts' },
    { category: 'analyze', label: 'Reading config files' },
    { category: 'search', label: 'Finding dependencies' },
    { category: 'analyze', label: 'Understanding flow' },
    { category: 'process', label: 'Summarizing findings' },
    { category: 'end', label: 'Research complete' },
  ],

  'rapid-creation': [
    { category: 'start', label: 'Session started' },
    { category: 'create', label: 'Creating component', weight: 2 },
    { category: 'create', label: 'Creating styles', weight: 1 },
    { category: 'create', label: 'Creating types', weight: 1 },
    { category: 'create', label: 'Creating hooks', weight: 2 },
    { category: 'create', label: 'Creating utils', weight: 1 },
    { category: 'create', label: 'Creating tests', weight: 1.5 },
    { category: 'create', label: 'Creating stories', weight: 1 },
    { category: 'execute', label: 'Running tests' },
    { category: 'success', label: 'All tests pass' },
    { category: 'end', label: 'Feature complete' },
  ],

  'debugging-session': [
    { category: 'start', label: 'Session started' },
    { category: 'analyze', label: 'Reading error logs' },
    { category: 'search', label: 'Finding error source' },
    { category: 'analyze', label: 'Reading problematic code' },
    { category: 'process', label: 'Analyzing issue' },
    { category: 'modify', label: 'Attempting fix 1' },
    { category: 'execute', label: 'Testing fix' },
    { category: 'error', label: 'Still failing' },
    { category: 'analyze', label: 'Deeper investigation' },
    { category: 'modify', label: 'Attempting fix 2' },
    { category: 'execute', label: 'Testing fix' },
    { category: 'error', label: 'Different error' },
    { category: 'search', label: 'Searching docs' },
    { category: 'analyze', label: 'Reading documentation' },
    { category: 'modify', label: 'Final fix' },
    { category: 'execute', label: 'Testing fix' },
    { category: 'success', label: 'Bug fixed!' },
    { category: 'end', label: 'Session complete' },
  ],

  'with-user-input': [
    { category: 'start', label: 'Session started' },
    { category: 'analyze', label: 'Reading requirements' },
    { category: 'wait', label: 'Waiting for user input' },
    { category: 'input', label: 'User provided direction' },
    { category: 'create', label: 'Implementing feature', weight: 2 },
    { category: 'wait', label: 'Waiting for approval' },
    { category: 'input', label: 'User approved approach' },
    { category: 'create', label: 'Continuing implementation', weight: 2 },
    { category: 'execute', label: 'Running tests' },
    { category: 'wait', label: 'Waiting for final review' },
    { category: 'input', label: 'User confirmed' },
    { category: 'end', label: 'Session complete' },
  ],
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

const AVAILABLE_THEMES = [
  { id: 'lego', name: 'LEGO Builder' },
  { id: 'painter', name: 'Pixel Painter' },
  { id: 'garden', name: 'Zen Garden' },
]

export default function PixelProgressDemoPage() {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [selectedScenario, setSelectedScenario] = useState('typical-coding')
  const [selectedTheme, setSelectedTheme] = useState('lego')
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout)
    timeoutRefs.current = []
  }, [])

  // Play scenario
  const playScenario = useCallback(() => {
    clearTimeouts()
    setEvents([])
    setIsPlaying(true)
    setSessionKey((k) => k + 1)

    const scenario = SCENARIOS[selectedScenario]
    const newEvents: ProgressEvent[] = []
    const baseDelay = 600 / playbackSpeed

    scenario.forEach((template, index) => {
      const timeout = setTimeout(
        () => {
          const event: ProgressEvent = {
            id: `event-${Date.now()}-${index}`,
            category: template.category,
            label: template.label,
            weight: template.weight,
            timestamp: new Date(),
          }

          newEvents.push(event)
          setEvents([...newEvents])

          // Check if this is the last event
          if (index === scenario.length - 1) {
            setIsPlaying(false)
          }
        },
        index * baseDelay + Math.random() * 200
      )

      timeoutRefs.current.push(timeout)
    })
  }, [selectedScenario, playbackSpeed, clearTimeouts])

  // Stop playback
  const stopPlayback = useCallback(() => {
    clearTimeouts()
    setIsPlaying(false)
  }, [clearTimeouts])

  // Reset
  const resetDemo = useCallback(() => {
    clearTimeouts()
    setEvents([])
    setIsPlaying(false)
    setSessionKey((k) => k + 1)
  }, [clearTimeouts])

  // Add single event
  const addEvent = useCallback((category: string) => {
    const event: ProgressEvent = {
      id: `event-${Date.now()}`,
      category,
      label: `Manual ${category} event`,
      timestamp: new Date(),
    }
    setEvents((prev) => [...prev, event])
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Pixel Progress Demo</h1>
        <p className="text-muted-foreground">
          Test and preview pixel progress animations with different scenarios
        </p>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
        <select
          value={selectedTheme}
          onChange={(e) => {
            setSelectedTheme(e.target.value)
            resetDemo()
          }}
          className="bg-background border rounded px-3 py-2 text-sm font-medium"
        >
          {AVAILABLE_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>

        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-background border rounded px-3 py-2 text-sm"
        >
          {Object.keys(SCENARIOS).map((key) => (
            <option key={key} value={key}>
              {key.replace(/-/g, ' ')}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Speed:</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm w-10">{playbackSpeed}x</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={playScenario}
            disabled={isPlaying}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-medium"
          >
            {isPlaying ? 'Playing...' : '▶ Play'}
          </button>

          <button
            onClick={stopPlayback}
            disabled={!isPlaying}
            className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded text-sm"
          >
            ⏸
          </button>

          <button
            onClick={resetDemo}
            className="px-3 py-2 bg-destructive hover:bg-destructive/90 text-white rounded text-sm"
          >
            Reset
          </button>
        </div>

        <div className="text-sm text-muted-foreground ml-auto">
          {events.length} events
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canvas */}
        <div className="bg-card rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-3">Canvas</h2>
          <div className="flex justify-center">
            <PixelProgress
              key={`${sessionKey}-${selectedTheme}`}
              id={`demo-${sessionKey}`}
              events={events}
              theme={selectedTheme}
              size="lg"
              expandable
              showControls
              showProgress
              soundEnabled={soundEnabled}
              onSoundToggle={setSoundEnabled}
              onComplete={(construction, stats) => {
                console.log('Complete!', { construction, stats })
              }}
            />
          </div>
        </div>

        {/* Event Log & Manual Events */}
        <div className="space-y-4">
          {/* Manual Events */}
          <div className="bg-card rounded-lg border p-4">
            <h2 className="text-sm font-medium mb-3">Add Events Manually</h2>
            <div className="flex flex-wrap gap-2">
              {Object.values(STANDARD_CATEGORIES).slice(0, 12).map((category) => (
                <button
                  key={category}
                  onClick={() => addEvent(category)}
                  className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-xs"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-card rounded-lg border p-4">
            <h2 className="text-sm font-medium mb-3">Event Log</h2>
            <div className="max-h-64 overflow-y-auto bg-muted/50 rounded p-3 font-mono text-xs space-y-1">
              {events.length === 0 ? (
                <div className="text-muted-foreground">
                  No events yet. Click Play or add events manually.
                </div>
              ) : (
                events.map((event, i) => (
                  <div key={event.id} className="text-muted-foreground">
                    <span className="text-muted-foreground/50">{i + 1}.</span>{' '}
                    <span className="text-primary">{event.category}</span>
                    {event.label && (
                      <span className="text-muted-foreground/70"> - {event.label}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-card rounded-lg border p-4">
        <h2 className="text-sm font-medium mb-2">About Pixel Progress</h2>
        <p className="text-sm text-muted-foreground">
          This component visualizes progress as generative pixel art. Each session creates a
          unique piece of art based on the events that occur. The painter character reacts
          to different event types - working when creating, waiting when idle, celebrating
          on completion. Click the expand button (⛶) on the canvas to view fullscreen.
        </p>
      </div>
    </div>
  )
}
