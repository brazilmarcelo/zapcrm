type ExecutableTool = {
  execute: (input: unknown) => unknown | Promise<unknown>;
};

// In tests, we invoke tools directly to validate behavior without UI.
/**
 * Função pública `callTool` do projeto.
 *
 * @param {Record<string, ExecutableTool>} tools - Parâmetro `tools`.
 * @param {string} name - Parâmetro `name`.
 * @param {unknown} input - Parâmetro `input`.
 * @returns {Promise<unknown>} Retorna um valor do tipo `Promise<unknown>`.
 */
export async function callTool(
  tools: Record<string, ExecutableTool>,
  name: string,
  input: unknown,
): Promise<unknown> {
  const tool = tools[name];
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return await tool.execute(input);
}
