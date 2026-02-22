/**
 * Display hints for custom tool rendering.
 *
 * Clients can include a `display` object in event metadata to customize
 * how their custom tools render in the UI without frontend code changes.
 *
 * Example metadata:
 * {
 *   "input": { ... },
 *   "display": {
 *     "label": "Code Review",
 *     "icon": "eye",
 *     "color": "blue",
 *     "detail": "src/auth/login.ts",
 *     "category": "analyze",
 *     "weight": 1.5
 *   }
 * }
 */

import type { LucideIcon } from "lucide-react";
import {
  Wrench, Search, FileText, Terminal, Globe, MessageSquare,
  ShieldAlert, Zap, GitBranch, Database, Code, Eye,
  CheckCircle, AlertTriangle,
} from "lucide-react";

// --- Icon mapping ---

const ICON_MAP: Record<string, LucideIcon> = {
  wrench: Wrench,
  search: Search,
  file: FileText,
  terminal: Terminal,
  globe: Globe,
  message: MessageSquare,
  shield: ShieldAlert,
  zap: Zap,
  git: GitBranch,
  database: Database,
  code: Code,
  eye: Eye,
  check: CheckCircle,
  alert: AlertTriangle,
};

// --- Color mapping ---

interface ColorClasses {
  iconColor: string;
  circleClass: string;
  badgeClass: string;
}

const COLOR_MAP: Record<string, ColorClasses> = {
  red: {
    iconColor: "text-red-500",
    circleClass: "border-red-500 bg-red-100 dark:bg-red-900/30",
    badgeClass: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300",
  },
  green: {
    iconColor: "text-green-500",
    circleClass: "border-green-500 bg-green-100 dark:bg-green-900/30",
    badgeClass: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300",
  },
  blue: {
    iconColor: "text-blue-500",
    circleClass: "border-blue-500 bg-blue-100 dark:bg-blue-900/30",
    badgeClass: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300",
  },
  purple: {
    iconColor: "text-purple-500",
    circleClass: "border-purple-500 bg-purple-100 dark:bg-purple-900/30",
    badgeClass: "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300",
  },
  amber: {
    iconColor: "text-amber-500",
    circleClass: "border-amber-500 bg-amber-100 dark:bg-amber-900/30",
    badgeClass: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300",
  },
  orange: {
    iconColor: "text-orange-500",
    circleClass: "border-orange-500 bg-orange-100 dark:bg-orange-900/30",
    badgeClass: "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300",
  },
  gray: {
    iconColor: "text-gray-500",
    circleClass: "border-gray-400 bg-gray-100 dark:bg-gray-800",
    badgeClass: "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300",
  },
  cyan: {
    iconColor: "text-cyan-500",
    circleClass: "border-cyan-500 bg-cyan-100 dark:bg-cyan-900/30",
    badgeClass: "border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-300",
  },
  pink: {
    iconColor: "text-pink-500",
    circleClass: "border-pink-500 bg-pink-100 dark:bg-pink-900/30",
    badgeClass: "border-pink-300 text-pink-700 dark:border-pink-700 dark:text-pink-300",
  },
};

// --- Hex colors for pixel art themes ---

const DISPLAY_COLOR_TO_HEX: Record<string, string> = {
  red: '#F44336',
  green: '#4CAF50',
  blue: '#2196F3',
  purple: '#9C27B0',
  amber: '#FFC107',
  orange: '#FF9800',
  gray: '#9E9E9E',
  cyan: '#00BCD4',
  pink: '#E91E63',
};

// --- Pixel categories ---

const VALID_CATEGORIES = new Set([
  "start", "end", "input", "wait", "execute", "process",
  "analyze", "search", "create", "modify", "optimize", "output", "success",
]);

// --- Public API ---

export interface DisplayHints {
  label: string | null;
  icon: string | null;
  color: string | null;
  detail: string | null;
  category: string | null;
  weight: number | null;
}

/** Extract validated display hints from event metadata. */
export function getDisplayHints(metadata: Record<string, unknown> | null | undefined): DisplayHints {
  const empty: DisplayHints = { label: null, icon: null, color: null, detail: null, category: null, weight: null };
  if (!metadata) return empty;

  const display = metadata.display as Record<string, unknown> | undefined;
  if (!display || typeof display !== "object") return empty;

  return {
    label: typeof display.label === "string" ? display.label : null,
    icon: typeof display.icon === "string" && display.icon in ICON_MAP ? display.icon : null,
    color: typeof display.color === "string" && display.color in COLOR_MAP ? display.color : null,
    detail: typeof display.detail === "string" ? display.detail : null,
    category: typeof display.category === "string" && VALID_CATEGORIES.has(display.category) ? display.category : null,
    weight: typeof display.weight === "number" && display.weight >= 0 && display.weight <= 3 ? display.weight : null,
  };
}

/** Resolve an icon key to a Lucide component, with fallback. */
export function resolveIcon(iconKey: string | null, fallback: LucideIcon): LucideIcon {
  if (iconKey && iconKey in ICON_MAP) return ICON_MAP[iconKey];
  return fallback;
}

/** Resolve a color key to Tailwind class sets, with fallback. */
export function resolveColor(colorKey: string | null, fallbackKey: string): ColorClasses {
  if (colorKey && colorKey in COLOR_MAP) return COLOR_MAP[colorKey];
  return COLOR_MAP[fallbackKey] ?? COLOR_MAP.purple;
}

/** Resolve a color key to a hex color for pixel art themes. Returns null if invalid. */
export function resolveHexColor(colorKey: string | null): string | null {
  if (colorKey && colorKey in DISPLAY_COLOR_TO_HEX) return DISPLAY_COLOR_TO_HEX[colorKey];
  return null;
}

export { VALID_CATEGORIES };
