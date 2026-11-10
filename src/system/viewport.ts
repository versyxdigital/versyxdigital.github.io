/**
 * Layout breakpoints shared with the schematic overlay.
 *
 * Long traces that run between columns only make sense while those columns
 * sit side by side. On single-column layouts they would cut across text, so
 * connections consult these helpers in their `level` function and stand down.
 */
const width = (): number => (typeof document === 'undefined' ? 1440 : document.documentElement.clientWidth);

/** The viewport is wider than `px` CSS pixels. Use the same number as the matching media query. */
export const widerThan = (px: number): boolean => width() > px;

/** Two-column section layouts are in effect. */
export const isWide = (): boolean => width() > 900;
/** The page has side gutters wide enough to route a trace through. */
export const hasGutter = (): boolean => width() > 720;
