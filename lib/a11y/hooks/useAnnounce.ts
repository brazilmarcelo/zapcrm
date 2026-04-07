import { useCallback, useRef, useEffect } from 'react';

export interface UseAnnounceOptions {
  /** Politeness level */
  mode?: 'polite' | 'assertive';
  /** Delay before clearing the message (ms) */
  clearDelay?: number;
}

function getOrCreateLiveRegion(mode: 'polite' | 'assertive'): HTMLDivElement {
  const id = `live-region-${mode}`;
  let region = document.getElementById(id) as HTMLDivElement | null;

  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.setAttribute('role', mode === 'assertive' ? 'alert' : 'status');
    region.setAttribute('aria-live', mode);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }

  return region;
}

/**
 * useAnnounce - Announce messages to screen readers
 * 
 * Returns a function that announces messages via ARIA live regions.
 * Uses the global live region pattern for consistent announcements.
 * 
 * @example
 * ```tsx
 * function SaveButton() {
 *   const announce = useAnnounce();
 *   
 *   const handleSave = async () => {
 *     await save();
 *     announce('Alterações salvas com sucesso');
 *   };
 *   
 *   return <button onClick={handleSave}>Salvar</button>;
 * }
 * ```
 */
export function useAnnounce(options: UseAnnounceOptions = {}): (message: string) => void {
  const { mode = 'polite', clearDelay = 1000 } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string) => {
    const region = getOrCreateLiveRegion(mode);

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear first to ensure re-announcement of same message
    region.textContent = '';

    // Use requestAnimationFrame to ensure the clear is processed
    requestAnimationFrame(() => {
      region.textContent = message;

      // Clear after delay to avoid re-announcing on re-render
      timeoutRef.current = setTimeout(() => {
        region.textContent = '';
      }, clearDelay);
    });
  }, [mode, clearDelay]);

  return announce;
}

export default useAnnounce;
