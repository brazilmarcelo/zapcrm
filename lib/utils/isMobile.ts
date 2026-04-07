import { getCurrentResponsiveMode } from './responsive';

export function isMobileViewport(): boolean {
  return getCurrentResponsiveMode() === 'mobile';
}
