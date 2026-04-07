import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Função pública `isAIFeatureEnabled` do projeto.
 *
 * @param {SupabaseClient<any, "public", "public", any, any>} supabase - Parâmetro `supabase`.
 * @param {string} organizationId - Identificador do recurso.
 * @param {string} key - Parâmetro `key`.
 * @returns {Promise<boolean>} Retorna um valor do tipo `Promise<boolean>`.
 */
export async function isAIFeatureEnabled(
  supabase: SupabaseClient,
  organizationId: string,
  key: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('ai_feature_flags')
    .select('enabled')
    .eq('organization_id', organizationId)
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.warn('[ai/features] Failed to load feature flag; defaulting to enabled.', {
      key,
      message: error.message,
    });
    return true;
  }

  // Default: enabled when missing
  return data?.enabled !== false;
}

