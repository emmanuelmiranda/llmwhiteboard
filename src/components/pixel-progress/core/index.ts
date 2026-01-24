/**
 * Core module exports
 */

export { ConstructionEngine, createConstructionEngine } from './ConstructionEngine'
export type { ConstructionEngineConfig, PositionGenerator, SizeGenerator } from './ConstructionEngine'

export { AnimationEngine } from './AnimationEngine'
export type { FlyingPiece, BuilderAnimation, SnapEffect } from './AnimationEngine'

export { SoundEngine, getSoundEngine, disposeSoundEngine } from './SoundEngine'
export type { SoundEngineConfig, SoundType, SynthConfiguration } from './SoundEngine'

export { PlacementEngine, createPlacementEngine } from './PlacementEngine'
export type { PlacementEngineConfig } from './PlacementEngine'

export { Renderer, createRenderer } from './Renderer'
export type {
  RendererConfig,
  RenderContext,
  PieceRenderer,
  BuilderRenderer,
  ConnectionRenderer,
} from './Renderer'

export {
  SpriteManager,
  createSpriteManager,
  ProceduralSpriteGenerator,
} from './SpriteManager'
export type {
  SpriteSheet,
  SpriteAnimation,
  SpriteDefinition,
  DrawSpriteOptions,
} from './SpriteManager'
