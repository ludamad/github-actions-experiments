// Performs a squash merge on the given PR.
module.exports = async ({ github, context, core }, prNumber) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  const { data: pr } = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  if (pr.state !== 'open') {
    core.info(`PR #${prNumber} is no longer open (state: ${pr.state}). Skipping merge.`);
    return;
  }

  try {
    await github.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: 'squash',
      commit_title: `${pr.title} (#${prNumber})`,
      commit_message: pr.body || '',
    });
    core.info(`Successfully squash-merged PR #${prNumber} into ${pr.base.ref}.`);
  } catch (error) {
    core.setFailed(`Failed to merge PR #${prNumber}: ${error.message}`);
  }
};
