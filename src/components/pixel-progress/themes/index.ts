/**
 * Theme Registry and Exports
 */

import { getTheme as baseGetTheme, getThemeIds as baseGetThemeIds } from './base-theme'

export { BaseTheme, registerTheme, getTheme, getThemeIds, getAllThemeManifests } from './base-theme'

// Import themes to register them
import './painter/PainterTheme'
import './lego/LegoTheme'
import './garden/GardenTheme'

// Re-export theme classes for direct use
export { PainterTheme } from './painter/PainterTheme'
export { LegoTheme } from './lego/LegoTheme'
export { GardenTheme } from './garden/GardenTheme'

// Convenience function to get a random theme
export function getRandomThemeId(): string {
  const ids = baseGetThemeIds()
  return ids[Math.floor(Math.random() * ids.length)]
}

// Get theme manifest by ID
export function getThemeManifest(id: string) {
  const theme = baseGetTheme(id)
  return theme?.manifest
}
