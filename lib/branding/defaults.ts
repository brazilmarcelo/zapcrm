import type { BrandingConfig } from '@/types/branding';

export const DEFAULT_BRANDING: BrandingConfig = {
  organizationId: null,
  slug: 'crm-whitelabel',
  brandName: 'CRM White Label',
  legalName: 'CRM White Label',
  tagline: 'Seu CRM pronto para vender, conversar e operar com IA.',
  logoUrl: '',
  primaryColor: '#16a34a',
  accentColor: '#0f172a',
  supportEmail: '',
  supportPhone: '',
  reservationUrl: '',
  assistantName: 'Assistente IA',
  assistantRole: 'Assistente comercial',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  defaultLocale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  onboardingCompleted: false,
  initialized: false,
};

export function getBrandInitials(name: string) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return 'WL';
  return words.map((word) => word[0]?.toUpperCase() || '').join('');
}
