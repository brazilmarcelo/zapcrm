import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantPipelineSnapshot, TenantPipelineSnapshotBoard, TenantPipelineSnapshotStage } from '@/types';
import { sanitizeUUID } from '@/lib/supabase/utils';
import { slugify } from '@/lib/utils/slugify';

type DbBoard = {
  id: string;
  organization_id: string;
  key: string | null;
  name: string;
};

type DbBoardStage = {
  id: string;
  organization_id: string;
  board_id: string;
  name: string;
  label: string | null;
  color: string | null;
  order: number;
  linked_lifecycle_stage: string | null;
};

export interface ApplyTenantBlueprintResult {
  createdBoards: number;
  updatedBoards: number;
  createdStages: number;
  updatedStages: number;
  appliedBoardIds: string[];
}

function normalizeText(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase();
}

function normalizeBoardKey(value: string | undefined | null) {
  const key = slugify(String(value || ''));
  return key || null;
}

function matchExistingBoard(
  existingBoards: DbBoard[],
  usedBoardIds: Set<string>,
  snapshotBoard: TenantPipelineSnapshotBoard,
) {
  const byId = snapshotBoard.id
    ? existingBoards.find((board) => board.id === snapshotBoard.id && !usedBoardIds.has(board.id))
    : null;
  if (byId) return byId;

  const normalizedKey = normalizeBoardKey(snapshotBoard.key);
  if (normalizedKey) {
    const byKey = existingBoards.find(
      (board) => normalizeBoardKey(board.key) === normalizedKey && !usedBoardIds.has(board.id),
    );
    if (byKey) return byKey;
  }

  return existingBoards.find(
    (board) =>
      normalizeText(board.name) === normalizeText(snapshotBoard.name) && !usedBoardIds.has(board.id),
  );
}

function matchExistingStage(
  existingStages: DbBoardStage[],
  usedStageIds: Set<string>,
  snapshotStage: TenantPipelineSnapshotStage,
) {
  const byId = snapshotStage.id
    ? existingStages.find((stage) => stage.id === snapshotStage.id && !usedStageIds.has(stage.id))
    : null;
  if (byId) return byId;

  return existingStages.find(
    (stage) =>
      normalizeText(stage.label || stage.name) === normalizeText(snapshotStage.label)
      && !usedStageIds.has(stage.id),
  );
}

function buildBoardPayload(
  organizationId: string,
  snapshotBoard: TenantPipelineSnapshotBoard,
  position: number,
) {
  return {
    organization_id: organizationId,
    key: normalizeBoardKey(snapshotBoard.key),
    name: snapshotBoard.name.trim(),
    description: snapshotBoard.description?.trim() || null,
    linked_lifecycle_stage: snapshotBoard.linkedLifecycleStage || null,
    next_board_id: null,
    won_stage_id: null,
    lost_stage_id: null,
    won_stay_in_stage: snapshotBoard.wonStayInStage || false,
    lost_stay_in_stage: snapshotBoard.lostStayInStage || false,
    default_product_id: sanitizeUUID(snapshotBoard.defaultProductId),
    is_default: false,
    template: snapshotBoard.template || 'CUSTOM',
    goal_description: snapshotBoard.goal?.description || null,
    goal_kpi: snapshotBoard.goal?.kpi || null,
    goal_target_value: snapshotBoard.goal?.targetValue || null,
    goal_type: snapshotBoard.goal?.type || null,
    agent_name: snapshotBoard.agentPersona?.name || null,
    agent_role: snapshotBoard.agentPersona?.role || null,
    agent_behavior: snapshotBoard.agentPersona?.behavior || null,
    entry_trigger: snapshotBoard.entryTrigger || null,
    position,
    updated_at: new Date().toISOString(),
  };
}

function buildStagePayload(
  organizationId: string,
  boardId: string,
  snapshotStage: TenantPipelineSnapshotStage,
  order: number,
  actualStageId: string,
) {
  return {
    id: actualStageId,
    organization_id: organizationId,
    board_id: boardId,
    name: snapshotStage.label.trim(),
    label: snapshotStage.label.trim(),
    color: snapshotStage.color || 'bg-gray-500',
    order,
    linked_lifecycle_stage: snapshotStage.linkedLifecycleStage || null,
  };
}

