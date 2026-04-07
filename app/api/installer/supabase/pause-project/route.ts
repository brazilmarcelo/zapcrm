import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { pauseSupabaseProject } from '@/lib/installer/edgeFunctions';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const Schema = z
  .object({
    installerToken: z.string().optional(),
    accessToken: z.string().min(1),
    projectRef: z.string().min(1),
  })
  .strict();

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  if (process.env.INSTALLER_ENABLED === 'false') {
    return json({ error: 'Installer disabled' }, 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const expectedToken = process.env.INSTALLER_TOKEN;
  if (expectedToken && parsed.data.installerToken !== expectedToken) {
    return json({ error: 'Invalid installer token' }, 403);
  }

  const res = await pauseSupabaseProject({
    accessToken: parsed.data.accessToken.trim(),
    projectRef: parsed.data.projectRef.trim(),
  });
  if (!res.ok) return json({ error: res.error, status: res.status }, res.status || 500);

  return json({ ok: true });
}

