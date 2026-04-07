import { useEffect, useRef } from 'react';

export interface UseFocusReturnOptions {
  /** Whether to restore focus on unmount */
  enabled?: boolean;
  /** Element to return focus to (defaults to document.activeElement on mount) */
  returnTo?: React.RefObject<HTMLElement>;
}

/**
 * useFocusReturn - Restores focus on unmount
 * 
 * Saves the currently focused element when the component mounts,
 * and restores focus to it when the component unmounts.
 * Perfect for modals and dialogs.
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   useFocusReturn({ enabled: isOpen });
 *   
 *   if (!isOpen) return null;
 *   return <dialog>...</dialog>;
 * }
 * ```
 */
export function useFocusReturn(options: UseFocusReturnOptions = {}): void {
  const { enabled = true, returnTo } = options;
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Save the currently focused element
    previousFocus.current = document.activeElement as HTMLElement;

    return () => {
      // On unmount, restore focus
      const elementToFocus = returnTo?.current || previousFocus.current;
      
      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          try {
            elementToFocus.focus();
          } catch (e) {
            // Element may have been removed from DOM
            console.warn('useFocusReturn: Could not restore focus', e);
          }
        });
      }
    };
  }, [enabled, returnTo]);
}

export default useFocusReturn;