export async function applyTenantPipelineSnapshot(params: {
  supabase: SupabaseClient;
  organizationId: string;
  snapshot: TenantPipelineSnapshot;
}): Promise<ApplyTenantBlueprintResult> {
  const { supabase, organizationId, snapshot } = params;

  const { data: existingBoards, error: boardsError } = await supabase
    .from('boards')
    .select('id, organization_id, key, name')
    .eq('organization_id', organizationId)
    .order('position', { ascending: true });

  if (boardsError) throw boardsError;

  const boardIds = (existingBoards || []).map((board) => board.id);
  const { data: existingStages, error: stagesError } = boardIds.length
    ? await supabase
        .from('board_stages')
        .select('id, organization_id, board_id, name, label, color, order, linked_lifecycle_stage')
        .eq('organization_id', organizationId)
        .in('board_id', boardIds)
    : { data: [], error: null };

  if (stagesError) throw stagesError;

  const usedBoardIds = new Set<string>();
  const boardIdBySnapshotId = new Map<string, string>();
  const stageIdBySnapshotStageId = new Map<string, string>();
  const stageIdByBoardAndLabel = new Map<string, string>();
  const stagesByBoardId = new Map<string, DbBoardStage[]>();

  for (const stage of (existingStages || []) as DbBoardStage[]) {
    const list = stagesByBoardId.get(stage.board_id) || [];
    list.push(stage);
    stagesByBoardId.set(stage.board_id, list);
  }

  let createdBoards = 0;
  let updatedBoards = 0;
  let createdStages = 0;
  let updatedStages = 0;
  const appliedBoardIds: string[] = [];

  for (const [index, snapshotBoard] of snapshot.boards.entries()) {
    const matchedBoard = matchExistingBoard(
      (existingBoards || []) as DbBoard[],
      usedBoardIds,
      snapshotBoard,
    );
    const actualBoardId = matchedBoard?.id || crypto.randomUUID();
    const boardPayload = buildBoardPayload(organizationId, snapshotBoard, index);

    if (matchedBoard) {
      const { error } = await supabase
        .from('boards')
        .update(boardPayload)
        .eq('id', actualBoardId)
        .eq('organization_id', organizationId);
      if (error) throw error;
      updatedBoards += 1;
    } else {
      const { error } = await supabase
        .from('boards')
        .insert({
          id: actualBoardId,
          ...boardPayload,
        });
      if (error) throw error;
      createdBoards += 1;
    }

    usedBoardIds.add(actualBoardId);
    appliedBoardIds.push(actualBoardId);

    if (snapshotBoard.id) {
      boardIdBySnapshotId.set(snapshotBoard.id, actualBoardId);
    }

    const existingStagesForBoard = stagesByBoardId.get(actualBoardId) || [];
    const usedStageIds = new Set<string>();

    for (const [stageIndex, snapshotStage] of snapshotBoard.stages.entries()) {
      const matchedStage = matchExistingStage(existingStagesForBoard, usedStageIds, snapshotStage);
      const actualStageId = matchedStage?.id || crypto.randomUUID();

      const stagePayload = buildStagePayload(
        organizationId,
        actualBoardId,
        snapshotStage,
        stageIndex,
        actualStageId,
      );

      const { error } = await supabase.from('board_stages').upsert(stagePayload);
      if (error) throw error;

      if (matchedStage) updatedStages += 1;
      else createdStages += 1;

      usedStageIds.add(actualStageId);

      if (snapshotStage.id) {
        stageIdBySnapshotStageId.set(snapshotStage.id, actualStageId);
      }

      stageIdByBoardAndLabel.set(
        `${actualBoardId}:${normalizeText(snapshotStage.label)}`,
        actualStageId,
      );
    }
  }

  for (const snapshotBoard of snapshot.boards) {
    const actualBoardId =
      (snapshotBoard.id ? boardIdBySnapshotId.get(snapshotBoard.id) : null)
      || appliedBoardIds.find((boardId) => {
        const existingBoard = (existingBoards || []).find((board) => board.id === boardId);
        return existingBoard && normalizeText(existingBoard.name) === normalizeText(snapshotBoard.name);
      });

    if (!actualBoardId) continue;

    const resolvedWonStageId =
      (snapshotBoard.wonStageId ? stageIdBySnapshotStageId.get(snapshotBoard.wonStageId) : null)
      || (snapshotBoard.stages.find((stage) => stage.id === snapshotBoard.wonStageId)?.label
        ? stageIdByBoardAndLabel.get(
            `${actualBoardId}:${normalizeText(snapshotBoard.stages.find((stage) => stage.id === snapshotBoard.wonStageId)?.label)}`,
          )
        : null)
      || null;

    const resolvedLostStageId =
      (snapshotBoard.lostStageId ? stageIdBySnapshotStageId.get(snapshotBoard.lostStageId) : null)
      || (snapshotBoard.stages.find((stage) => stage.id === snapshotBoard.lostStageId)?.label
        ? stageIdByBoardAndLabel.get(
            `${actualBoardId}:${normalizeText(snapshotBoard.stages.find((stage) => stage.id === snapshotBoard.lostStageId)?.label)}`,
          )
        : null)
      || null;

    const resolvedNextBoardId = snapshotBoard.nextBoardId
      ? boardIdBySnapshotId.get(snapshotBoard.nextBoardId) || null
      : null;

    const { error } = await supabase
      .from('boards')
      .update({
        next_board_id: resolvedNextBoardId,
        won_stage_id: resolvedWonStageId,
        lost_stage_id: resolvedLostStageId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actualBoardId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  return {
    createdBoards,
    updatedBoards,
    createdStages,
    updatedStages,
    appliedBoardIds,
  };
}
