'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Download,
  Loader2,
  RefreshCcw,
  Save,
  Settings2,
  Store,
  Workflow,
  Plus,
} from 'lucide-react';
import { CreateBoardModal } from '@/features/boards/components/Modals/CreateBoardModal';
import { useToast } from '@/context/ToastContext';
import { useBoards, useCreateBoard, useInvalidateBoards, useUpdateBoard } from '@/lib/query/hooks';
import { serializeBoardsToTenantPipelineSnapshot } from '@/lib/tenant/pipelineSnapshot';
import type { Board, TenantOperationConfig, TenantProfile } from '@/types';

const DEFAULT_CONFIG: TenantOperationConfig = {
  organizationId: null,
  tenantProfile: 'whitelabel',
  reservationIntegrationEnabled: false,
  reservationSupabaseUrl: '',
  reservationSupabaseKey: '',
  reservationWebhookSecret: '',
  pipelineSnapshot: null,
  pipelineSnapshotUpdatedAt: null,
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const PROFILE_COPY: Record<
  TenantProfile,
  {
    title: string;
    description: string;
  }
> = {
  whitelabel: {
    title: 'White-label vendável',
    description:
      'Modo padrão para clientes que vão instalar seu CRM com a própria marca, pipeline e integrações.',
  },
  fullhouse: {
    title: 'Operação FullHouse',
    description:
      'Preserva a operação personalizada da FullHouse, incluindo blueprint do CRM e área dedicada para reservas.',
  },
};

function truncateText(value: string | undefined, size = 160) {
  const text = String(value || '').trim();
  if (!text) return 'Não configurado.';
  if (text.length <= size) return text;
  return `${text.slice(0, size).trimEnd()}...`;
}

async function fetchOperationConfig() {
  const response = await fetch('/api/tenant-profile', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Falha ao carregar operação do tenant (HTTP ${response.status})`);
  }

  return (data?.config || DEFAULT_CONFIG) as TenantOperationConfig;
}

export function TenantOperationSettings() {
  const { addToast } = useToast();
  const { data: boards = [], isLoading: boardsLoading } = useBoards();
  const createBoardMutation = useCreateBoard();
  const updateBoardMutation = useUpdateBoard();
  const invalidateBoards = useInvalidateBoards();

  const [config, setConfig] = useState<TenantOperationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingBlueprint, setApplyingBlueprint] = useState<'saved' | 'fullhouse' | null>(null);
  const [isBoardEditorOpen, setIsBoardEditorOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);

  const editingBoard = useMemo(
    () => boards.find((board) => board.id === editingBoardId) || null,
    [boards, editingBoardId],
  );

  useEffect(() => {
    let mounted = true;

    fetchOperationConfig()
      .then((nextConfig) => {
        if (!mounted) return;
        setConfig(nextConfig);
      })
      .catch((error) => {
        if (!mounted) return;
        addToast(
          error instanceof Error ? error.message : 'Falha ao carregar operação do tenant.',
          'error',
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [addToast]);

  const currentBlueprint = useMemo(
    () => serializeBoardsToTenantPipelineSnapshot(boards, 'settings'),
    [boards],
  );

  const updateField = <K extends keyof TenantOperationConfig>(
    key: K,
    value: TenantOperationConfig[K],
  ) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const persistConfig = async (
    payload: Partial<TenantOperationConfig>,
    successMessage: string,
  ) => {
    setSaving(true);

    try {
      const response = await fetch('/api/tenant-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Falha ao salvar operação do tenant (HTTP ${response.status})`);
      }

      setConfig((data?.config || DEFAULT_CONFIG) as TenantOperationConfig);
      addToast(successMessage, 'success');
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : 'Falha ao salvar operação do tenant.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOperation = async () => {
    await persistConfig(
      {
        tenantProfile: config.tenantProfile,
        reservationIntegrationEnabled: config.reservationIntegrationEnabled,
        reservationSupabaseUrl: config.reservationSupabaseUrl,
        reservationSupabaseKey: config.reservationSupabaseKey,
        reservationWebhookSecret: config.reservationWebhookSecret,
        pipelineSnapshot: currentBlueprint,
      },
      'Operação do tenant atualizada com sucesso.',
    );
  };

  const handleSaveBlueprint = async () => {
    await persistConfig(
      {
        pipelineSnapshot: currentBlueprint,
      },
      'Blueprint atual salvo com sucesso.',
    );
  };

  const handleDownloadBlueprint = () => {
    try {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              tenantProfile: config.tenantProfile,
              exportedAt: new Date().toISOString(),
              blueprint: currentBlueprint,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json; charset=utf-8' },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${config.tenantProfile}-pipeline-blueprint.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Não foi possível baixar o blueprint agora.', 'error');
    }
  };

  const handleApplyBlueprint = async (source: 'saved' | 'template') => {
    const applyingKey = source === 'saved' ? 'saved' : 'fullhouse';
    setApplyingBlueprint(applyingKey);

    try {
      const response = await fetch('/api/tenant-profile/apply-blueprint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          source === 'saved'
            ? { source: 'saved' }
            : { source: 'template', templateId: 'fullhouse' },
        ),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Falha ao aplicar blueprint (HTTP ${response.status})`);
      }

      if (data?.config) {
        setConfig(data.config as TenantOperationConfig);
      } else {
        const nextConfig = await fetchOperationConfig();
        setConfig(nextConfig);
      }

      await invalidateBoards();

      addToast(
        source === 'saved'
          ? 'Blueprint salvo aplicado com sucesso.'
          : 'Template oficial FullHouse aplicado com sucesso.',
        'success',
      );
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : 'Falha ao aplicar blueprint.',
        'error',
      );
    } finally {
      setApplyingBlueprint(null);
    }
  };

  const handleOpenCreateBoard = () => {
    setEditingBoardId(null);
    setIsBoardEditorOpen(true);
  };

  const handleOpenEditBoard = (boardId: string) => {
    setEditingBoardId(boardId);
    setIsBoardEditorOpen(true);
  };

  const handleBoardModalClose = () => {
    setEditingBoardId(null);
    setIsBoardEditorOpen(false);
  };

  const handleCreateBoard = async (board: Omit<Board, 'id' | 'createdAt'>) => {
    try {
      await createBoardMutation.mutateAsync({ board });
      sessionStorage.removeItem('createBoardDraft.v1');
      addToast(`Pipeline "${board.name}" criado com sucesso.`, 'success');
      handleBoardModalClose();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao criar pipeline.', 'error');
      setIsBoardEditorOpen(true);
    }
  };

  const handleUpdateBoard = async (board: Omit<Board, 'id' | 'createdAt'>) => {
    if (!editingBoard) return;

    try {
      await updateBoardMutation.mutateAsync({
        id: editingBoard.id,
        updates: {
          key: board.key,
          name: board.name,
          description: board.description,
          linkedLifecycleStage: board.linkedLifecycleStage,
          nextBoardId: board.nextBoardId,
          wonStageId: board.wonStageId,
          lostStageId: board.lostStageId,
          wonStayInStage: board.wonStayInStage,
          lostStayInStage: board.lostStayInStage,
          defaultProductId: board.defaultProductId,
          template: board.template,
          goal: board.goal,
          agentPersona: board.agentPersona,
          entryTrigger: board.entryTrigger,
          stages: board.stages,
        },
      });
      addToast(`Pipeline "${board.name}" atualizado com sucesso.`, 'success');
      handleBoardModalClose();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Falha ao atualizar pipeline.', 'error');
      setIsBoardEditorOpen(true);
    }
  };

  const savedSnapshotBoards = config.pipelineSnapshot?.boards?.length || 0;
  const savedAtLabel = config.pipelineSnapshotUpdatedAt
    ? DATE_TIME_FORMATTER.format(new Date(config.pipelineSnapshotUpdatedAt))
    : 'Ainda não salvo';

  if (loading) {
    return (
      <div className="mb-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando operação do tenant...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary-500" />
              Operação do Tenant
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Aqui você separa o modo FullHouse do produto white-label e salva um blueprint do CRM
              para não perder a operação personalizada.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 bg-slate-50 dark:bg-black/20 min-w-[220px]">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">
              Snapshot salvo
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {savedSnapshotBoards} pipeline(s)
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{savedAtLabel}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50/60 dark:bg-black/20">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-4 h-4 text-primary-500" />
              <h4 className="font-semibold text-slate-900 dark:text-white">Perfil operacional</h4>
            </div>

            <div className="grid gap-3">
              {(Object.keys(PROFILE_COPY) as TenantProfile[]).map((profile) => {
                const active = config.tenantProfile === profile;
                return (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => updateField('tenantProfile', profile)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-primary-500/50 bg-primary-500/10'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {PROFILE_COPY[profile].title}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {PROFILE_COPY[profile].description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50/60 dark:bg-black/20">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary-500" />
              <h4 className="font-semibold text-slate-900 dark:text-white">Reservas e legado</h4>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-white/10 p-4 bg-white dark:bg-white/5">
              <input
                type="checkbox"
                checked={config.reservationIntegrationEnabled}
                onChange={(event) =>
                  updateField('reservationIntegrationEnabled', event.target.checked)
                }
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-slate-900 dark:text-white">
                  Integração com app de reservas
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Mantém o modo FullHouse pronto para sincronizar reservas, webhook e memória da I.A.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              URL do Supabase de reservas
            </span>
            <input
              value={config.reservationSupabaseUrl}
              onChange={(event) => updateField('reservationSupabaseUrl', event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              placeholder="https://xxxx.supabase.co"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Chave service role de reservas
            </span>
            <input
              type="password"
              value={config.reservationSupabaseKey}
              onChange={(event) => updateField('reservationSupabaseKey', event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              placeholder="Cole a chave da integração"
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Segredo do webhook de reservas
            </span>
            <input
              type="password"
              value={config.reservationWebhookSecret}
              onChange={(event) => updateField('reservationWebhookSecret', event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              placeholder="Opcional, para validar a origem do webhook"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSaveOperation}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar operação
          </button>
        </div>
      </div>

      <div className="mb-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Workflow className="w-5 h-5 text-primary-500" />
              Pipeline e Objetivos por Tenant
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Edite o pipeline de cada tenant, salve o blueprint atual e mantenha a versão FullHouse
              separada do white-label.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreateBoard}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Plus className="w-4 h-4" />
              Novo pipeline
            </button>
            <button
              type="button"
              onClick={handleSaveBlueprint}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              Salvar blueprint
            </button>
            <button
              type="button"
              onClick={handleDownloadBlueprint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Download className="w-4 h-4" />
              Baixar JSON
            </button>
            <button
              type="button"
              onClick={() => handleApplyBlueprint('saved')}
              disabled={applyingBlueprint !== null || !config.pipelineSnapshot}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60"
            >
              {applyingBlueprint === 'saved' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4" />
              )}
              Aplicar snapshot salvo
            </button>
            <button
              type="button"
              onClick={() => handleApplyBlueprint('template')}
              disabled={applyingBlueprint !== null}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {applyingBlueprint === 'fullhouse' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4" />
              )}
              Aplicar template FullHouse
            </button>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
          A aplicação de blueprint é não-destrutiva por padrão: ela cria e atualiza os pipelines do
          modelo escolhido, mas não remove boards extras que já existam no tenant.
        </div>

        {boardsLoading ? (
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando pipelines...
          </div>
        ) : boards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum pipeline configurado ainda. Crie o primeiro para montar o blueprint do tenant.
          </div>
        ) : (
          <div className="grid gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50/60 dark:bg-black/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900 dark:text-white">{board.name}</div>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {board.key || 'sem-chave'}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {board.stages.length} etapa(s)
                      </span>
                      {board.template && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-primary-500/10 text-primary-700 dark:text-primary-300">
                          {board.template}
                        </span>
                      )}
                    </div>

                    {board.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        {board.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEditBoard(board.id)}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Editar pipeline
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3 mt-4">
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                      Objetivo
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      {truncateText(
                        board.goal
                          ? `${board.goal.kpi || 'Meta'}: ${board.goal.targetValue || 'sem alvo'}`
                          : '',
                        120,
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                      Agente / I.A.
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      {truncateText(
                        board.agentPersona
                          ? `${board.agentPersona.name} · ${board.agentPersona.role}`
                          : '',
                        120,
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                      Regra de entrada
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      {truncateText(board.entryTrigger, 120)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateBoardModal
        isOpen={isBoardEditorOpen}
        onClose={handleBoardModalClose}
        onSave={editingBoard ? handleUpdateBoard : handleCreateBoard}
        editingBoard={editingBoard || undefined}
        availableBoards={boards}
        onSwitchEditingBoard={(board) => setEditingBoardId(board.id)}
      />
    </>
  );
}
