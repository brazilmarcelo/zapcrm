import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');
const INSTALLER_MIGRATION_REGISTRY = 'public.app_schema_migrations';

type InstallerMigrationDefinition = {
  id: string;
  description: string;
  isApplied: (client: Client) => Promise<boolean>;
};

export type InstallerMigrationProgress = {
  kind: 'start' | 'complete';
  migrationId: string;
  description: string;
  index: number;
  total: number;
};

export type InstallerSchemaStatus = {
  totalCount: number;
  appliedCount: number;
  pendingCount: number;
  appliedIds: string[];
  pendingIds: string[];
  inferredIds: string[];
  complete: boolean;
  migrations: Array<{
    id: string;
    description: string;
    applied: boolean;
    inferred: boolean;
  }>;
};

function needsSsl(connectionString: string) {
  return !/sslmode=disable/i.test(connectionString);
}

function stripSslModeParam(connectionString: string) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return connectionString;
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function isRetryableConnectError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('ENOTFOUND') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('timeout')
  );
}

async function connectClientWithRetry(
  createClient: () => Client,
  opts?: { maxAttempts?: number; initialDelayMs?: number }
): Promise<Client> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const initialDelayMs = opts?.initialDelayMs ?? 3000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = createClient();
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastError = err;
      try {
        await client.end().catch(() => undefined);
      } catch {
        // ignore
      }

      if (!isRetryableConnectError(err) || attempt === maxAttempts) {
        throw err;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      const msg = err instanceof Error ? err.message : String(err);
      console.log(
        `[migrations] Conexao falhou (${msg}), tentativa ${attempt}/${maxAttempts}. Aguardando ${Math.round(
          delayMs / 1000
        )}s...`
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'Falha ao conectar ao banco de dados'));
}

async function waitForStorageReady(client: Client, opts?: { timeoutMs?: number; pollMs?: number }) {
  const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts.timeoutMs : 210_000;
  const pollMs = typeof opts?.pollMs === 'number' ? opts.pollMs : 4_000;
  const t0 = Date.now();

  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await client.query<{ ready: boolean }>(
        `select (to_regclass('storage.buckets') is not null) as ready`
      );
      const ready = Boolean(r?.rows?.[0]?.ready);
      if (ready) return;
    } catch {
      // keep polling on transient errors
    }
    await sleep(pollMs);
  }

  throw new Error(
    'Supabase Storage ainda nao esta pronto (storage.buckets nao existe). Aguarde o projeto terminar de provisionar e tente novamente.'
  );
}

async function queryExists(client: Client, sql: string, values: unknown[] = []) {
  const res = await client.query<{ ready: boolean }>(sql, values);
  return Boolean(res.rows?.[0]?.ready);
}

async function tableExists(client: Client, schema: string, table: string) {
  return queryExists(
    client,
    `select exists (
      select 1
      from information_schema.tables
      where table_schema = $1 and table_name = $2
    ) as ready`,
    [schema, table]
  );
}

async function columnExists(client: Client, schema: string, table: string, column: string) {
  return queryExists(
    client,
    `select exists (
      select 1
      from information_schema.columns
      where table_schema = $1 and table_name = $2 and column_name = $3
    ) as ready`,
    [schema, table, column]
  );
}

async function functionExists(client: Client, schema: string, fnName: string) {
  return queryExists(
    client,
    `select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = $1 and p.proname = $2
    ) as ready`,
    [schema, fnName]
  );
}

async function indexExists(client: Client, schema: string, indexName: string) {
  return queryExists(
    client,
    `select exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = $2 and c.relkind = 'i'
    ) as ready`,
    [schema, indexName]
  );
}

