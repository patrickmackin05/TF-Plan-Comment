import {
  AttributeDiff,
  ChangeAction,
  PlanSummary,
  ResourceChangeSummary,
  TerraformPlan,
  TerraformResourceChange,
} from './types';

function hasAction(actions: string[], action: string): boolean {
  return actions.includes(action);
}

function classifyAction(actions: string[]): ChangeAction {
  if (actions.length === 1 && actions[0] === 'no-op') {
    return 'no-op';
  }
  if (hasAction(actions, 'delete') && hasAction(actions, 'create')) {
    return 'replace';
  }
  if (hasAction(actions, 'create')) {
    return 'create';
  }
  if (hasAction(actions, 'delete')) {
    return 'delete';
  }
  if (hasAction(actions, 'update')) {
    return 'update';
  }
  return 'no-op';
}

function isSensitiveAtPath(
  sensitive: unknown,
  path: string[]
): boolean {
  if (!sensitive || typeof sensitive !== 'object') {
    return false;
  }

  let current: unknown = sensitive;
  for (const segment of path) {
    if (current === true) {
      return true;
    }
    if (!current || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current === true;
}

function isUnknownAtPath(unknown: unknown, path: string[]): boolean {
  if (!unknown || typeof unknown !== 'object') {
    return false;
  }

  let current: unknown = unknown;
  for (const segment of path) {
    if (current === true) {
      return true;
    }
    if (!current || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current === true;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function diffValues(
  before: unknown,
  after: unknown,
  path: string[],
  beforeSensitive: unknown,
  afterSensitive: unknown,
  afterUnknown: unknown,
  diffs: AttributeDiff[]
): void {
  const pathStr = path.join('.') || '(root)';

  if (isSensitiveAtPath(beforeSensitive, path) || isSensitiveAtPath(afterSensitive, path)) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({
        path: pathStr,
        before: '(sensitive)',
        after: '(sensitive)',
      });
    }
    return;
  }

  if (isUnknownAtPath(afterUnknown, path)) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({
        path: pathStr,
        before: formatValue(before),
        after: '(known after apply)',
      });
    }
    return;
  }

  if (before === after) {
    return;
  }

  const beforeIsObject =
    before !== null && typeof before === 'object' && !Array.isArray(before);
  const afterIsObject =
    after !== null && typeof after === 'object' && !Array.isArray(after);

  if (beforeIsObject && afterIsObject) {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

    for (const key of keys) {
      diffValues(
        beforeObj[key],
        afterObj[key],
        [...path, key],
        beforeSensitive,
        afterSensitive,
        afterUnknown,
        diffs
      );
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({
        path: pathStr,
        before: formatValue(before),
        after: formatValue(after),
      });
    }
    return;
  }

  diffs.push({
    path: pathStr,
    before: formatValue(before),
    after: formatValue(after),
  });
}

function collectAfterValues(
  after: unknown,
  path: string[],
  afterSensitive: unknown,
  afterUnknown: unknown,
  diffs: AttributeDiff[]
): void {
  const pathStr = path.join('.') || '(root)';

  if (isSensitiveAtPath(afterSensitive, path)) {
    diffs.push({ path: pathStr, before: '(none)', after: '(sensitive)' });
    return;
  }

  if (isUnknownAtPath(afterUnknown, path)) {
    diffs.push({ path: pathStr, before: '(none)', after: '(known after apply)' });
    return;
  }

  if (after !== null && typeof after === 'object' && !Array.isArray(after)) {
    const afterObj = after as Record<string, unknown>;
    const unknownObj =
      afterUnknown && typeof afterUnknown === 'object' && !Array.isArray(afterUnknown)
        ? (afterUnknown as Record<string, unknown>)
        : {};

    const keys = new Set([...Object.keys(afterObj), ...Object.keys(unknownObj)]);

    for (const key of keys) {
      collectAfterValues(
        afterObj[key],
        [...path, key],
        afterSensitive,
        afterUnknown,
        diffs
      );
    }
    return;
  }

  if (after === undefined) {
    return;
  }

  diffs.push({ path: pathStr, before: '(none)', after: formatValue(after) });
}

function getAttributeDiffs(
  change: TerraformResourceChange['change'],
  action: ChangeAction
): AttributeDiff[] {
  const diffs: AttributeDiff[] = [];

  if (action === 'create' && change.after !== null && change.after !== undefined) {
    collectAfterValues(
      change.after,
      [],
      change.after_sensitive,
      change.after_unknown,
      diffs
    );
    return diffs;
  }

  if (change.before !== null && change.before !== undefined &&
      change.after !== null && change.after !== undefined) {
    diffValues(
      change.before,
      change.after,
      [],
      change.before_sensitive,
      change.after_sensitive,
      change.after_unknown,
      diffs
    );
  }

  return diffs;
}

function summarizeResource(resource: TerraformResourceChange): ResourceChangeSummary | null {
  const action = classifyAction(resource.change.actions);
  if (action === 'no-op') {
    return null;
  }

  return {
    address: resource.address,
    type: resource.type,
    action,
    actionReason: resource.action_reason,
    attributeDiffs: getAttributeDiffs(resource.change, action),
  };
}

export function parsePlan(plan: TerraformPlan): PlanSummary {
  const summary: PlanSummary = {
    toCreate: [],
    toUpdate: [],
    toDestroy: [],
    toReplace: [],
  };

  for (const resource of plan.resource_changes ?? []) {
    if (resource.mode === 'data') {
      continue;
    }

    const item = summarizeResource(resource);
    if (!item) {
      continue;
    }

    switch (item.action) {
      case 'create':
        summary.toCreate.push(item);
        break;
      case 'update':
        summary.toUpdate.push(item);
        break;
      case 'delete':
        summary.toDestroy.push(item);
        break;
      case 'replace':
        summary.toReplace.push(item);
        break;
    }
  }

  const sortByAddress = (a: ResourceChangeSummary, b: ResourceChangeSummary) =>
    a.address.localeCompare(b.address);

  summary.toCreate.sort(sortByAddress);
  summary.toUpdate.sort(sortByAddress);
  summary.toDestroy.sort(sortByAddress);
  summary.toReplace.sort(sortByAddress);

  return summary;
}

export function parsePlanJson(json: string): PlanSummary {
  const plan = JSON.parse(json) as TerraformPlan;
  return parsePlan(plan);
}
