import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { listVercelProjects, listVercelTeams } from '@/lib/installer/vercel';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const LookupSchema = z
  .object({
    installerToken: z.string().optional(),
    token: z.string().min(1),
    teamId: z.string().optional(),
  })
  .strict();

/**
 * Handler HTTP `POST` deste endpoint (Next.js Route Handler).
 *
 * @param {Request} req - Objeto da requisição.
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  if (process.env.INSTALLER_ENABLED === 'false') {
    return json({ error: 'Installer disabled' }, 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = LookupSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const expectedToken = process.env.INSTALLER_TOKEN;
  if (expectedToken && parsed.data.installerToken !== expectedToken) {
    return json({ error: 'Invalid installer token' }, 403);
  }

  try {
    const teams = parsed.data.teamId ? [] : await listVercelTeams(parsed.data.token);
    const projects = await listVercelProjects(
      parsed.data.token,
      parsed.data.teamId || undefined
    );

    return json({ teams, projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Vercel data';
    return json({ error: message }, 400);
  }
}