async function ensureMigrationRegistry(client: Client) {
  await client.query(`
    create table if not exists ${INSTALLER_MIGRATION_REGISTRY} (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function listRecordedMigrationIds(client: Client) {
  const res = await client.query<{ id: string }>(
    `select id from ${INSTALLER_MIGRATION_REGISTRY} order by id asc`
  );
  return new Set<string>((res.rows || []).map((row) => row.id));
}

async function recordMigration(client: Client, id: string) {
  await client.query(
    `insert into ${INSTALLER_MIGRATION_REGISTRY} (id) values ($1) on conflict (id) do nothing`,
    [id]
  );
}

const INSTALLER_MIGRATIONS: InstallerMigrationDefinition[] = [
  {
    id: '20251201000000_schema_init.sql',
    description: 'Schema base do CRM',
    isApplied: async (client) => {
      const [organizations, userSettings, apiKeys, webhooks, initializerFn] = await Promise.all([
        tableExists(client, 'public', 'organizations'),
        tableExists(client, 'public', 'user_settings'),
        tableExists(client, 'public', 'api_keys'),
        tableExists(client, 'public', 'integration_inbound_sources'),
        functionExists(client, 'public', 'is_instance_initialized'),
      ]);
      return organizations && userSettings && apiKeys && webhooks && initializerFn;
    },
  },
  {
    id: '20260205000000_add_performance_indexes.sql',
    description: 'Indices de performance',
    isApplied: async (client) => {
      const [dealsBoardIdx, contactsStageIdx, activitiesDateIdx] = await Promise.all([
        indexExists(client, 'public', 'idx_deals_board_id'),
        indexExists(client, 'public', 'idx_contacts_stage'),
        indexExists(client, 'public', 'idx_activities_date'),
      ]);
      return dealsBoardIdx && contactsStageIdx && activitiesDateIdx;
    },
  },
  {
    id: '20260219000000_whatsapp_zapi.sql',
    description: 'Base de WhatsApp',
    isApplied: async (client) => {
      const [instances, conversations, messages, aiConfig, aiLogs, lastMessageFn] =
        await Promise.all([
          tableExists(client, 'public', 'whatsapp_instances'),
          tableExists(client, 'public', 'whatsapp_conversations'),
          tableExists(client, 'public', 'whatsapp_messages'),
          tableExists(client, 'public', 'whatsapp_ai_config'),
          tableExists(client, 'public', 'whatsapp_ai_logs'),
          functionExists(client, 'public', 'update_conversation_last_message'),
        ]);
      return instances && conversations && messages && aiConfig && aiLogs && lastMessageFn;
    },
  },
  {
    id: '20260219100000_whatsapp_intelligence.sql',
    description: 'Inteligencia do WhatsApp',
    isApplied: async (client) => {
      const [memory, followUps, labels, leadScores, summaries, autoCancelFn] =
        await Promise.all([
          tableExists(client, 'public', 'whatsapp_chat_memory'),
          tableExists(client, 'public', 'whatsapp_follow_ups'),
          tableExists(client, 'public', 'whatsapp_labels'),
          tableExists(client, 'public', 'whatsapp_lead_scores'),
          tableExists(client, 'public', 'whatsapp_conversation_summaries'),
          functionExists(client, 'public', 'auto_cancel_follow_ups_on_reply'),
        ]);
      return memory && followUps && labels && leadScores && summaries && autoCancelFn;
    },
  },
  {
    id: '20260304000000_evolution_api_migration.sql',
    description: 'Ajustes para Evolution API',
    isApplied: async (client) => {
      const [orgApiUrl, instanceName, messageId] = await Promise.all([
        columnExists(client, 'public', 'organization_settings', 'evolution_api_url'),
        columnExists(client, 'public', 'whatsapp_instances', 'evolution_instance_name'),
        columnExists(client, 'public', 'whatsapp_messages', 'evolution_message_id'),
      ]);
      return orgApiUrl && instanceName && messageId;
    },
  },
  {
    id: '20260331000000_whitelabel_foundation.sql',
    description: 'Fundacao white-label',
    isApplied: async (client) => {
      const [orgSlug, brandName, profileStatus, impersonationLogs] = await Promise.all([
        columnExists(client, 'public', 'organizations', 'slug'),
        columnExists(client, 'public', 'organization_settings', 'brand_name'),
        columnExists(client, 'public', 'profiles', 'status'),
        tableExists(client, 'public', 'admin_impersonation_logs'),
      ]);
      return orgSlug && brandName && profileStatus && impersonationLogs;
    },
  },
  {
    id: '20260331010000_tenant_operation_profiles.sql',
    description: 'Perfis operacionais do tenant',
    isApplied: async (client) => {
      const [tenantProfile, pipelineSnapshot, reservationEnabled] = await Promise.all([
        columnExists(client, 'public', 'organization_settings', 'tenant_profile'),
        columnExists(client, 'public', 'organization_settings', 'pipeline_snapshot'),
        columnExists(client, 'public', 'organization_settings', 'reservation_integration_enabled'),
      ]);
      return tenantProfile && pipelineSnapshot && reservationEnabled;
    },
  },
];

function readMigrationSql(migrationId: string) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, migrationId), 'utf8');
}

async function inferRecordedMigrations(client: Client, recordedIds: Set<string>) {
  const inferredIds: string[] = [];

  for (const migration of INSTALLER_MIGRATIONS) {
    if (recordedIds.has(migration.id)) continue;
    if (!(await migration.isApplied(client))) continue;

    await recordMigration(client, migration.id);
    recordedIds.add(migration.id);
    inferredIds.push(migration.id);
  }

  return inferredIds;
}

async function buildInstallerSchemaStatus(client: Client): Promise<InstallerSchemaStatus> {
  await ensureMigrationRegistry(client);

  const recordedIds = await listRecordedMigrationIds(client);
  const inferredIds = await inferRecordedMigrations(client, recordedIds);
  const finalRecordedIds = await listRecordedMigrationIds(client);

  const migrations = INSTALLER_MIGRATIONS.map((migration) => ({
    id: migration.id,
    description: migration.description,
    applied: finalRecordedIds.has(migration.id),
    inferred: inferredIds.includes(migration.id),
  }));

  const appliedIds = migrations.filter((item) => item.applied).map((item) => item.id);
  const pendingIds = migrations.filter((item) => !item.applied).map((item) => item.id);

  return {
    totalCount: INSTALLER_MIGRATIONS.length,
    appliedCount: appliedIds.length,
    pendingCount: pendingIds.length,
    appliedIds,
    pendingIds,
    inferredIds,
    complete: pendingIds.length === 0,
    migrations,
  };
}

async function applyMigrationFile(client: Client, migration: InstallerMigrationDefinition) {
  const sql = readMigrationSql(migration.id);

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await recordMigration(client, migration.id);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao aplicar ${migration.id}: ${message}`);
  }
}

