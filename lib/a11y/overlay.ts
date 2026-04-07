/**
 * Small overlay helpers (shared by sheets/menus).
 */

export function isBackdropClick(eventTarget: EventTarget | null, currentTarget: EventTarget | null) {
  return !!eventTarget && !!currentTarget && eventTarget === currentTarget;
}

export function isEscapeKey(event: KeyboardEvent) {
  return event.key === 'Escape' || event.key === 'Esc';
}
