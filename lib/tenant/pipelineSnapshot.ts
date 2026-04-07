import type { Board, TenantPipelineSnapshot } from '@/types';

export function serializeBoardsToTenantPipelineSnapshot(
  boards: Board[],
  source: TenantPipelineSnapshot['source'] = 'settings',
): TenantPipelineSnapshot {
  return {
    version: 1,
    source,
    savedAt: new Date().toISOString(),
    boards: boards.map((board) => ({
      id: board.id,
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
      stages: board.stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        color: stage.color,
        linkedLifecycleStage: stage.linkedLifecycleStage,
      })),
    })),
  };
}
