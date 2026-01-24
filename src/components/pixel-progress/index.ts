/**
 * Pixel Progress
 *
 * A library for visualizing progress as unique, generative pixel art.
 *
 * @example
 * ```tsx
 * import { PixelProgress } from '@/components/pixel-progress'
 *
 * function MyComponent() {
 *   const events = [
 *     { id: '1', category: 'start', timestamp: new Date() },
 *     { id: '2', category: 'create', timestamp: new Date() },
 *     // ... more events
 *   ]
 *
 *   return (
 *     <PixelProgress
 *       id="my-progress"
 *       events={events}
 *       theme="painter"
 *       size="md"
 *       expandable
 *     />
 *   )
 * }
 * ```
 */

// Main component
export { PixelProgress, SessionPixelProgress, useSessionPixelProgress, TimelinePixelProgress } from './components'
export type { PixelProgressProps, SessionPixelProgressProps, TimelinePixelProgressProps } from './components'

// Hooks
export { usePixelProgress } from './hooks'
export type { UsePixelProgressOptions, UsePixelProgressReturn } from './hooks'

// Types
export type {
  // Core types
  ProgressEvent,
  Construction,
  ConstructionPiece,
  ConstructionPhase,
  ConstructionFingerprint,
  ConstructionStats,

  // Builder types
  BuilderState,
  BuilderType,
  BuilderConfig,

  // Event types
  EventBehavior,
  PieceBehavior,
  AnimationBehavior,
  ModifierBehavior,

  // Configuration
  PixelProgressConfig,
  EventMapping,

  // Export
  ConstructionExport,

  // Theme
  ThemeManifest,
  ThemeCategory,

  // Geometry
  Vec2,
  BoundingBox,

  // Animation
  AnimationSequence,
  MergeStyle,
  PlacementStrategy,
} from './types'

// Constants
export {
  STANDARD_CATEGORIES,
  DEFAULT_CATEGORY_BEHAVIORS,
  SIZE_PRESETS,
  DEFAULT_PALETTE,
} from './constants'
export type { StandardCategory, SizePreset } from './constants'

// Themes
export {
  getTheme,
  getThemeIds,
  getRandomThemeId,
  getAllThemeManifests,
  registerTheme,
  BaseTheme,
} from './themes'

// Core (for advanced usage)
export {
  ConstructionEngine,
  createConstructionEngine,
  PlacementEngine,
  createPlacementEngine,
  Renderer,
  createRenderer,
  SpriteManager,
  createSpriteManager,
  ProceduralSpriteGenerator,
} from './core'

// Default config
export { DEFAULT_CONFIG } from './types'

// Integrations
export {
  sessionEventToProgressEvent,
  sessionEventsToProgressEvents,
  useSessionProgress,
  type SessionEvent as PixelProgressSessionEvent,
  type UseSessionProgressOptions,
  type UseSessionProgressReturn,
} from './integrations'
