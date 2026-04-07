import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  triggerProjectRedeploy,
  upsertProjectEnvs,
  waitForVercelDeploymentReady,
} from '@/lib/installer/vercel';

export const maxDuration = 300;
export const runtime = 'nodejs';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const Schema = z
  .object({
    vercel: z.object({
      token: z.string().min(1),
      projectId: z.string().min(1),
      teamId: z.string().optional(),
    }),
    // Optional: allow passing current installerToken if exists (we won't rotate it automatically)
    installerToken: z.string().optional(),
  })
  .strict();

/**
 * "Auto-unlock" endpoint:
 * - Can run even when INSTALLER_ENABLED=false
 * - Requires a valid Vercel token (wizard already has it)
 * - Sets INSTALLER_ENABLED=true and triggers a redeploy
 * - Waits for deployment READY to preserve "magical" flow (no manual steps)
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const raw = await req.json().catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);

  const { token, projectId, teamId } = parsed.data.vercel;

  try {
    await upsertProjectEnvs(
      token,
      projectId,
      [{ key: 'INSTALLER_ENABLED', value: 'true', targets: ['production', 'preview'] }],
      teamId
    );

    const redeploy = await triggerProjectRedeploy(token, projectId, teamId);

    const wait = await waitForVercelDeploymentReady({
      token,
      deploymentId: redeploy.deploymentId,
      teamId,
      timeoutMs: 240_000,
      pollMs: 2_500,
    });
    if (!wait.ok) return json({ error: wait.error, lastReadyState: wait.lastReadyState }, 504);

    return json({ ok: true, deploymentId: redeploy.deploymentId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro ao desbloquear instalador' }, 500);
  }
}