function createPgClient(dbUrl: string) {
  const normalizedDbUrl = stripSslModeParam(dbUrl);
  return new Client({
    connectionString: normalizedDbUrl,
    ssl: needsSsl(dbUrl) ? { rejectUnauthorized: false } : undefined,
  });
}

export async function inspectInstallerSchemaStatus(client: Client): Promise<InstallerSchemaStatus> {
  return buildInstallerSchemaStatus(client);
}

export async function getInstallerSchemaStatus(dbUrl: string): Promise<InstallerSchemaStatus> {
  const client = await connectClientWithRetry(() => createPgClient(dbUrl), {
    maxAttempts: 5,
    initialDelayMs: 3000,
  });

  try {
    return await inspectInstallerSchemaStatus(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function runSchemaMigration(
  dbUrl: string,
  opts?: {
    onProgress?: (event: InstallerMigrationProgress) => Promise<void> | void;
  }
) {
  const client = await connectClientWithRetry(() => createPgClient(dbUrl), {
    maxAttempts: 5,
    initialDelayMs: 3000,
  });

  try {
    let status = await inspectInstallerSchemaStatus(client);
    if (status.complete) return status;

    await waitForStorageReady(client);

    const pending = INSTALLER_MIGRATIONS.filter((migration) =>
      status.pendingIds.includes(migration.id)
    );

    for (let index = 0; index < pending.length; index++) {
      const migration = pending[index];
      const progressBase = {
        migrationId: migration.id,
        description: migration.description,
        index: index + 1,
        total: pending.length,
      };

      if (opts?.onProgress) {
        await opts.onProgress({ kind: 'start', ...progressBase });
      }

      await applyMigrationFile(client, migration);

      if (opts?.onProgress) {
        await opts.onProgress({ kind: 'complete', ...progressBase });
      }
    }

    status = await inspectInstallerSchemaStatus(client);
    return status;
  } finally {
    await client.end().catch(() => undefined);
  }
}
