import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID, sanitizeUUID } from '@/lib/supabase/utils';

export async function resolveBoardId(opts: { organizationId: string; boardKeyOrId: string }) {
  const sb = createStaticAdminClient();
  const value = opts.boardKeyOrId.trim();
  const query = sb
    .from('boards')
    .select('id')
    .eq('organization_id', opts.organizationId)
    .is('deleted_at', null)
    .match(isValidUUID(value) ? { id: value } : { key: value })
    .maybeSingle();

  const { data, error } = await query;
  if (error) throw error;
  const id = sanitizeUUID((data as any)?.id);
  return id || null;
}

export async function resolveBoardIdFromKey(opts: { organizationId: string; boardKey: string }) {
  return resolveBoardId({ organizationId: opts.organizationId, boardKeyOrId: opts.boardKey });
}

export async function resolveFirstStageId(opts: { organizationId: string; boardId: string }) {
  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('board_stages')
    .select('id')
    .eq('organization_id', opts.organizationId)
    .eq('board_id', opts.boardId)
    .order('order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return sanitizeUUID((data as any)?.id) || null;
}

