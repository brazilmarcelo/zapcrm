import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormErrorFocus } from '../hooks/useFormErrorFocus';

describe('useFormErrorFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const createForm = (html: string): HTMLFormElement => {
    const form = document.createElement('form');
    form.innerHTML = html;
    document.body.appendChild(form);
    return form;
  };

  describe('focusFirstError', () => {
    it('should focus the first field with aria-invalid="true"', () => {
      const form = createForm(`
        <input id="name" type="text" />
        <input id="email" type="email" aria-invalid="true" />
        <input id="password" type="password" aria-invalid="true" />
      `);

      const { result } = renderHook(() => useFormErrorFocus());
      
      // Manually set the ref since we can't use React rendering here
      (result.current.formRef as any).current = form;

      const emailInput = form.querySelector('#email') as HTMLInputElement;
      const focusSpy = vi.spyOn(emailInput, 'focus');

      act(() => {
        result.current.focusFirstError();
      });

      // Wait for requestAnimationFrame
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          expect(focusSpy).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should return false when formRef is null', () => {
      const { result } = renderHook(() => useFormErrorFocus());
      
      let focusResult: boolean = false;
      act(() => {
        focusResult = result.current.focusFirstError();
      });

      expect(focusResult).toBe(false);
    });

    it('should return false when no error fields exist', () => {
      const form = createForm(`
        <input id="name" type="text" value="John" />
        <input id="email" type="email" value="john@example.com" />
      `);

      const { result } = renderHook(() => useFormErrorFocus());
      (result.current.formRef as any).current = form;

      let focusResult: boolean = false;
      act(() => {
        focusResult = result.current.focusFirstError();
      });

      expect(focusResult).toBe(false);
    });

    it('should use custom error selector', () => {
      const form = createForm(`
        <input id="name" type="text" class="has-error" />
        <input id="email" type="email" />
      `);

      const { result } = renderHook(() => 
        useFormErrorFocus({ errorSelector: '.has-error' })
      );
      (result.current.formRef as any).current = form;

      const nameInput = form.querySelector('#name') as HTMLInputElement;
      const focusSpy = vi.spyOn(nameInput, 'focus');

      act(() => {
        result.current.focusFirstError();
      });

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          expect(focusSpy).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should scroll error field into view', () => {
      const form = createForm(`
        <input id="name" type="text" aria-invalid="true" />
      `);

      const { result } = renderHook(() => useFormErrorFocus());
      (result.current.formRef as any).current = form;

      const nameInput = form.querySelector('#name') as HTMLInputElement;
      const scrollSpy = vi.spyOn(nameInput, 'scrollIntoView');

      act(() => {
        result.current.focusFirstError();
      });

      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });
  });

  describe('getErrorCount', () => {
    it('should return 0 when formRef is null', () => {
      const { result } = renderHook(() => useFormErrorFocus());
      
      expect(result.current.getErrorCount()).toBe(0);
    });

    it('should return count of fields with aria-invalid', () => {
      const form = createForm(`
        <input id="name" type="text" aria-invalid="true" />
        <input id="email" type="email" aria-invalid="true" />
        <input id="password" type="password" />
      `);

      const { result } = renderHook(() => useFormErrorFocus());
      (result.current.formRef as any).current = form;

      expect(result.current.getErrorCount()).toBe(2);
    });

    it('should use custom error selector for counting', () => {
      const form = createForm(`
        <input class="error" type="text" />
        <input class="error" type="email" />
        <input type="password" />
      `);

      const { result } = renderHook(() => 
        useFormErrorFocus({ errorSelector: '.error' })
      );
      (result.current.formRef as any).current = form;

      expect(result.current.getErrorCount()).toBe(2);
    });
  });

  describe('formRef', () => {
    it('should provide a ref object', () => {
      const { result } = renderHook(() => useFormErrorFocus());
      
      expect(result.current.formRef).toBeDefined();
      expect(result.current.formRef.current).toBeNull();
    });
  });
});
