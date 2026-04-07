export type ResponsiveMode = 'mobile' | 'tablet' | 'desktop';

/**
 * Tailwind-ish breakpoints used by the app shell.
 * - mobile: < md
 * - tablet: >= md and < lg
 * - desktop: >= lg
 */
export const APP_BREAKPOINTS = {
  md: 768,
  // Desktop is treated as >= 1280px so iPad landscape (1024px) stays in tablet mode.
  lg: 1280,
} as const;

export function getResponsiveMode(width: number): ResponsiveMode {
  if (width < APP_BREAKPOINTS.md) return 'mobile';
  if (width < APP_BREAKPOINTS.lg) return 'tablet';
  return 'desktop';
}

export function getCurrentResponsiveMode(): ResponsiveMode {
  if (typeof window === 'undefined') return 'desktop';
  return getResponsiveMode(window.innerWidth);
}
