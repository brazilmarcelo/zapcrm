import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField, InputField, SelectField, TextareaField, CheckboxField } from './FormField';
import { axe } from '@/lib/a11y/test/a11y-utils';

describe('FormField Accessibility', () => {
  describe('FormField wrapper', () => {
    it('should associate label with input via htmlFor', () => {
      render(
        <FormField label="Email">
          <input type="email" />
        </FormField>
      );
      
      const label = screen.getByText('Email');
      const input = screen.getByRole('textbox');
      
      expect(label).toHaveAttribute('for');
      expect(input).toHaveAttribute('id', label.getAttribute('for'));
    });

    it('should add aria-required when required prop is true', () => {
      render(
        <FormField label="Email" required>
          <input type="email" />
        </FormField>
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should add aria-invalid when error is present', () => {
      render(
        <FormField label="Email" error={{ type: 'required', message: 'Email is required' }}>
          <input type="email" />
        </FormField>
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should add aria-describedby linking to error message', () => {
      render(
        <FormField label="Email" error={{ type: 'required', message: 'Email is required' }}>
          <input type="email" />
        </FormField>
      );
      
      const input = screen.getByRole('textbox');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      
      const errorElement = document.getElementById(describedBy!);
      expect(errorElement).toHaveTextContent('Email is required');
    });

    it('should render error message with role="alert"', () => {
      render(
        <FormField label="Email" error={{ type: 'required', message: 'Email is required' }}>
          <input type="email" />
        </FormField>
      );
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Email is required');
    });

    it('should add aria-describedby linking to hint when no error', () => {
      render(
        <FormField label="Email" hint="Enter your work email">
          <input type="email" />
        </FormField>
      );
      
      const input = screen.getByRole('textbox');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      
      const hintElement = document.getElementById(describedBy!);
      expect(hintElement).toHaveTextContent('Enter your work email');
    });

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <FormField label="Email" required>
          <input type="email" />
        </FormField>
      );
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });

    it('should pass axe tests with error state', async () => {
      const { container } = render(
        <FormField label="Email" error={{ type: 'required', message: 'Required' }}>
          <input type="email" />
        </FormField>
      );
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });
  });

  describe('InputField', () => {
    it('should have accessible label', () => {
      render(<InputField label="Username" />);
      
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('should support aria-required', () => {
      render(<InputField label="Username" required />);
      
      const input = screen.getByLabelText(/Username/);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should pass axe tests', async () => {
      const { container } = render(<InputField label="Username" />);
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });
  });

  describe('SelectField', () => {
    const options = [
      { value: 'opt1', label: 'Option 1' },
      { value: 'opt2', label: 'Option 2' },
    ];

    it('should have accessible label', () => {
      render(<SelectField label="Country" options={options} />);
      
      const select = screen.getByLabelText('Country');
      expect(select).toBeInTheDocument();
    });

    it('should support aria-required', () => {
      render(<SelectField label="Country" options={options} required />);
      
      const select = screen.getByLabelText(/Country/);
      expect(select).toHaveAttribute('aria-required', 'true');
    });

    it('should pass axe tests', async () => {
      const { container } = render(<SelectField label="Country" options={options} />);
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });
  });

  describe('TextareaField', () => {
    it('should have accessible label', () => {
      render(<TextareaField label="Description" />);
      
      const textarea = screen.getByLabelText('Description');
      expect(textarea).toBeInTheDocument();
    });

    it('should support aria-required', () => {
      render(<TextareaField label="Description" required />);
      
      const textarea = screen.getByLabelText(/Description/);
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('should pass axe tests', async () => {
      const { container } = render(<TextareaField label="Description" />);
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });
  });

  describe('CheckboxField', () => {
    it('should have accessible label', () => {
      render(<CheckboxField label="Accept terms" />);
      
      const checkbox = screen.getByLabelText('Accept terms');
      expect(checkbox).toBeInTheDocument();
    });

    it('should be a checkbox role', () => {
      render(<CheckboxField label="Accept terms" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should pass axe tests', async () => {
      const { container } = render(<CheckboxField label="Accept terms" />);
      
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });
  });
});
