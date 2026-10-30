# Versions and releases

TORCHLINE uses one application version across the root, two apps and four internal packages. The current source preview is **0.1.0-preview.2**, with the annotated Git tag **v0.1.0-preview.2**. The first **v0.1.0-preview.1** tag remains immutable. These are development previews, not claims that native Twitch acceptance or production operations are complete.

## What the numbers mean

Application versions follow [Semantic Versioning](https://semver.org/): fixes increment the patch, new compatible features increment the minor, and a future stable breaking API change increments the major. While the major is zero, public contracts are still evolving. Release versions use `MAJOR.MINOR.PATCH[-prerelease]` without build metadata; Git records the exact source revision separately.

Increase the preview counter for a new preview of the same planned release, for example `0.1.0-preview.2`. Promote to `0.1.0` only after the defined acceptance gates pass. A `1.0.0` claim also needs an explicitly stable public API and supported production operation.

`ark-v1`/`ark-v2`/`ark-v3` rules, event and presentation schema versions, database migrations and world revisions have separate meanings. Bumping the app version never changes an existing world's rules or migrates a save automatically. Public contracts are described in [data/contracts](../architecture/data-and-contracts.md) and [frontend contracts](../architecture/frontend-contracts.md).

## Prepare the next release

1. Choose the next version. Update the seven `package.json` version fields together; keep every package private and retain `workspace:*` links.
2. Add `docs/releases/vVERSION.md`, update the README version link, and summarize the change in `CHANGELOG.md`. Use absolute links pinned to that tag in release notes so they also work in GitHub's release body. Separate implemented, simulated and genuinely live-verified behavior.
3. Run `pnpm check:version`, format/build/tests, generated proof checks and repository/privacy checks. The existing Verify workflow repeats the checks and validates release tags against the manifest.
4. Review and explicitly stage only the intended files. Verify private inputs are ignored and absent from the index, inspect the staged diff and scan credentials. Commit on the authorized branch and push that branch.
5. Create an annotated `vVERSION` tag on that reviewed commit and push that exact tag. Never move, delete or force-push a published release tag. A later fix gets a new version.
6. Require successful Verify evidence for the exact tagged revision before publishing. Create the GitHub release with `--verify-tag`, the version's notes file and an explicit target SHA. A preview uses `--prerelease --latest=false`. Do not let the CLI create a tag from the default branch implicitly.
7. Check the remote tag/commit, release flags and notes. Record evidence in the subsequent changelog or operations record without rewriting the tagged snapshot.

The first release is sourced from `feat/gameplay-foundation`. On October 30 the owner explicitly authorized main consolidation: preserve the full gameplay → LIVEWIRE → final-design history, merge the independently reviewed QA branch, then fast-forward `main` only to the verified integration source. Keep the superseded UI-LAB prototype separate. Start subsequent engineering on a new branch from that main revision. Do not squash/rewrite published history or delete branches/tags as inferred cleanup. [Consolidation record](../reports/2026-10-30-main-consolidation.md).

Tags are annotated, not cryptographically signed unless signing is explicitly configured. Internal packages stay unpublished. This is a source release, not a deployment or a container-registry publication.

GitHub automatically offers source ZIP/tar archives for a release. Do not attach local recordings, environment files, backups, session exports or OBS links. [GitHub release behavior](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

## Repository topics

Use a small set of accurate technology and product topics: Twitch/chat integration, cooperative persistent play and the actual stack. GitHub limits repositories to 20 topics of up to 50 characters; topic names themselves are public even for private repositories. No private concept vocabulary or unverified claims belong in a topic. [GitHub topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics).
