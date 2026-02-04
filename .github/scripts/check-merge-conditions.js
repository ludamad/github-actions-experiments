// Checks whether a PR is ready to be squash-merged:
//   1. Has the 'ci-squash-and-merge' label
//   2. Has at least one approval
//   3. The ci3 workflow has passed on the head SHA
module.exports = async ({ github, context, core }, prNumber) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  // Fetch PR details
  const { data: pr } = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // 1. Check for the required label
  const hasLabel = pr.labels.some(l => l.name === 'ci-squash-and-merge');
  if (!hasLabel) {
    core.info(`PR #${prNumber}: missing 'ci-squash-and-merge' label.`);
    core.setOutput('ready', 'false');
    return;
  }

  // 2. Check for at least one approval
  const { data: reviews } = await github.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Collapse reviews per user to the latest state
  const latestByUser = {};
  for (const review of reviews) {
    if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED' || review.state === 'DISMISSED') {
      latestByUser[review.user.id] = review.state;
    }
  }
  const hasApproval = Object.values(latestByUser).some(s => s === 'APPROVED');

  if (!hasApproval) {
    core.info(`PR #${prNumber}: no approval yet.`);
    core.setOutput('ready', 'false');
    return;
  }

  // 3. Check that ci3 workflow passed on the head SHA
  const headSha = pr.head.sha;

  const { data: checkRuns } = await github.rest.checks.listForRef({
    owner,
    repo,
    ref: headSha,
  });

  const ci3Run = checkRuns.check_runs.find(
    cr => cr.name === 'ci' && cr.app?.slug === 'github-actions'
  );

  // Also try matching by workflow name in case the job name differs
  let ci3Passed = false;
  if (ci3Run && ci3Run.conclusion === 'success') {
    ci3Passed = true;
  } else {
    // Fallback: check workflow runs for the SHA
    const { data: workflowRuns } = await github.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      head_sha: headSha,
      status: 'success',
    });
    ci3Passed = workflowRuns.workflow_runs.some(
      wr => wr.name === 'ci3' && wr.conclusion === 'success'
    );
  }

  if (!ci3Passed) {
    core.info(`PR #${prNumber}: ci3 has not passed on ${headSha}.`);
    core.setOutput('ready', 'false');
    return;
  }

  core.info(`PR #${prNumber}: all conditions met (label + approval + ci3). Ready to merge.`);
  core.setOutput('ready', 'true');
};
