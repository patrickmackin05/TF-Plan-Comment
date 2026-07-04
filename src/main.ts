import * as core from '@actions/core';
import * as fs from 'fs';
import { upsertPlanComment } from './comment';
import { formatPlanComment } from './formatter';
import { parsePlanJson } from './parser';

async function run(): Promise<void> {
  try {
    const planJsonPath = core.getInput('plan-json-path', { required: true });
    const token = core.getInput('github-token', { required: true });
    const marker = core.getInput('comment-marker') || '<!-- tf-plan-comment -->';

    if (!fs.existsSync(planJsonPath)) {
      throw new Error(`Plan JSON file not found: ${planJsonPath}`);
    }

    const planJson = fs.readFileSync(planJsonPath, 'utf8');
    const summary = parsePlanJson(planJson);
    const comment = formatPlanComment(summary, marker);

    core.info(
      `Plan summary: ${summary.toCreate.length} create, ${summary.toUpdate.length} update, ${summary.toDestroy.length} destroy, ${summary.toReplace.length} replace`
    );

    await upsertPlanComment(token, comment, marker);
    core.info('Plan comment posted successfully.');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();
