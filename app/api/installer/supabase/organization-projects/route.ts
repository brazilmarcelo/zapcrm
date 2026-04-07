import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  getSupabaseOrganization,
  listAllSupabaseOrganizationProjects,
} from '@/lib/installer/edgeFunctions';

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
    organizationSlug: z.string().min(1),
    statuses: z.array(z.string().min(1)).optional(),
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

  const accessToken = parsed.data.accessToken.trim();
  const organizationSlug = parsed.data.organizationSlug.trim();

  const org = await getSupabaseOrganization({ accessToken, organizationSlug });
  if (!org.ok) return json({ error: org.error, status: org.status }, org.status || 500);

  const projects = await listAllSupabaseOrganizationProjects({
    accessToken,
    organizationSlug,
    statuses: parsed.data.statuses,
  });
  if (!projects.ok) return json({ error: projects.error, status: projects.status }, projects.status || 500);

  return json({
    ok: true,
    organization: org.organization,
    count: projects.projects.length,
    projects: projects.projects.map((p) => ({
      ...p,
      supabaseUrl: `https://${p.ref}.supabase.co`,
    })),
  });
}

