import * as github from '@actions/github';
import { DEFAULT_COMMENT_MARKER } from './formatter';

export async function upsertPlanComment(
  token: string,
  body: string,
  marker: string = DEFAULT_COMMENT_MARKER
): Promise<void> {
  const octokit = github.getOctokit(token);
  const context = github.context;

  const pullNumber = context.payload.pull_request?.number;
  if (!pullNumber) {
    throw new Error(
      'This action must run in the context of a pull_request event (or a workflow that has pull_request context).'
    );
  }

  const { owner, repo } = context.repo;

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (comment) =>
      comment.body?.includes(marker) &&
      comment.user?.type === 'Bot'
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }
}
