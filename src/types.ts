export type ChangeAction = 'create' | 'update' | 'delete' | 'replace' | 'no-op';

export interface AttributeDiff {
  path: string;
  before: string;
  after: string;
}

export interface ResourceChangeSummary {
  address: string;
  type: string;
  action: ChangeAction;
  actionReason?: string;
  attributeDiffs: AttributeDiff[];
}

export interface PlanSummary {
  toCreate: ResourceChangeSummary[];
  toUpdate: ResourceChangeSummary[];
  toDestroy: ResourceChangeSummary[];
  toReplace: ResourceChangeSummary[];
}

export interface TerraformChange {
  actions: string[];
  before: unknown;
  after: unknown;
  after_unknown?: unknown;
  before_sensitive?: unknown;
  after_sensitive?: unknown;
  replace_paths?: unknown[][];
}

export interface TerraformResourceChange {
  address: string;
  type: string;
  name: string;
  mode: string;
  change: TerraformChange;
  action_reason?: string;
}

export interface TerraformPlan {
  format_version?: string;
  resource_changes?: TerraformResourceChange[];
  output_changes?: Record<string, TerraformChange>;
}
