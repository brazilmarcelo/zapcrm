import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPromptCatalogMap } from './catalog';

export type PromptResolution = {
  key: string;
  content: string;
  source: 'override' | 'default';
  version?: number;
  updatedAt?: string;
};

type DbPromptRow = {
  key: string;
  content: string;
  version: number;
  is_active: boolean;
  updated_at: string;
};

/**
 * Função pública `getResolvedPrompt` do projeto.
 *
 * @param {SupabaseClient<any, "public", "public", any, any>} supabase - Parâmetro `supabase`.
 * @param {string} organizationId - Identificador do recurso.
 * @param {string} key - Parâmetro `key`.
 * @returns {Promise<PromptResolution | null>} Retorna um valor do tipo `Promise<PromptResolution | null>`.
 */
export async function getResolvedPrompt(
  supabase: SupabaseClient,
  organizationId: string,
  key: string
): Promise<PromptResolution | null> {
  const catalog = getPromptCatalogMap();
  const fallback = catalog[key];

  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .select('key, content, version, is_active, updated_at')
    .eq('organization_id', organizationId)
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    // Não quebrar IA por falha em prompt override; apenas log e fallback.
    console.warn('[ai/prompts] Failed to load override; using default.', { key, message: error.message });
  }

  const row = (data as DbPromptRow | null) ?? null;
  if (row?.content) {
    return {
      key,
      content: row.content,
      source: 'override',
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  if (!fallback) return null;

  return {
    key,
    content: fallback.defaultTemplate,
    source: 'default',
  };
}

