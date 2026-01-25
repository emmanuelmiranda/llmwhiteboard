/**
 * usePixelProgress Hook
 *
 * Main hook for managing pixel progress state and animations.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import type {
  Construction,
  ProgressEvent,
  PixelProgressConfig,
  BuilderState,
  RenderState,
  QueuedAnimation,
  Vec2,
  EventBehavior,
  ConstructionStats,
} from '../types'
import { DEFAULT_CONFIG } from '../types'
import { ConstructionEngine, type PositionGenerator, type SizeGenerator } from '../core/ConstructionEngine'
import { getSoundEngine } from '../core/SoundEngine'
import { Renderer, type RendererConfig } from '../core/Renderer'
import { BaseTheme, getTheme } from '../themes'
import { BuilderStateMachine, type BuilderEvent, type BubbleInfo } from '../core/BuilderStateMachine'

// =============================================================================
// HOOK
// =============================================================================

export interface UsePixelProgressOptions {
  id: string
  themeId?: string
  config?: Partial<PixelProgressConfig>
  /** Enable sound effects */
  soundEnabled?: boolean
  /** Sound volume (0-1) */
  soundVolume?: number
  onPhaseChange?: (phase: Construction['phase']) => void
  onProgress?: (progress: number) => void
  onComplete?: (construction: Construction, stats: ConstructionStats) => void
}

export interface UsePixelProgressReturn {
  // Refs
  canvasRef: React.RefObject<HTMLCanvasElement>

  // State
  construction: Construction | null
  builderState: BuilderState
  progress: number
  phase: Construction['phase']
  isComplete: boolean

  // Actions
  processEvent: (event: ProgressEvent) => void
  processEvents: (events: ProgressEvent[]) => void
  complete: () => void
  reset: () => void

  // Scrolling
  scroll: (delta: number) => void
  resetScroll: () => void

  // Stats
  getStats: () => ConstructionStats
}

