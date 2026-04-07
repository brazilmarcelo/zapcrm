import { z } from 'zod';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { DEFAULT_BRANDING } from '@/lib/branding/defaults';

const BrandingSchema = z
  .object({
    brandName: z.string().min(1).max(120),
    legalName: z.string().max(160).optional().or(z.literal('')),
    slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
    tagline: z.string().max(180).optional().or(z.literal('')),
    logoUrl: z.string().max(2_000_000).optional().or(z.literal('')),
    primaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/),
    accentColor: z.string().regex(/^#([0-9a-fA-F]{6})$/),
    supportEmail: z.union([z.string().email(), z.literal('')]).optional(),
    supportPhone: z.string().max(40).optional().or(z.literal('')),
    reservationUrl: z.union([z.string().url(), z.literal('')]).optional(),
    assistantName: z.string().max(80).optional().or(z.literal('')),
    assistantRole: z.string().max(120).optional().or(z.literal('')),
    ownerName: z.string().max(120).optional().or(z.literal('')),
    ownerEmail: z.union([z.string().email(), z.literal('')]).optional(),
    ownerPhone: z.string().max(40).optional().or(z.literal('')),
    defaultLocale: z.string().max(20).optional().or(z.literal('')),
    timezone: z.string().max(80).optional().or(z.literal('')),
    onboardingCompleted: z.boolean().optional(),
  })
  .strict();

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

async function resolveBranding() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    return DEFAULT_BRANDING;
  }

  const admin = createStaticAdminClient();

  const { data: organization } = await admin
    .from('organizations')
    .select('id, name, slug, legal_name, deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!organization?.id) {
    return DEFAULT_BRANDING;
  }

  const { data: settings } = await admin
    .from('organization_settings')
    .select(`
      brand_name,
      brand_logo_url,
      brand_tagline,
      brand_primary_color,
      brand_accent_color,
      support_email,
      support_phone,
      reservation_url,
      ai_assistant_name,
      ai_assistant_role,
      owner_name,
      owner_email,
      owner_phone,
      default_locale,
      timezone,
      onboarding_completed
    `)
    .eq('organization_id', organization.id)
    .maybeSingle();

  return {
    ...DEFAULT_BRANDING,
    organizationId: organization.id,
    slug: organization.slug || DEFAULT_BRANDING.slug,
    brandName: settings?.brand_name || organization.name || DEFAULT_BRANDING.brandName,
    legalName: organization.legal_name || organization.name || DEFAULT_BRANDING.legalName,
    tagline: settings?.brand_tagline || DEFAULT_BRANDING.tagline,
    logoUrl: settings?.brand_logo_url || '',
    primaryColor: settings?.brand_primary_color || DEFAULT_BRANDING.primaryColor,
    accentColor: settings?.brand_accent_color || DEFAULT_BRANDING.accentColor,
    supportEmail: settings?.support_email || '',
    supportPhone: settings?.support_phone || '',
    reservationUrl: settings?.reservation_url || '',
    assistantName: settings?.ai_assistant_name || DEFAULT_BRANDING.assistantName,
    assistantRole: settings?.ai_assistant_role || DEFAULT_BRANDING.assistantRole,
    ownerName: settings?.owner_name || '',
    ownerEmail: settings?.owner_email || '',
    ownerPhone: settings?.owner_phone || '',
    defaultLocale: settings?.default_locale || DEFAULT_BRANDING.defaultLocale,
    timezone: settings?.timezone || DEFAULT_BRANDING.timezone,
    onboardingCompleted: Boolean(settings?.onboarding_completed),
    initialized: true,
  };
}

export async function GET() {
  try {
    const branding = await resolveBranding();
    return json({ branding });
  } catch (error) {
    console.error('[branding GET]', error);
    return json({ branding: DEFAULT_BRANDING });
  }
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (meError || !me?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (me.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const raw = await req.json().catch(() => null);
  const parsed = BrandingSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const payload = parsed.data;

  const { error: orgError } = await supabase
    .from('organizations')
    .update({
      name: payload.brandName,
      legal_name: payload.legalName || payload.brandName,
      slug: payload.slug,
      setup_completed_at: payload.onboardingCompleted ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', me.organization_id);

  if (orgError) return json({ error: orgError.message }, 500);

  const { error: settingsError } = await supabase
    .from('organization_settings')
    .upsert(
      {
        organization_id: me.organization_id,
        brand_name: payload.brandName,
        brand_logo_url: payload.logoUrl || null,
        brand_tagline: payload.tagline || null,
        brand_primary_color: payload.primaryColor,
        brand_accent_color: payload.accentColor,
        support_email: payload.supportEmail || null,
        support_phone: payload.supportPhone || null,
        reservation_url: payload.reservationUrl || null,
        ai_assistant_name: payload.assistantName || DEFAULT_BRANDING.assistantName,
        ai_assistant_role: payload.assistantRole || DEFAULT_BRANDING.assistantRole,
        owner_name: payload.ownerName || null,
        owner_email: payload.ownerEmail || null,
        owner_phone: payload.ownerPhone || null,
        default_locale: payload.defaultLocale || DEFAULT_BRANDING.defaultLocale,
        timezone: payload.timezone || DEFAULT_BRANDING.timezone,
        onboarding_completed: payload.onboardingCompleted ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' },
    );

  if (settingsError) return json({ error: settingsError.message }, 500);

  const { error: auditError } = await supabase.rpc('log_audit_event', {
    p_action: 'WHITELABEL_BRANDING_UPDATED',
    p_resource_type: 'organization_settings',
    p_resource_id: me.organization_id,
    p_details: {
      brand_name: payload.brandName,
      slug: payload.slug,
      reservation_url: payload.reservationUrl || null,
    },
    p_severity: 'info',
  });

  if (auditError) {
    console.error('[branding POST] audit log failed', auditError);
  }

  const branding = await resolveBranding();
  return json({ ok: true, branding });
}
