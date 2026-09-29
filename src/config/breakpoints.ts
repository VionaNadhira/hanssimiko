/**
 * Responsive breakpoints — single source of truth.
 *
 * These are mirrored in `globals.css` under `@theme { --breakpoint-* }` so that
 * Tailwind's `sm:`/`md:`/`lg:`/`xl:` variants use exactly these values. Both
 * places must agree; the TypeScript constants exist so behaviour that cannot be
 * expressed in CSS (drawer vs rail, bottom nav visibility) reads the same
 * numbers instead of re-typing a magic pixel value.
 */

/** 480px — 2-column grids, 3-column term tabs. */
export const BP_SM = 480;

/** 768px — tables replace card stacks, sidebar becomes a rail, dialogs centre. */
export const BP_MD = 768;

/** 1024px — sidebar expanded, 4-column stat grid, two-column panels. */
export const BP_LG = 1024;

/** 1280px — maximum comfortable density. */
export const BP_XL = 1280;

/** The container never grows past this, however wide the display is. */
export const PAGE_MAX_WIDTH = 1100;

/** Horizontal page gutter on every breakpoint. */
export const PAGE_GUTTER = 24;

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

const MIN_WIDTH: Record<Breakpoint, number> = {
  sm: BP_SM,
  md: BP_MD,
  lg: BP_LG,
  xl: BP_XL,
};

const MEDIA_QUERY: Record<Breakpoint, string> = {
  sm: `(min-width: ${BP_SM}px)`,
  md: `(min-width: ${BP_MD}px)`,
  lg: `(min-width: ${BP_LG}px)`,
  xl: `(min-width: ${BP_XL}px)`,
};

/** min-width media query for a named breakpoint. */
export function mediaUp(breakpoint: Breakpoint): string {
  return MEDIA_QUERY[breakpoint];
}

/** True when the viewport is at or above the named breakpoint. */
export function isAtLeast(breakpoint: Breakpoint, width: number): boolean {
  return width >= MIN_WIDTH[breakpoint];
}

/** Viewports checked by the responsive regression script. */
export const TEST_WIDTHS = [320, 360, 390, 430, 768, 820, 1024, 1280, 1440, 1920, 2560] as const;