export function usePixelProgress(
  options: UsePixelProgressOptions
): UsePixelProgressReturn {
  const {
    id,
    themeId = 'painter',
    config: userConfig,
    soundEnabled = false,
    soundVolume = 0.3,
    onPhaseChange,
    onProgress,
    onComplete,
  } = options

  const config: PixelProgressConfig = { ...DEFAULT_CONFIG, ...userConfig }
  const soundEngineRef = useRef(getSoundEngine())

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ConstructionEngine | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const themeRef = useRef<BaseTheme | null>(null)
  const animationFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const processedEventsRef = useRef<Set<string>>(new Set())
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // State machine for builder - single source of truth
  const stateMachineRef = useRef<BuilderStateMachine>(new BuilderStateMachine())

  // Animation state
  const [construction, setConstruction] = useState<Construction | null>(null)
  const [builderState, setBuilderState] = useState<BuilderState>('idle')
  const [bubbleInfo, setBubbleInfo] = useState<BubbleInfo | null>(null)
  const [builderPosition, setBuilderPosition] = useState<Vec2>({ x: 0.75, y: 0.6 })
  const [animationQueue, setAnimationQueue] = useState<QueuedAnimation[]>([])
  const [isComplete, setIsComplete] = useState(false)

  // Derived state
  const progress = construction?.progress ?? 0
  const phase = construction?.phase ?? 'empty'

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  // Reset state machine when id changes (new session)
  useEffect(() => {
    console.log('[usePixelProgress] Session ID changed to:', id, '- resetting state machine')
    const sm = stateMachineRef.current
    sm.reset()
    builderStateRef.current = 'idle'
    bubbleInfoRef.current = null
    setBuilderState('idle')
    setBubbleInfo(null)
    processedEventsRef.current.clear()
  }, [id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Load theme
    const theme = getTheme(themeId)
    if (!theme) {
      console.error(`Theme not found: ${themeId}`)
      return
    }
    themeRef.current = theme

    // Initialize engine
    const engine = new ConstructionEngine(
      id,
      (event) => theme.classifyEvent(event)
    )

    // Wire up theme's position and size generators if available
    const themePositionGen = theme.generatePiecePosition.bind(theme)
    engine.setPositionGenerator((category, existingPieces) => {
      const themePos = themePositionGen(category, existingPieces)
      if (themePos) return themePos
      // Fallback to default
      return { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4 }
    })

    const themeSizeGen = theme.getPieceSize.bind(theme)
    engine.setSizeGenerator((category) => {
      const themeSize = themeSizeGen(category)
      if (themeSize !== undefined) return themeSize
      return 0.8 + Math.random() * 0.4
    })

    engineRef.current = engine

    // Initialize renderer
    const rendererConfig: RendererConfig = {
      width: theme.manifest.dimensions.width,
      height: theme.manifest.dimensions.height,
      pixelScale: theme.manifest.pixelScale,
      backgroundColor: theme.manifest.backgroundColor,
      palette: theme.manifest.palette,
    }

    const renderer = new Renderer(canvas, rendererConfig)
    renderer.setPieceRenderer(theme.renderPiece)
    renderer.setBuilderRenderer(theme.renderBuilder)
    // Set batch connection renderer if theme provides it
    if (theme.renderConnections) {
      renderer.setBatchConnectionRenderer(theme.renderConnections.bind(theme))
    }
    rendererRef.current = renderer

    // Load theme assets
    theme.load().then(() => {
      setConstruction(engine.getConstruction())
      startRenderLoop()
    })

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      theme.dispose?.()
    }
  }, [id, themeId])

  // ===========================================================================
  // RENDER LOOP
  // ===========================================================================

  // Use refs for render loop to avoid stale closures
  const builderStateRef = useRef<BuilderState>(builderState)
  const builderPositionRef = useRef<Vec2>(builderPosition)
  const bubbleInfoRef = useRef<BubbleInfo | null>(bubbleInfo)

  // Helper to update builder state from state machine
  const updateFromStateMachine = useCallback((event: BuilderEvent) => {
    const sm = stateMachineRef.current
    const info = sm.transition(event)

    // Update refs immediately for render loop
    builderStateRef.current = info.state
    bubbleInfoRef.current = info.bubble

    // Update React state
    setBuilderState(info.state)
    setBubbleInfo(info.bubble)

    console.log('[usePixelProgress] State machine transition:', event.type, '→', info.state, 'bubble:', info.bubble?.text)

    return info
  }, [])

  useEffect(() => {
    builderPositionRef.current = builderPosition
  }, [builderPosition])

  // Track last logged state to avoid spamming console
  const lastLoggedStateRef = useRef<BuilderState>('idle')

  const startRenderLoop = useCallback(() => {
    const render = (time: number) => {
      const deltaTime = time - lastTimeRef.current
      lastTimeRef.current = time

      const engine = engineRef.current
      const renderer = rendererRef.current
      const theme = themeRef.current

      if (!engine || !renderer || !theme) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      // Log state changes in render loop
      if (builderStateRef.current !== lastLoggedStateRef.current) {
        console.log('[RenderLoop] Builder state changed to:', builderStateRef.current)
        lastLoggedStateRef.current = builderStateRef.current
      }

      // Build render state using refs to get fresh values
      const renderState: RenderState = {
        construction: engine.getConstruction(),
        builder: {
          state: builderStateRef.current,
          position: builderPositionRef.current,
          animationProgress: 0,
          bubble: bubbleInfoRef.current,
        },
        animationQueue: [],
        time,
        deltaTime,
      }

      // Render frame
      renderer.render(renderState)

      animationFrameRef.current = requestAnimationFrame(render)
    }

    animationFrameRef.current = requestAnimationFrame(render)
  }, [])

  // ===========================================================================
  // EVENT PROCESSING
  // ===========================================================================

  // Configure sound engine
  useEffect(() => {
    const soundEngine = soundEngineRef.current
    soundEngine.setEnabled(soundEnabled)
    soundEngine.setVolume(soundVolume)

    // Note: On iOS, AudioContext must be initialized/resumed during a user gesture
    // The actual init/resume happens in the sound toggle button's onClick handler
    // This effect just updates the enabled state and volume
    console.log('[usePixelProgress] Sound config updated, enabled:', soundEnabled, 'volume:', soundVolume)
  }, [soundEnabled, soundVolume])

  const processEvent = useCallback((event: ProgressEvent) => {
    const engine = engineRef.current
    const theme = themeRef.current
    const soundEngine = soundEngineRef.current
    const sm = stateMachineRef.current

    if (!engine || !theme) return

    // Skip already processed events
    if (processedEventsRef.current.has(event.id)) {
      return
    }
    processedEventsRef.current.add(event.id)

    // Get event metadata
    const eventType = event.metadata?.eventType as string | undefined
    const toolName = event.metadata?.toolName as string | undefined

    console.log('[usePixelProgress] Processing event:', event.id, 'eventType:', eventType, 'category:', event.category, 'toolName:', toolName)

    // Cancel any existing idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }

    // Map event to state machine event and transition
    let smEvent: BuilderEvent | null = null

    if (eventType === 'user_prompt') {
      console.log('[usePixelProgress] >>> USER_PROMPT detected, will transition to working')
      smEvent = { type: 'USER_PROMPT' }
    } else if (eventType === 'tool_use_start' && toolName) {
      smEvent = { type: 'TOOL_START', toolName }
    } else if (eventType === 'tool_use' && toolName) {
      smEvent = { type: 'TOOL_COMPLETE', toolName }
    } else if (eventType === 'permission_request' || event.category === 'wait') {
      smEvent = { type: 'PERMISSION_REQUEST' }
    } else if (eventType === 'session_end' || eventType === 'agent_stop' || eventType === 'session_paused' || eventType === 'stop') {
      console.log('[usePixelProgress] >>> SESSION_END detected (eventType:', eventType, '), will transition to celebrating')
      smEvent = { type: 'SESSION_END' }
    } else {
      console.log('[usePixelProgress] No state machine event for eventType:', eventType, 'category:', event.category)
    }

    // Transition state machine
    if (smEvent) {
      const info = updateFromStateMachine(smEvent)

      // Handle post-transition timeouts
      if (smEvent.type === 'SESSION_END') {
        // After celebrating, go idle
        idleTimeoutRef.current = setTimeout(() => {
          updateFromStateMachine({ type: 'CELEBRATION_COMPLETE' })
          idleTimeoutRef.current = null
        }, 2000)
      }
      // Note: INACTIVITY_TIMEOUT is no longer used for triggering celebration
      // Celebration only happens on explicit SESSION_END (when a block/turn completes)
    }

    // Play sound for every event
    soundEngine.playForCategory(event.category, toolName)

    // Process event in construction engine
    const result = engine.processEvent(event)

    // Update construction state
    const newConstruction = engine.getConstruction()
    setConstruction({ ...newConstruction })

    // Handle phase changes
    if (onPhaseChange && newConstruction.phase !== phase) {
      onPhaseChange(newConstruction.phase)
    }

    // Handle progress changes
    if (onProgress) {
      onProgress(newConstruction.progress)
    }

    // Check for completion
    if (event.category === 'end') {
      complete()
    }
  }, [phase, onPhaseChange, onProgress, updateFromStateMachine])

  const processEvents = useCallback((events: ProgressEvent[]) => {
    // Filter to only unprocessed events
    const unprocessed = events.filter(e => !processedEventsRef.current.has(e.id))

    if (unprocessed.length === 0) return

    // Sort by timestamp and process in order
    const sorted = [...unprocessed].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    // Auto-detect historical vs real-time based on batch size
    // Large batches (>5 events) are likely historical and should process faster
    // Small batches (1-5 events) are likely real-time and use normal timing
    // Speed is applied to both: higher speed = faster playback
    const isHistoricalBatch = sorted.length > 5
    const historicalDelay = 70 / config.animationSpeed
    const realtimeDelay = 530 / config.animationSpeed
    const baseDelay = isHistoricalBatch ? historicalDelay : realtimeDelay

    console.log(`[usePixelProgress] Processing ${sorted.length} events, historical: ${isHistoricalBatch}, speed: ${config.animationSpeed}x, delay: ${baseDelay}ms`)

    // Process with delay for animation
    sorted.forEach((event, index) => {
      setTimeout(() => {
        processEvent(event)
      }, index * baseDelay)
    })
  }, [processEvent, config.animationSpeed])

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const complete = useCallback(() => {
    const engine = engineRef.current
    const renderer = rendererRef.current
    const theme = themeRef.current
    const soundEngine = soundEngineRef.current

    if (!engine || !renderer || !theme) return

    engine.complete()
    setIsComplete(true)
    updateFromStateMachine({ type: 'SESSION_END' })

    // Play completion fanfare
    if (soundEnabled) {
      soundEngine.playCompletion()
    }

    // Spawn celebration particles
    if (config.completionCelebration) {
      renderer.spawnParticles({
        type: 'confetti',
        position: { x: 0.5, y: 0.3 },
        count: 30,
        spread: 0.5,
        colors: theme.manifest.palette,
        duration: 2000,
      })
    }

    const finalConstruction = engine.getConstruction()
    setConstruction({ ...finalConstruction })

    if (onComplete) {
      onComplete(finalConstruction, getStats())
    }
  }, [config.completionCelebration, onComplete])

  const reset = useCallback(() => {
    const engine = engineRef.current
    const theme = themeRef.current
    const sm = stateMachineRef.current
    if (!engine) return

    // Clear any pending idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }

    // Reset state machine
    sm.reset()
    builderStateRef.current = 'idle'
    bubbleInfoRef.current = null
    setBuilderState('idle')
    setBubbleInfo(null)

    engine.reset()
    theme?.onReset()
    processedEventsRef.current.clear()
    setConstruction(engine.getConstruction())
    setIsComplete(false)
    setAnimationQueue([])
  }, [])

  // ===========================================================================
  // STATS
  // ===========================================================================

  const getStats = useCallback((): ConstructionStats => {
    const engine = engineRef.current
    if (!engine) {
      return {
        totalEvents: 0,
        eventsByCategory: {},
        totalPieces: 0,
        piecesByCategory: {},
        userInputCount: 0,
        waitTime: 0,
        toolUseCount: 0,
        errorCount: 0,
        totalDuration: 0,
        activeDuration: 0,
        piecesPerMinute: 0,
        complexity: 0,
      }
    }

    const construction = engine.getConstruction()
    const events = engine.getEvents()

    // Calculate stats
    const eventsByCategory: Record<string, number> = {}
    const piecesByCategory: Record<string, number> = {}
    let userInputCount = 0
    let waitTime = 0
    let errorCount = 0

    for (const event of events) {
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1

      if (event.category === 'input') userInputCount++
      if (event.category === 'error') errorCount++
    }

    for (const piece of construction.pieces) {
      piecesByCategory[piece.category] = (piecesByCategory[piece.category] || 0) + 1
    }

    const totalDuration = construction.fingerprint.duration
    const piecesPerMinute = totalDuration > 0
      ? (construction.pieces.length / totalDuration) * 60000
      : 0

    return {
      totalEvents: events.length,
      eventsByCategory,
      totalPieces: construction.pieces.length,
      piecesByCategory,
      userInputCount,
      waitTime,
      toolUseCount: eventsByCategory['execute'] || 0,
      errorCount,
      totalDuration,
      activeDuration: totalDuration - waitTime,
      piecesPerMinute,
      complexity: construction.fingerprint.complexity === 'intricate' ? 1
        : construction.fingerprint.complexity === 'complex' ? 0.75
        : construction.fingerprint.complexity === 'moderate' ? 0.5
        : 0.25,
    }
  }, [])

  // ===========================================================================
  // SCROLLING
  // ===========================================================================

  const scroll = useCallback((delta: number) => {
    const theme = themeRef.current
    if (theme && 'scroll' in theme && typeof theme.scroll === 'function') {
      (theme as any).scroll(delta)
    }
  }, [])

  const resetScroll = useCallback(() => {
    const theme = themeRef.current
    if (theme && 'resetScroll' in theme && typeof theme.resetScroll === 'function') {
      (theme as any).resetScroll()
    }
  }, [])

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    canvasRef,
    construction,
    builderState,
    progress,
    phase,
    isComplete,
    processEvent,
    processEvents,
    complete,
    reset,
    getStats,
    scroll,
    resetScroll,
  }
}
