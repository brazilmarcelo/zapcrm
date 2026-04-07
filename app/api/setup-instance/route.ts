import { z } from 'zod';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const SetupSchema = z
  .object({
    companyName: z.string().min(1).max(200),
    adminName: z.string().min(1).max(200).optional(),
    email: z.string().email(),
    password: z.string().min(6),
    brandSlug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
    logoUrl: z.string().max(2_000_000).optional(),
  })
  .strict();

/**
 * Handler HTTP `POST` deste endpoint (Next.js Route Handler).
 *
 * @param {Request} req - Objeto da requisição.
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
export async function POST(req: Request) {
  // Setup inicial tem efeito colateral; bloqueia cross-site.
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const raw = await req.json().catch(() => null);
  const parsed = SetupSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const { companyName, adminName, email, password, brandSlug, logoUrl } = parsed.data;

  const admin = createStaticAdminClient();

  // Só permite setup se ainda não inicializado.
  const { data: isInitialized, error: initError } = await admin.rpc('is_instance_initialized');
  if (initError) return json({ error: initError.message }, 500);
  if (isInitialized) return json({ error: 'Instance already initialized' }, 403);

  const { data: organization, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: companyName,
      legal_name: companyName,
      slug: brandSlug || null,
      setup_completed_at: new Date().toISOString(),
    })
    // Performance: only the id/name are used downstream; keep payload minimal.
    .select('id, name')
    .single();

  if (orgError) return json({ error: orgError.message }, 500);

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'admin',
      organization_id: organization.id,
    },
  });

  if (userError) {
    await admin.from('organizations').delete().eq('id', organization.id);
    return json({ error: userError.message }, 400);
  }

  const userId = userData.user.id;
  const displayName = adminName?.trim() || email.split('@')[0];

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      name: displayName,
      first_name: displayName,
      organization_id: organization.id,
      role: 'admin',
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from('organizations').delete().eq('id', organization.id);
    return json({ error: profileError.message }, 400);
  }

  await admin
    .from('organization_settings')
    .upsert(
      {
        organization_id: organization.id,
        brand_name: companyName,
        brand_logo_url: logoUrl?.trim() || null,
        owner_name: displayName,
        owner_email: email,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    );

  return json({ ok: true, organization, user: { id: userId, email } }, 201);
}
