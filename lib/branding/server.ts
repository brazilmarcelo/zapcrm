import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_BRANDING } from '@/lib/branding/defaults';

export interface OrganizationBrandRuntime {
  brandName: string;
  slug: string;
  reservationUrl: string;
  assistantName: string;
  assistantRole: string;
  supportEmail: string;
  supportPhone: string;
}

export async function getOrganizationBrandRuntime(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationBrandRuntime> {
  const fallback: OrganizationBrandRuntime = {
    brandName: DEFAULT_BRANDING.brandName,
    slug: DEFAULT_BRANDING.slug,
    reservationUrl: DEFAULT_BRANDING.reservationUrl,
    assistantName: DEFAULT_BRANDING.assistantName,
    assistantRole: DEFAULT_BRANDING.assistantRole,
    supportEmail: DEFAULT_BRANDING.supportEmail,
    supportPhone: DEFAULT_BRANDING.supportPhone,
  };

  if (!organizationId) return fallback;

  const [{ data: organization }, { data: settings }] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, slug')
      .eq('id', organizationId)
      .maybeSingle(),
    supabase
      .from('organization_settings')
      .select('brand_name, reservation_url, ai_assistant_name, ai_assistant_role, support_email, support_phone')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  return {
    brandName: settings?.brand_name || organization?.name || fallback.brandName,
    slug: organization?.slug || fallback.slug,
    reservationUrl: settings?.reservation_url || fallback.reservationUrl,
    assistantName: settings?.ai_assistant_name || fallback.assistantName,
    assistantRole: settings?.ai_assistant_role || fallback.assistantRole,
    supportEmail: settings?.support_email || fallback.supportEmail,
    supportPhone: settings?.support_phone || fallback.supportPhone,
  };
}
