-- =============================================================================
-- WHITE-LABEL FOUNDATION
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

UPDATE public.organizations
SET slug = regexp_replace(
  regexp_replace(lower(unaccent(coalesce(name, 'crm'))), '[^a-z0-9]+', '-', 'g'),
  '(^-+|-+$)',
  '',
  'g'
)
WHERE slug IS NULL OR btrim(slug) = '';

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique
  ON public.organizations (slug)
  WHERE deleted_at IS NULL AND slug IS NOT NULL;

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_tagline TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_phone TEXT,
  ADD COLUMN IF NOT EXISTS reservation_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_assistant_name TEXT DEFAULT 'CRM Pilot',
  ADD COLUMN IF NOT EXISTS ai_assistant_role TEXT DEFAULT 'Assistente comercial',
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS default_locale TEXT DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

UPDATE public.organization_settings s
SET
  brand_name = COALESCE(NULLIF(s.brand_name, ''), o.name),
  owner_email = COALESCE(NULLIF(s.owner_email, ''), NULL),
  updated_at = now()
FROM public.organizations o
WHERE o.id = s.organization_id
  AND (s.brand_name IS NULL OR btrim(s.brand_name) = '');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

UPDATE public.profiles
SET status = 'active'
WHERE status IS NULL OR btrim(status) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check
      CHECK (status IN ('active', 'paused', 'invited'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_impersonation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage impersonation logs" ON public.admin_impersonation_logs;
CREATE POLICY "Admins can manage impersonation logs"
  ON public.admin_impersonation_logs
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id
      FROM public.profiles
      WHERE organization_id = admin_impersonation_logs.organization_id
        AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id
      FROM public.profiles
      WHERE organization_id = admin_impersonation_logs.organization_id
        AND role = 'admin'
    )
  );
