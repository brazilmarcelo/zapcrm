-- =============================================================================
-- TENANT OPERATION PROFILES
-- =============================================================================

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS tenant_profile TEXT NOT NULL DEFAULT 'whitelabel',
  ADD COLUMN IF NOT EXISTS reservation_integration_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservation_supabase_url TEXT,
  ADD COLUMN IF NOT EXISTS reservation_supabase_key TEXT,
  ADD COLUMN IF NOT EXISTS reservation_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS pipeline_snapshot_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_settings_tenant_profile_check'
  ) THEN
    ALTER TABLE public.organization_settings
      ADD CONSTRAINT organization_settings_tenant_profile_check
      CHECK (tenant_profile IN ('whitelabel', 'fullhouse'));
  END IF;
END $$;

UPDATE public.organization_settings
SET
  reservation_integration_enabled = true,
  updated_at = now()
WHERE COALESCE(reservation_integration_enabled, false) = false
  AND (
    NULLIF(btrim(COALESCE(reservation_supabase_url, '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(reservation_url, '')), '') IS NOT NULL
  );

UPDATE public.organization_settings s
SET
  tenant_profile = 'fullhouse',
  updated_at = now()
FROM public.organizations o
WHERE o.id = s.organization_id
  AND s.tenant_profile <> 'fullhouse'
  AND (
    lower(COALESCE(s.brand_name, '')) LIKE '%fullhouse%'
    OR lower(COALESCE(o.name, '')) LIKE '%fullhouse%'
    OR lower(COALESCE(s.reservation_url, '')) LIKE '%fullhouse%'
  );

WITH board_snapshots AS (
  SELECT
    b.organization_id,
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'key', b.key,
        'name', b.name,
        'description', b.description,
        'linkedLifecycleStage', b.linked_lifecycle_stage,
        'nextBoardId', b.next_board_id,
        'wonStageId', b.won_stage_id,
        'lostStageId', b.lost_stage_id,
        'wonStayInStage', COALESCE(b.won_stay_in_stage, false),
        'lostStayInStage', COALESCE(b.lost_stay_in_stage, false),
        'defaultProductId', b.default_product_id,
        'template', b.template,
        'goal', CASE
          WHEN b.goal_description IS NULL
            AND b.goal_kpi IS NULL
            AND b.goal_target_value IS NULL
            AND b.goal_type IS NULL
            THEN NULL
          ELSE jsonb_strip_nulls(jsonb_build_object(
            'description', b.goal_description,
            'kpi', b.goal_kpi,
            'targetValue', b.goal_target_value,
            'type', b.goal_type
          ))
        END,
        'agentPersona', CASE
          WHEN b.agent_name IS NULL
            AND b.agent_role IS NULL
            AND b.agent_behavior IS NULL
            THEN NULL
          ELSE jsonb_strip_nulls(jsonb_build_object(
            'name', b.agent_name,
            'role', b.agent_role,
            'behavior', b.agent_behavior
          ))
        END,
        'entryTrigger', b.entry_trigger,
        'stages', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', bs.id,
              'label', COALESCE(bs.label, bs.name),
              'color', bs.color,
              'linkedLifecycleStage', bs.linked_lifecycle_stage
            )
            ORDER BY bs."order"
          )
          FROM public.board_stages bs
          WHERE bs.board_id = b.id
        ), '[]'::jsonb)
      )
      ORDER BY b.position, b.created_at
    ) AS boards_json
  FROM public.boards b
  GROUP BY b.organization_id
)
UPDATE public.organization_settings s
SET
  pipeline_snapshot = jsonb_build_object(
    'version', 1,
    'source', 'migration',
    'savedAt', now(),
    'boards', COALESCE(bs.boards_json, '[]'::jsonb)
  ),
  pipeline_snapshot_updated_at = now(),
  updated_at = now()
FROM board_snapshots bs
WHERE bs.organization_id = s.organization_id
  AND s.pipeline_snapshot IS NULL;

UPDATE public.organization_settings
SET
  pipeline_snapshot = jsonb_build_object(
    'version', 1,
    'source', 'migration',
    'savedAt', now(),
    'boards', '[]'::jsonb
  ),
  pipeline_snapshot_updated_at = COALESCE(pipeline_snapshot_updated_at, now()),
  updated_at = now()
WHERE pipeline_snapshot IS NULL;
