'use client'

/**
 * PixelProgress Component
 *
 * Main React component for rendering pixel progress visualizations.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { usePixelProgress } from '../hooks/usePixelProgress'
import type {
  ProgressEvent,
  PixelProgressConfig,
  Construction,
  ConstructionStats,
} from '../types'
import { SIZE_PRESETS, type SizePreset } from '../constants'
import { getTheme } from '../themes'
import { getSoundEngine } from '../core/SoundEngine'
import { SynthControlPanel } from '@/components/synth'

// =============================================================================
// TYPES
// =============================================================================

export interface PixelProgressProps {
  /** Unique identifier */
  id: string

  /** Event stream */
  events: ProgressEvent[]

  /** Theme ID */
  theme?: string

  /** Configuration */
  config?: Partial<PixelProgressConfig>

  /** Size preset */
  size?: SizePreset | 'full'

  /** Custom dimensions */
  width?: number | string
  height?: number | string

  /** Allow expanding to fullscreen */
  expandable?: boolean

  /** Controlled expand state */
  expanded?: boolean
  onExpandChange?: (expanded: boolean) => void

  /** Show controls */
  showControls?: boolean

  /** Show progress bar */
  showProgress?: boolean

  /** Enable sound effects */
  soundEnabled?: boolean

  /** Callback when sound is toggled */
  onSoundToggle?: (enabled: boolean) => void

  /** Sound volume (0-1) */
  soundVolume?: number

  /** Callbacks */
  onPhaseChange?: (phase: Construction['phase']) => void
  onProgress?: (progress: number) => void
  onComplete?: (construction: Construction, stats: ConstructionStats) => void

  /** Styling */
  className?: string
  style?: React.CSSProperties
}

// =============================================================================
// COMPONENT
// =============================================================================

// Speed presets for replay
const SPEED_PRESETS = [0.1, 0.25, 0.5, 1, 2] as const
type SpeedPreset = typeof SPEED_PRESETS[number]

