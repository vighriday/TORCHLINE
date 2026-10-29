import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const root = read('package.json');
// Release identifiers use SemVer without build metadata; source SHA is recorded separately.
const parts =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
    root.version,
  );
if (
  !parts ||
  parts[4]?.split('.').some((part) => /^\d+$/.test(part) && part.length > 1 && part[0] === '0')
)
  throw new Error('Release version must be MAJOR.MINOR.PATCH with an optional valid prerelease.');

const manifests = ['package.json'];
for (const directory of ['apps', 'packages'])
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name, 'package.json');
    if (entry.isDirectory() && existsSync(path)) manifests.push(path);
  }
for (const path of manifests) {
  const manifest = read(path);
  if (manifest.version !== root.version) throw new Error(`Version differs from root: ${path}`);
  if (manifest.private !== true) throw new Error(`Workspace must remain private: ${path}`);
}
const tag = `v${root.version}`;
const notes = `docs/releases/${tag}.md`;
if (!existsSync(notes) || readFileSync(notes, 'utf8').split(/\r?\n/, 1)[0] !== `# ${tag}`)
  throw new Error(`Add version-specific release notes: ${notes}`);
const readme = readFileSync('README.md', 'utf8');
if (!readme.includes(`href="${notes}">${tag}</a>`))
  throw new Error('README release link must match the current version.');
if (
  process.env.GITHUB_REF?.startsWith('refs/tags/v') &&
  process.env.GITHUB_REF !== `refs/tags/${tag}`
)
  throw new Error('Release tag does not match the workspace version.');
console.log(
  `Version checks passed: ${tag}; ${manifests.length} private manifests; notes and README aligned.`,
);
