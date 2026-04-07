import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import type { TenantOperationConfig, TenantPipelineSnapshot } from '@/types';

type AdminContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      organizationId: string;
      userId: string;
    }
  | { ok: false; response: Response };

const TenantPipelineSnapshotSchema = z
  .object({
    version: z.number().int().min(1),
    source: z.enum(['migration', 'settings', 'api', 'template']).default('settings'),
    savedAt: z.string().datetime(),
    boards: z.array(
      z
        .object({
          id: z.string().max(120).optional(),
          key: z.string().max(120).optional(),
          name: z.string().min(1).max(160),
          description: z.string().max(500).optional(),
          linkedLifecycleStage: z.string().optional(),
          nextBoardId: z.string().max(120).optional(),
          wonStageId: z.string().max(120).optional(),
          lostStageId: z.string().max(120).optional(),
          wonStayInStage: z.boolean().optional(),
          lostStayInStage: z.boolean().optional(),
          defaultProductId: z.string().max(120).optional(),
          template: z.enum(['PRE_SALES', 'SALES', 'ONBOARDING', 'CS', 'CUSTOM']).optional(),
          goal: z
            .object({
              description: z.string(),
              kpi: z.string(),
              targetValue: z.string(),
              type: z.enum(['currency', 'number', 'percentage']).optional(),
            })
            .optional(),
          agentPersona: z
            .object({
              name: z.string(),
              role: z.string(),
              behavior: z.string(),
            })
            .optional(),
          entryTrigger: z.string().optional(),
          stages: z.array(
            z.object({
              id: z.string().max(120).optional(),
              label: z.string().min(1).max(160),
              color: z.string().min(1).max(120),
              linkedLifecycleStage: z.string().optional(),
            }),
          ),
        })
        .strict(),
    ),
  })
  .strict();

const TenantOperationSchema = z
  .object({
    tenantProfile: z.enum(['whitelabel', 'fullhouse']).optional(),
    reservationIntegrationEnabled: z.boolean().optional(),
    reservationSupabaseUrl: z.union([z.string().url(), z.literal('')]).optional(),
    reservationSupabaseKey: z.string().max(4096).optional().or(z.literal('')),
    reservationWebhookSecret: z.string().max(512).optional().or(z.literal('')),
    pipelineSnapshot: TenantPipelineSnapshotSchema.nullable().optional(),
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

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx.ok) return ctx.response;

  const config = await resolveTenantOperationConfig(ctx.supabase, ctx.organizationId);
  return json({ config });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const ctx = await getAdminContext();
  if (!ctx.ok) return ctx.response;

  const raw = await req.json().catch(() => null);
  const parsed = TenantOperationSchema.safeParse(raw);

  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const existing = await resolveTenantOperationConfig(ctx.supabase, ctx.organizationId);
  const payload = parsed.data;
  const nowIso = new Date().toISOString();

  const nextPipelineSnapshot =
    payload.pipelineSnapshot === undefined
      ? existing.pipelineSnapshot
      : payload.pipelineSnapshot
        ? {
            ...payload.pipelineSnapshot,
            source: payload.pipelineSnapshot.source || 'settings',
            savedAt: nowIso,
          }
        : null;

  const { error: upsertError } = await ctx.supabase
    .from('organization_settings')
    .upsert(
      {
        organization_id: ctx.organizationId,
        tenant_profile: payload.tenantProfile ?? existing.tenantProfile,
        reservation_integration_enabled:
          payload.reservationIntegrationEnabled ?? existing.reservationIntegrationEnabled,
        reservation_supabase_url:
          payload.reservationSupabaseUrl !== undefined
            ? payload.reservationSupabaseUrl || null
            : existing.reservationSupabaseUrl || null,
        reservation_supabase_key:
          payload.reservationSupabaseKey !== undefined
            ? payload.reservationSupabaseKey || null
            : existing.reservationSupabaseKey || null,
        reservation_webhook_secret:
          payload.reservationWebhookSecret !== undefined
            ? payload.reservationWebhookSecret || null
            : existing.reservationWebhookSecret || null,
        pipeline_snapshot: nextPipelineSnapshot,
        pipeline_snapshot_updated_at:
          payload.pipelineSnapshot !== undefined
            ? nowIso
            : existing.pipelineSnapshotUpdatedAt,
        updated_at: nowIso,
      },
      { onConflict: 'organization_id' },
    );

  if (upsertError) return json({ error: upsertError.message }, 500);

  const { error: auditError } = await ctx.supabase.rpc('log_audit_event', {
    p_action: 'TENANT_OPERATION_UPDATED',
    p_resource_type: 'organization_settings',
    p_resource_id: ctx.organizationId,
    p_details: {
      tenant_profile: payload.tenantProfile ?? existing.tenantProfile,
      reservation_integration_enabled:
        payload.reservationIntegrationEnabled ?? existing.reservationIntegrationEnabled,
      pipeline_snapshot_updated: payload.pipelineSnapshot !== undefined,
    },
    p_severity: 'info',
  });

  if (auditError) {
    console.error('[tenant-profile POST] audit log failed', auditError);
  }

  const config = await resolveTenantOperationConfig(ctx.supabase, ctx.organizationId);
  return json({ ok: true, config });
}
