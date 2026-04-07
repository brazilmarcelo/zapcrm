import { normalizePhoneE164 } from '@/lib/phone';

export function normalizeEmail(input: string | null | undefined): string | null {
  const v = (input ?? '').trim().toLowerCase();
  return v ? v : null;
}

export function normalizePhone(input: string | null | undefined): string | null {
  const v = normalizePhoneE164(input);
  return v ? v : null;
}

export function normalizeText(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();
  return v ? v : null;
}

export function normalizeUrl(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();
  return v ? v : null;
}

