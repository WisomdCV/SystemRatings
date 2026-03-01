/**
 * Utility to generate inline styles from a hex color for area badges/tags.
 * Replaces all hardcoded getAreaStyle/getAreaBadgeStyle functions.
 * 
 * Usage:
 *   const style = getAreaColorStyle(area.color);
 *   <span style={style.style} className="...">{area.name}</span>
 */

const DEFAULT_COLOR = "#6366f1"; // meteorite/indigo

/**
 * Generates inline styles for an area badge from a hex color.
 * Creates a light background, colored text, and medium border.
 */
export function getAreaColorStyle(hexColor?: string | null): React.CSSProperties {
    const color = hexColor || DEFAULT_COLOR;
    return {
        backgroundColor: `${color}18`,   // ~10% opacity
        color: color,
        borderColor: `${color}40`,        // ~25% opacity
    };
}

/**
 * Generates chart-ready color from area hex color.
 * Returns the full hex for line/bar charts.
 */
export function getAreaChartColor(hexColor?: string | null): string {
    return hexColor || DEFAULT_COLOR;
}

/**
 * Preset area colors for the color picker.
 */
export const AREA_COLOR_PRESETS = [
    "#3b82f6", // blue-500
    "#ef4444", // red-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#a855f7", // purple-500
    "#ec4899", // pink-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
    "#64748b", // slate-500
    "#8b5cf6", // violet-500
    "#14b8a6", // teal-500
    "#e11d48", // rose-600
];
