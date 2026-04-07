import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  getSupabaseOrganization,
  listAllSupabaseOrganizationProjects,
  listSupabaseOrganizations,
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

  const orgs = await listSupabaseOrganizations({ accessToken });
  if (!orgs.ok) return json({ error: orgs.error, status: orgs.status }, orgs.status || 500);

  // Enrich orgs with plan + active counts.
  // Paralelizamos getSupabaseOrganization e listAllSupabaseOrganizationProjects
  // pois são chamadas independentes que usam apenas accessToken e slug.
  const enriched = await Promise.all(
    orgs.organizations.map(async (o) => {
      // Executa ambas as chamadas em paralelo (reduz latência em ~50%)
      const [details, projects] = await Promise.all([
        getSupabaseOrganization({ accessToken, organizationSlug: o.slug }),
        listAllSupabaseOrganizationProjects({ accessToken, organizationSlug: o.slug }),
      ]);

      const plan = details.ok && typeof details.organization.plan === 'string' ? details.organization.plan : undefined;
      const items = projects.ok ? projects.projects : [];
      const activeProjects = items.filter((p) => (p.status || '').toUpperCase().startsWith('ACTIVE'));

      return {
        slug: o.slug,
        name: o.name,
        id: o.id,
        plan,
        activeCount: activeProjects.length,
        activeProjects: activeProjects.map((p) => ({
          ref: p.ref,
          name: p.name,
          status: p.status,
          organizationSlug: p.organizationSlug || o.slug,
          supabaseUrl: `https://${p.ref}.supabase.co`,
        })),
      };
    })
  );

  const freeOrgs = enriched.filter((o) => String(o.plan || '').toLowerCase() === 'free');
  const freeGlobalActiveCount = freeOrgs.reduce((sum, o) => sum + (o.activeCount || 0), 0);
  const freeGlobalLimitHit = freeGlobalActiveCount >= 2;

  // Suggest best org for creation: prefer non-free, else a free org with slot.
  const suggested =
    enriched.find((o) => String(o.plan || '').toLowerCase() !== 'free') ||
    enriched.find((o) => String(o.plan || '').toLowerCase() === 'free' && (o.activeCount || 0) < 2) ||
    null;

  return json({
    ok: true,
    organizations: enriched,
    freeGlobalActiveCount,
    freeGlobalLimitHit,
    suggestedOrganizationSlug: suggested?.slug || null,
  });
}

