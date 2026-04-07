import React, { useCallback } from 'react';

export interface SkipLinkProps {
  /** Target element ID (without #) */
  targetId: string;
  /** Link text */
  children?: React.ReactNode;
}

/**
 * SkipLink - Allows keyboard users to skip navigation
 * 
 * Hidden until focused, appears at top-left of screen.
 * Clicking or pressing Enter focuses the target element.
 * 
 * @example
 * ```tsx
 * <SkipLink targetId="main-content" />
 * <nav>...</nav>
 * <main id="main-content" tabIndex={-1}>
 *   ...
 * </main>
 * ```
 */
export const SkipLink: React.FC<SkipLinkProps> = ({
  targetId,
  children = 'Pular para conteúdo principal',
}) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      // Make the target focusable if it isn't
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
      // Scroll into view smoothly
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [targetId]);

  return (
    <a
      href={`#${targetId}`}
      className="skip-link focus-visible-high"
      onClick={handleClick}
    >
      {children}
    </a>
  );
};

export default SkipLink;
