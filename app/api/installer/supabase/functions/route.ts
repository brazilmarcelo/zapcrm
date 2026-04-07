import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { listEdgeFunctionSlugs, readVerifyJwtBySlug } from '@/lib/installer/edgeFunctions';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  if (process.env.INSTALLER_ENABLED === 'false') {
    return json({ error: 'Installer disabled' }, 403);
  }

  const slugs = await listEdgeFunctionSlugs();
  const verify = await readVerifyJwtBySlug();

  return json({
    ok: true,
    count: slugs.length,
    functions: slugs.map((slug) => ({
      slug,
      verify_jwt: verify.get(slug) ?? true,
    })),
  });
}

