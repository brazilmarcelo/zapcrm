import React from 'react';

export interface VisuallyHiddenProps {
  /** Content only visible to screen readers */
  children: React.ReactNode;
  /** Render as different element (default: span) */
  as?: React.ElementType;
}

/**
 * VisuallyHidden - Content visible only to screen readers
 * 
 * Hides content visually while keeping it accessible to assistive
 * technology. Perfect for providing context that sighted users get
 * from visual cues.
 * 
 * @example
 * ```tsx
 * <button>
 *   <TrashIcon />
 *   <VisuallyHidden>Excluir contato</VisuallyHidden>
 * </button>
 * ```
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Component = 'span',
}) => {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
};

export default VisuallyHidden;
