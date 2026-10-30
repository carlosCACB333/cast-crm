/**
 * Colors for user-defined labels (customer statuses, pipeline stages…). Any
 * hex color can be picked; these presets are offered as quick choices.
 */

export const COLOR_PRESETS = [
  "#71717a", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
] as const;

export const DEFAULT_COLOR = "#71717a";

/** Stored format: lowercase #rrggbb. */
export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

export const COLORS = {
  gray: "#71717a",
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#22c55e",
  blue: "#3b82f6",
} as const;
