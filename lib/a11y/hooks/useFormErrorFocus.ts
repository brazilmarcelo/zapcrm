import { useCallback, useRef } from 'react';

interface UseFormErrorFocusOptions {
  /** Selector for form fields with errors (default: '[aria-invalid="true"]') */
  errorSelector?: string;
  /** Whether to announce the error count to screen readers */
  announce?: boolean;
}

interface UseFormErrorFocusReturn {
  /** Ref to attach to the form element */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** Focus the first invalid field. Call this on form submit when validation fails. */
  focusFirstError: () => boolean;
  /** Get count of current errors */
  getErrorCount: () => number;
}

/**
 * Hook to manage focus on form errors for accessibility.
 * Automatically focuses the first field with an error when validation fails.
 * 
 * @example
 * ```tsx
 * const { formRef, focusFirstError } = useFormErrorFocus();
 * 
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   if (!validateForm()) {
 *     focusFirstError();
 *     return;
 *   }
 *   // ... submit form
 * };
 * 
 * return <form ref={formRef} onSubmit={handleSubmit}>...</form>;
 * ```
 */
export function useFormErrorFocus(
  options: UseFormErrorFocusOptions = {}
): UseFormErrorFocusReturn {
  const { errorSelector = '[aria-invalid="true"]' } = options;
  const formRef = useRef<HTMLFormElement>(null);

  const getErrorCount = useCallback((): number => {
    if (!formRef.current) return 0;
    const errorFields = formRef.current.querySelectorAll(errorSelector);
    return errorFields.length;
  }, [errorSelector]);

  const focusFirstError = useCallback((): boolean => {
    if (!formRef.current) return false;

    // First try to find fields marked as invalid via aria-invalid
    let firstErrorField = formRef.current.querySelector<HTMLElement>(errorSelector);
    
    // Fallback: find fields with :invalid pseudo-class
    if (!firstErrorField) {
      const invalidFields = formRef.current.querySelectorAll<HTMLElement>(
        'input:invalid, select:invalid, textarea:invalid'
      );
      firstErrorField = invalidFields[0] || null;
    }

    // Fallback: find error messages and focus the associated field
    if (!firstErrorField) {
      const errorMessage = formRef.current.querySelector<HTMLElement>('[role="alert"]');
      if (errorMessage) {
        const describedById = errorMessage.id;
        if (describedById) {
          firstErrorField = formRef.current.querySelector<HTMLElement>(
            `[aria-describedby*="${describedById}"]`
          );
        }
      }
    }

    if (firstErrorField && 'focus' in firstErrorField) {
      // Scroll into view if needed
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Small delay to ensure scroll completes
      requestAnimationFrame(() => {
        firstErrorField?.focus();
      });
      
      return true;
    }

    return false;
  }, [errorSelector]);

  return {
    formRef,
    focusFirstError,
    getErrorCount,
  };
}

export default useFormErrorFocus;
