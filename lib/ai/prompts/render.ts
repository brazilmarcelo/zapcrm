function getByPath(obj: any, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Renderiza templates no formato `{{var}}` (com suporte a path `a.b.c`).
 * - Se a variável não existir, substitui por string vazia.
 * - Não executa lógica; é intencionalmente simples/seguro.
 */
export function renderPromptTemplate(template: string, vars: Record<string, unknown>): string {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const v = getByPath(vars, String(key));
    if (v == null) return '';
    return typeof v === 'string' ? v : String(v);
  });
}

