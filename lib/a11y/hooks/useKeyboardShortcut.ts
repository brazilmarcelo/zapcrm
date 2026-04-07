import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  /** Key to listen for (e.g., 'Escape', 'Enter', 'k') */
  key: string;
  /** Require Ctrl/Cmd key */
  ctrl?: boolean;
  /** Require Shift key */
  shift?: boolean;
  /** Require Alt key */
  alt?: boolean;
  /** Require Meta key (Cmd on Mac) */
  meta?: boolean;
}

export interface UseKeyboardShortcutOptions {
  /** Whether the shortcut is active */
  enabled?: boolean;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Stop event propagation */
  stopPropagation?: boolean;
}

/**
 * useKeyboardShortcut - Listen for keyboard shortcuts
 * 
 * Handles keyboard shortcuts with modifier key support.
 * Automatically handles the difference between Ctrl and Cmd on Mac.
 * 
 * @example
 * ```tsx
 * function SearchDialog() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   
 *   // Ctrl+K or Cmd+K to open search
 *   useKeyboardShortcut(
 *     { key: 'k', ctrl: true },
 *     () => setIsOpen(true)
 *   );
 *   
 *   // Escape to close
 *   useKeyboardShortcut(
 *     { key: 'Escape' },
 *     () => setIsOpen(false),
 *     { enabled: isOpen }
 *   );
 * }
 * ```
 */
export function useKeyboardShortcut(
  shortcut: KeyboardShortcut,
  handler: (e: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
): void {
  const { enabled = true, preventDefault = true, stopPropagation = false } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const { key, ctrl, shift, alt, meta } = shortcut;

      // Check the key
      const keyMatches = event.key.toLowerCase() === key.toLowerCase() ||
        event.code.toLowerCase() === key.toLowerCase();
      
      if (!keyMatches) return;

      // Check modifiers
      // For ctrl, we accept either ctrlKey or metaKey (for Mac Cmd)
      const ctrlMatches = ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
      const shiftMatches = shift ? event.shiftKey : !event.shiftKey;
      const altMatches = alt ? event.altKey : !event.altKey;
      const metaMatches = meta ? event.metaKey : true; // Only check if explicitly required

      // Skip if we're in an input/textarea and it's not Escape
      const target = event.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;
      
      if (isInInput && key.toLowerCase() !== 'escape') {
        return;
      }

      if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        handler(event);
      }
    },
    [shortcut, handler, enabled, preventDefault, stopPropagation]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

export default useKeyboardShortcut;