export function PixelProgress({
  id,
  events,
  theme: themeId = 'painter',
  config,
  size = 'md',
  width,
  height,
  expandable = true,
  expanded: controlledExpanded,
  onExpandChange,
  showControls = false,
  showProgress = true,
  soundEnabled = false,
  onSoundToggle,
  soundVolume = 0.3,
  onPhaseChange,
  onProgress,
  onComplete,
  className,
  style,
}: PixelProgressProps) {
  // Local expanded state
  const [localExpanded, setLocalExpanded] = useState(false)
  const expanded = controlledExpanded ?? localExpanded

  // Speed control state
  const [speedIndex, setSpeedIndex] = useState(3) // Default to 1x (index 3 in [0.1, 0.25, 0.5, 1, 2])
  const currentSpeed = SPEED_PRESETS[speedIndex]
  const [speedChangeCounter, setSpeedChangeCounter] = useState(0)

  // Synth control panel state
  const [synthPanelOpen, setSynthPanelOpen] = useState(false)

  const cycleSpeed = () => {
    setSpeedIndex((prev) => (prev + 1) % SPEED_PRESETS.length)
    // Trigger a reset and replay at new speed
    setSpeedChangeCounter((prev) => prev + 1)
  }

  const handleExpandChange = (value: boolean) => {
    setLocalExpanded(value)
    onExpandChange?.(value)
  }

  // Get theme for dimensions
  const themeManifest = useMemo(() => {
    const t = getTheme(themeId)
    return t?.manifest
  }, [themeId])

  // Use the hook with speed-adjusted config
  const speedAdjustedConfig = useMemo(() => ({
    ...config,
    animationSpeed: (config?.animationSpeed ?? 1) * currentSpeed,
  }), [config, currentSpeed])

  const {
    canvasRef,
    construction,
    builderState,
    progress,
    phase,
    isComplete,
    processEvents,
    reset,
    getStats,
    scroll,
    resetScroll,
  } = usePixelProgress({
    id,
    themeId,
    config: speedAdjustedConfig,
    soundEnabled,
    soundVolume,
    onPhaseChange,
    onProgress,
    onComplete,
  })

  // Process events when they change
  useEffect(() => {
    if (events.length > 0) {
      processEvents(events)
    }
  }, [events, processEvents])

  // Reset and replay when speed changes
  useEffect(() => {
    if (speedChangeCounter > 0 && events.length > 0) {
      reset()
      // Small delay to ensure reset completes before replaying
      const timer = setTimeout(() => {
        processEvents(events)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [speedChangeCounter])

  // Handle mouse wheel for scrolling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    // Scroll amount: positive deltaY = scroll down (see lower parts of build)
    const scrollAmount = e.deltaY * 0.002 // Adjust sensitivity
    scroll(-scrollAmount) // Negative because we want wheel up = see higher parts
  }

  // Calculate dimensions - SIZE_PRESETS are final display sizes
  const dimensions = useMemo(() => {
    if (width && height) {
      return { width, height }
    }

    if (size === 'full') {
      return { width: '100%', height: '100%' }
    }

    const preset = SIZE_PRESETS[size]
    // SIZE_PRESETS are already the display dimensions, don't multiply by scale
    return {
      width: preset.width,
      height: preset.height,
    }
  }, [size, width, height])

  // Fullscreen handling
  useEffect(() => {
    if (!expanded) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExpandChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [expanded])

  // Render content
  const content = (
    <div
      className={`pixel-progress-container ${className ?? ''}`}
      style={{
        position: 'relative',
        width: typeof dimensions.width === 'number' ? `${dimensions.width}px` : dimensions.width,
        height: typeof dimensions.height === 'number' ? `${dimensions.height}px` : dimensions.height,
        backgroundColor: themeManifest?.backgroundColor ?? '#1a1a2e',
        borderRadius: expanded ? 0 : '8px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
        }}
      />

      {/* Progress bar */}
      {showProgress && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              backgroundColor: isComplete ? '#4ade80' : '#60a5fa',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      )}

      {/* Expand button */}
      {expandable && !expanded && (
        <button
          onClick={() => handleExpandChange(true)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          className="expand-button"
        >
          ⛶
        </button>
      )}

      {/* Controls */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            bottom: showProgress ? '12px' : '8px',
            left: '8px',
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            onClick={reset}
            style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Reset
          </button>

          <span
            style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          >
            {phase} • {construction?.pieces.length ?? 0} pieces
          </span>
        </div>
      )}

      {/* Completion overlay */}
      {isComplete && config?.showSummaryOnComplete && (
        <CompletionOverlay stats={getStats()} onClose={() => {}} />
      )}

      <style jsx>{`
        .pixel-progress-container:hover .expand-button {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )

  // Render with fullscreen overlay if expanded
  return (
    <>
      {expanded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
          }}
          onClick={() => handleExpandChange(false)}
        />
      )}
      {expanded && (
        <button
          onClick={() => handleExpandChange(false)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            padding: '8px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Close (Esc)
        </button>
      )}
      <div
        className={`pixel-progress-container ${className ?? ''}`}
        onWheel={handleWheel}
        onDoubleClick={resetScroll}
        title="Scroll to pan view, double-click to reset"
        style={{
          position: expanded ? 'fixed' : 'relative',
          cursor: 'grab',
          ...(expanded ? {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            width: '90vw',
            height: '90vh',
            maxWidth: '1600px',
            maxHeight: '900px',
          } : {
            width: typeof dimensions.width === 'number' ? `${dimensions.width}px` : dimensions.width,
            height: typeof dimensions.height === 'number' ? `${dimensions.height}px` : dimensions.height,
          }),
          backgroundColor: themeManifest?.backgroundColor ?? '#1a1a2e',
          borderRadius: expanded ? '8px' : '8px',
          overflow: 'hidden',
          ...style,
        }}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
          }}
        />

        {/* Progress bar */}
        {showProgress && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: expanded ? '6px' : '4px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                backgroundColor: isComplete ? '#4ade80' : '#60a5fa',
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
        )}

        {/* Expand button (only when not expanded) */}
        {expandable && !expanded && (
          <button
            onClick={() => handleExpandChange(true)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '4px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
            className="expand-button"
          >
            ⛶
          </button>
        )}

        {/* Scroll indicators and controls */}
        <div
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            opacity: 0.8,
          }}
          className="scroll-indicators"
        >
          {(construction?.pieces.length ?? 0) > 10 && (
            <>
              <button
                onClick={() => scroll(0.1)}
                style={{
                  width: '24px',
                  height: '20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Scroll up to see top"
              >
                ▲
              </button>
              <button
                onClick={() => scroll(-0.1)}
                style={{
                  width: '24px',
                  height: '20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Scroll down to see bottom"
              >
                ▼
              </button>
            </>
          )}
          {/* Reset button */}
          <button
            onClick={reset}
            style={{
              width: '24px',
              height: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Reset / Replay"
          >
            ↺
          </button>
          {/* Speed control button */}
          <button
            onClick={cycleSpeed}
            style={{
              width: '24px',
              height: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
            title={`Speed: ${currentSpeed}x (click to cycle)`}
          >
            {currentSpeed}x
          </button>
          {/* Sound toggle button */}
          {onSoundToggle && (
            <button
              onClick={() => {
                // iOS Safari requires AudioContext unlock during user gesture
                const engine = getSoundEngine()
                engine.unlockAudio()
                onSoundToggle(!soundEnabled)
              }}
              style={{
                width: '24px',
                height: '20px',
                backgroundColor: soundEnabled ? 'rgba(59, 130, 246, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={soundEnabled ? 'Mute sound' : 'Enable sound'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          )}
          {/* Synth control button */}
          {soundEnabled && (
            <button
              onClick={() => setSynthPanelOpen(true)}
              style={{
                width: '24px',
                height: '20px',
                backgroundColor: synthPanelOpen ? 'rgba(59, 130, 246, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Synth Settings"
            >
              🎹
            </button>
          )}
        </div>

        {/* Controls */}
        {(showControls || expanded) && (
          <div
            style={{
              position: 'absolute',
              bottom: showProgress ? '12px' : '8px',
              left: '8px',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Reset
            </button>

            <span
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              {phase} • {construction?.pieces.length ?? 0} pieces
            </span>
          </div>
        )}

        {/* Completion overlay */}
        {isComplete && config?.showSummaryOnComplete && (
          <CompletionOverlay stats={getStats()} onClose={() => {}} />
        )}

        <style jsx>{`
          .pixel-progress-container:hover .expand-button {
            opacity: 1 !important;
          }
        `}</style>
      </div>

      {/* Synth Control Panel */}
      <SynthControlPanel
        open={synthPanelOpen}
        onOpenChange={setSynthPanelOpen}
        onReplay={() => {
          // Reset and replay with current synth settings
          reset()
          setTimeout(() => {
            processEvents(events)
          }, 50)
        }}
      />
    </>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface CompletionOverlayProps {
  stats: ConstructionStats
  onClose: () => void
}

function CompletionOverlay({ stats, onClose }: CompletionOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '16px',
      }}
    >
      <h3 style={{ margin: 0, fontSize: '14px', marginBottom: '12px' }}>
        Complete!
      </h3>

      <div style={{ fontSize: '11px', textAlign: 'center', lineHeight: 1.6 }}>
        <div>Events: {stats.totalEvents}</div>
        <div>Pieces: {stats.totalPieces}</div>
        <div>Duration: {Math.round(stats.totalDuration / 1000)}s</div>
        {stats.tokensUsed && <div>Tokens: {stats.tokensUsed.toLocaleString()}</div>}
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: '12px',
          padding: '4px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        Continue
      </button>
    </div>
  )
}

export default PixelProgress
