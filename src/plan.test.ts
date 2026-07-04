import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parsePlanJson } from '../src/parser';
import { formatPlanComment, DEFAULT_COMMENT_MARKER } from '../src/formatter';

const fixturesDir = path.join(__dirname, '..', 'test', 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('parsePlanJson', () => {
  it('parses create, update, delete, and replace resources', () => {
    const summary = parsePlanJson(loadFixture('sample-plan.json'));

    expect(summary.toCreate).toHaveLength(1);
    expect(summary.toCreate[0].address).toBe('aws_s3_bucket.new_bucket');

    expect(summary.toUpdate).toHaveLength(1);
    expect(summary.toUpdate[0].address).toBe('aws_instance.web');
    expect(summary.toUpdate[0].attributeDiffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'instance_type',
          before: 't2.micro',
          after: 't3.small',
        }),
      ])
    );

    expect(summary.toDestroy).toHaveLength(1);
    expect(summary.toDestroy[0].address).toBe('aws_security_group.old');

    expect(summary.toReplace).toHaveLength(1);
    expect(summary.toReplace[0].address).toBe('aws_lambda_function.api');
    expect(summary.toReplace[0].actionReason).toBe('replace_because_cannot_update');
  });

  it('skips data sources and no-op resources', () => {
    const summary = parsePlanJson(loadFixture('sample-plan.json'));
    const allAddresses = [
      ...summary.toCreate,
      ...summary.toUpdate,
      ...summary.toDestroy,
      ...summary.toReplace,
    ].map((r) => r.address);

    expect(allAddresses).not.toContain('data.aws_caller_identity.current');
    expect(allAddresses).not.toContain('aws_vpc.main');
  });

  it('handles empty plans', () => {
    const summary = parsePlanJson(loadFixture('empty-plan.json'));
    expect(summary.toCreate).toHaveLength(0);
    expect(summary.toUpdate).toHaveLength(0);
    expect(summary.toDestroy).toHaveLength(0);
    expect(summary.toReplace).toHaveLength(0);
  });

  it('includes known-after-apply for unknown create attributes', () => {
    const summary = parsePlanJson(loadFixture('sample-plan.json'));
    const createDiffs = summary.toCreate[0].attributeDiffs;

    expect(createDiffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'id',
          after: '(known after apply)',
        }),
      ])
    );
  });
});

describe('formatPlanComment', () => {
  it('includes summary counts and marker', () => {
    const summary = parsePlanJson(loadFixture('sample-plan.json'));
    const comment = formatPlanComment(summary);

    expect(comment).toContain(DEFAULT_COMMENT_MARKER);
    expect(comment).toContain('🟢 **1** to add');
    expect(comment).toContain('🟡 **1** to change');
    expect(comment).toContain('🔴 **1** to destroy');
    expect(comment).toContain('🔄 **1** to replace');
    expect(comment).toContain('Destructive changes detected');
  });

  it('uses collapsible details sections per resource', () => {
    const summary = parsePlanJson(loadFixture('sample-plan.json'));
    const comment = formatPlanComment(summary);

    expect(comment).toContain('<details>');
    expect(comment).toContain('</details>');
    expect(comment).toContain('aws_s3_bucket.new_bucket');
    expect(comment).toContain('instance_type');
    expect(comment).toContain('t2.micro');
    expect(comment).toContain('t3.small');
  });

  it('shows no-changes message for empty plans', () => {
    const summary = parsePlanJson(loadFixture('empty-plan.json'));
    const comment = formatPlanComment(summary);

    expect(comment).toContain('No changes');
    expect(comment).not.toContain('<details>');
  });

  it('lists destroy and replace resources before creates', () => {
    const summary = parsePlanJson(loadFixture('sample-plan.json'));
    const comment = formatPlanComment(summary);

    const destroyIndex = comment.indexOf('aws_security_group.old');
    const createIndex = comment.indexOf('aws_s3_bucket.new_bucket');
    expect(destroyIndex).toBeLessThan(createIndex);
  });
});
