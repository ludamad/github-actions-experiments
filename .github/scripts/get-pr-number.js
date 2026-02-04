// Resolves the PR number from various GitHub Actions event types.
// Returns { prNumber, shouldContinue } or sets shouldContinue=false if no PR found.
module.exports = async ({ github, context, core }) => {
  const eventName = context.eventName;
  let prNumber = null;

  if (eventName === 'pull_request_review') {
    prNumber = context.payload.pull_request.number;
  } else if (eventName === 'workflow_run') {
    const headBranch = context.payload.workflow_run.head_branch;
    const headSha = context.payload.workflow_run.head_sha;
    const { data: pulls } = await github.rest.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      head: `${context.repo.owner}:${headBranch}`,
    });
    const matched = pulls.filter(pr => pr.head.sha === headSha);
    if (matched.length > 0) {
      prNumber = matched[0].number;
    }
  } else if (eventName === 'check_suite') {
    const prs = context.payload.check_suite.pull_requests || [];
    if (prs.length > 0) {
      prNumber = prs[0].number;
    }
  }

  if (!prNumber) {
    core.info(`No open PR found for event: ${eventName}`);
    core.setOutput('should_continue', 'false');
    return;
  }

  core.info(`Resolved PR #${prNumber} from ${eventName} event`);
  core.setOutput('pr_number', prNumber.toString());
  core.setOutput('should_continue', 'true');
};
