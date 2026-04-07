import type { AgentPersona, Board, BoardGoal } from './types';

export type TenantProfile = 'whitelabel' | 'fullhouse';
export type TenantBlueprintSource = 'migration' | 'settings' | 'api' | 'template';
export type TenantBlueprintPresetId = 'fullhouse';

export interface TenantPipelineSnapshotStage {
  id?: string;
  label: string;
  color: string;
  linkedLifecycleStage?: string;
}

export interface TenantPipelineSnapshotBoard {
  id?: string;
  key?: string;
  name: string;
  description?: string;
  linkedLifecycleStage?: string;
  nextBoardId?: string;
  wonStageId?: string;
  lostStageId?: string;
  wonStayInStage?: boolean;
  lostStayInStage?: boolean;
  defaultProductId?: string;
  template?: Board['template'];
  goal?: BoardGoal;
  agentPersona?: AgentPersona;
  entryTrigger?: string;
  stages: TenantPipelineSnapshotStage[];
}

export interface TenantPipelineSnapshot {
  version: number;
  source: TenantBlueprintSource;
  savedAt: string;
  boards: TenantPipelineSnapshotBoard[];
}

export interface TenantOperationConfig {
  organizationId: string | null;
  tenantProfile: TenantProfile;
  reservationIntegrationEnabled: boolean;
  reservationSupabaseUrl: string;
  reservationSupabaseKey: string;
  reservationWebhookSecret: string;
  pipelineSnapshot: TenantPipelineSnapshot | null;
  pipelineSnapshotUpdatedAt: string | null;
}
