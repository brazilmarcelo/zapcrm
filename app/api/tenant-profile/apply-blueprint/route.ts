import { z } from 'zod';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { applyTenantPipelineSnapshot } from '@/lib/tenant/applyBlueprint';
import { getOfficialTenantBlueprint } from '@/lib/tenant/officialBlueprints';
import type { TenantOperationConfig, TenantPipelineSnapshot } from '@/types';

type AdminContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      organizationId: string;
      userId: string;
    }
  | { ok: false; response: Response };

const ApplyBlueprintSchema = z
  .object({
    source: z.enum(['saved', 'template']),
    templateId: z.enum(['fullhouse']).optional(),
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

async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, response: json({ error: 'Unauthorized' }, 401) };

  const { data: me, error } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single();

  if (error || !me?.organization_id) {
    return { ok: false, response: json({ error: 'Profile not found' }, 404) };
  }

  if (me.role !== 'admin') {
    return { ok: false, response: json({ error: 'Forbidden' }, 403) };
  }

  return {
    ok: true,
    supabase,
    organizationId: me.organization_id,
    userId: user.id,
  };
}

async function resolveTenantOperationConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
): Promise<TenantOperationConfig> {
  const { data: settings } = await supabase
    .from('organization_settings')
    .select(`
      organization_id,
      tenant_profile,
      reservation_integration_enabled,
      reservation_supabase_url,
      reservation_supabase_key,
      reservation_webhook_secret,
      pipeline_snapshot,
      pipeline_snapshot_updated_at
    `)
    .eq('organization_id', organizationId)
    .maybeSingle();

  return {
    organizationId,
    tenantProfile: settings?.tenant_profile === 'fullhouse' ? 'fullhouse' : 'whitelabel',
    reservationIntegrationEnabled: Boolean(settings?.reservation_integration_enabled),
    reservationSupabaseUrl: settings?.reservation_supabase_url || '',
    reservationSupabaseKey: settings?.reservation_supabase_key || '',
    reservationWebhookSecret: settings?.reservation_webhook_secret || '',
    pipelineSnapshot: (settings?.pipeline_snapshot as TenantPipelineSnapshot | null) || null,
    pipelineSnapshotUpdatedAt: settings?.pipeline_snapshot_updated_at || null,
  };
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const ctx = await getAdminContext();
  if (!ctx.ok) return ctx.response;

  const raw = await req.json().catch(() => null);
  const parsed = ApplyBlueprintSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const currentConfig = await resolveTenantOperationConfig(ctx.supabase, ctx.organizationId);

  let snapshot: TenantPipelineSnapshot | null = null;
  if (parsed.data.source === 'saved') {
    snapshot = currentConfig.pipelineSnapshot;
    if (!snapshot) {
      return json({ error: 'Nenhum blueprint salvo para este tenant.' }, 400);
    }
  } else {
    snapshot = getOfficialTenantBlueprint(parsed.data.templateId || 'fullhouse');
  }

  const admin = createStaticAdminClient();
  const result = await applyTenantPipelineSnapshot({
    supabase: admin,
    organizationId: ctx.organizationId,
    snapshot,
  });

  if (parsed.data.source === 'template' && parsed.data.templateId === 'fullhouse') {
    const { error: profileUpdateError } = await admin
      .from('organization_settings')
      .upsert(
        {
          organization_id: ctx.organizationId,
          tenant_profile: 'fullhouse',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );

    if (profileUpdateError) {
      return json({ error: profileUpdateError.message }, 500);
    }
  }

  const { error: auditError } = await ctx.supabase.rpc('log_audit_event', {
    p_action: 'TENANT_BLUEPRINT_APPLIED',
    p_resource_type: 'organization_settings',
    p_resource_id: ctx.organizationId,
    p_details: {
      source: parsed.data.source,
      template_id: parsed.data.templateId || null,
      created_boards: result.createdBoards,
      updated_boards: result.updatedBoards,
      created_stages: result.createdStages,
      updated_stages: result.updatedStages,
    },
    p_severity: 'info',
  });

  if (auditError) {
    console.error('[tenant-profile/apply-blueprint] audit log failed', auditError);
  }

  const config = await resolveTenantOperationConfig(ctx.supabase, ctx.organizationId);
  return json({ ok: true, result, config });
}
