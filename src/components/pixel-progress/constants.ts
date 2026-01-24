/**
 * Pixel Progress - Constants
 */

// =============================================================================
// STANDARD CATEGORIES
// =============================================================================

/**
 * Standard event categories that themes should support.
 * Consumers map their domain events to these categories.
 */
export const STANDARD_CATEGORIES = {
  // Lifecycle
  START: 'start',
  END: 'end',
  PAUSE: 'pause',
  RESUME: 'resume',

  // Creative actions (add new things)
  CREATE: 'create',
  GENERATE: 'generate',

  // Modification actions
  MODIFY: 'modify',
  TRANSFORM: 'transform',

  // Discovery actions
  SEARCH: 'search',
  FIND: 'find',
  ANALYZE: 'analyze',

  // Execution actions
  EXECUTE: 'execute',
  PROCESS: 'process',

  // Communication
  INPUT: 'input',
  OUTPUT: 'output',
  WAIT: 'wait',

  // Maintenance
  CLEANUP: 'cleanup',
  OPTIMIZE: 'optimize',

  // Status
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
} as const

export type StandardCategory =
  (typeof STANDARD_CATEGORIES)[keyof typeof STANDARD_CATEGORIES]

// =============================================================================
// DEFAULT CATEGORY BEHAVIORS
// =============================================================================

/**
 * Default behavior for each standard category.
 * Themes can override these.
 */
export const DEFAULT_CATEGORY_BEHAVIORS: Record<
  StandardCategory,
  { behavior: 'piece' | 'animation' | 'modifier'; weight: number }
> = {
  // Lifecycle
  start: { behavior: 'piece', weight: 1 },
  end: { behavior: 'animation', weight: 0 }, // Completion celebration, no piece
  pause: { behavior: 'animation', weight: 0 },
  resume: { behavior: 'animation', weight: 0 },

  // Creative (pieces)
  create: { behavior: 'piece', weight: 2 },
  generate: { behavior: 'piece', weight: 1.5 },

  // Modification (now creates small pieces instead of modifying)
  modify: { behavior: 'piece', weight: 0.5 },
  transform: { behavior: 'piece', weight: 1 },

  // Discovery (now creates pieces - research adds to the build)
  search: { behavior: 'piece', weight: 0.5 },
  find: { behavior: 'piece', weight: 0.5 },
  analyze: { behavior: 'piece', weight: 0.5 },

  // Execution (pieces)
  execute: { behavior: 'piece', weight: 1 },
  process: { behavior: 'piece', weight: 0.5 },

  // Communication
  input: { behavior: 'piece', weight: 1 }, // User input is valuable, creates piece
  output: { behavior: 'piece', weight: 1 },
  wait: { behavior: 'animation', weight: 0 }, // Waiting is just animation

  // Maintenance
  cleanup: { behavior: 'modifier', weight: 0 },
  optimize: { behavior: 'piece', weight: 0.5 },

  // Status (pieces - outcomes matter!)
  success: { behavior: 'piece', weight: 1 },
  error: { behavior: 'piece', weight: 0.5 }, // Errors still add to the story
  warning: { behavior: 'animation', weight: 0 },
}

// =============================================================================
// BUILDER STATE DEFAULTS
// =============================================================================

/**
 * Default builder state for each category
 */
export const DEFAULT_BUILDER_STATES: Record<
  StandardCategory,
  import('./types').BuilderState
> = {
  start: 'working',
  end: 'celebrating',
  pause: 'idle',
  resume: 'working',

  create: 'working',
  generate: 'working',

  modify: 'working',
  transform: 'working',

  search: 'searching',
  find: 'searching',
  analyze: 'thinking',

  execute: 'working',
  process: 'working',

  input: 'receiving',
  output: 'working',
  wait: 'waiting',

  cleanup: 'working',
  optimize: 'thinking',

  success: 'celebrating',
  error: 'frustrated',
  warning: 'thinking',
}

// =============================================================================
// SIZE PRESETS
// =============================================================================

// SIZE_PRESETS match the LEGO theme's 1.6:1 aspect ratio (160:100)
export const SIZE_PRESETS = {
  xs: { width: 128, height: 80 },
  sm: { width: 192, height: 120 },
  md: { width: 256, height: 160 },
  lg: { width: 384, height: 240 },
  xl: { width: 512, height: 320 },
} as const

export type SizePreset = keyof typeof SIZE_PRESETS

// =============================================================================
// ANIMATION TIMING
// =============================================================================

export const ANIMATION_DURATIONS = {
  pieceAdd: 400,
  pieceModify: 300,
  builderMove: 500,
  builderStateChange: 200,
  celebration: 2000,
  idleCycle: 3000,
} as const

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

export const EASING_FUNCTIONS: Record<
  import('./types').EasingType,
  (t: number) => number
> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => t * (2 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  bounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI)
  },
  back: (t) => {
    const s = 1.70158
    return t * t * ((s + 1) * t - s)
  },
}

// =============================================================================
// COLORS
// =============================================================================

/**
 * Default 8-bit inspired palette
 */
export const DEFAULT_PALETTE = [
  '#1a1c2c', // Dark blue-black
  '#5d275d', // Purple
  '#b13e53', // Red
  '#ef7d57', // Orange
  '#ffcd75', // Yellow
  '#a7f070', // Light green
  '#38b764', // Green
  '#257179', // Teal
  '#29366f', // Blue
  '#3b5dc9', // Light blue
  '#41a6f6', // Sky blue
  '#73eff7', // Cyan
  '#f4f4f4', // White
  '#94b0c2', // Light gray
  '#566c86', // Gray
  '#333c57', // Dark gray
]

// =============================================================================
// PIXEL SCALES
// =============================================================================

export const PIXEL_SCALES = {
  fine: 2,
  normal: 4,
  chunky: 6,
  retro: 8,
} as const
