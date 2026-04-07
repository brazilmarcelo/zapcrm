import React from 'react';

export interface LiveRegionProps {
  /** Content to announce */
  children: React.ReactNode;
  /** Politeness level */
  mode?: 'polite' | 'assertive';
  /** Atomic announcement (read entire region) */
  atomic?: boolean;
  /** Role for the region */
  role?: 'status' | 'alert' | 'log';
}

/**
 * LiveRegion - Announces content changes to screen readers
 * 
 * Use 'polite' for non-critical updates (waits for user to be idle).
 * Use 'assertive' for important/time-sensitive updates (interrupts).
 * 
 * @example
 * ```tsx
 * <LiveRegion mode="polite">
 *   {loadingMessage}
 * </LiveRegion>
 * 
 * <LiveRegion mode="assertive" role="alert">
 *   {errorMessage}
 * </LiveRegion>
 * ```
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  mode = 'polite',
  atomic = true,
  role = 'status',
}) => {
  return (
    <div
      role={role}
      aria-live={mode}
      aria-atomic={atomic}
      className="live-region"
    >
      {children}
    </div>
  );
};

export default LiveRegion;
