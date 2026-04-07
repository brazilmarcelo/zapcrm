export interface BrandingConfig {
  organizationId: string | null;
  slug: string;
  brandName: string;
  legalName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
  reservationUrl: string;
  assistantName: string;
  assistantRole: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  defaultLocale: string;
  timezone: string;
  onboardingCompleted: boolean;
  initialized: boolean;
}
