import { randomUUID } from 'node:crypto';

let cached: string | null = null;

/**
 * Função pública `getRunId` do projeto.
 *
 * @param {string} prefix - Parâmetro `prefix`.
 * @returns {string} Retorna um valor do tipo `string`.
 */
export function getRunId(prefix = 'vitest'): string {
  if (cached) return cached;
  cached = `${prefix}_${randomUUID()}`;
  return cached;
}
