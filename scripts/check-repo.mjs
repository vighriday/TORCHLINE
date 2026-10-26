import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const git = (...args) =>
  execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], {
    encoding: 'utf8',
  }).trim();
const tracked = git('ls-files').split('\n').filter(Boolean);
const privateFiles = tracked.filter(
  (path) =>
    /(^|\/)idea\.txt$/i.test(path) ||
    /^docs\/internal\//i.test(path) ||
    (/(^|\/)\.env($|\.)/.test(path) && path !== '.env.example') ||
    /^\.(local|tools)\//.test(path),
);
if (privateFiles.length)
  throw new Error('Private inputs or local runtime files found in the Git index.');
git('check-ignore', 'docs/internal/IDEA.txt', 'idea.txt', 'IDEA.TXT');
const skip = new Set([
  '.git',
  'node_modules',
  '.local',
  '.tools',
  'dist',
  'internal',
  '.pnpm-store',
]);
let markdown = 0;
const broken = [];
function walk(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!skip.has(item.name)) walk(join(path, item.name));
      continue;
    }
    if (!item.name.endsWith('.md')) continue;
    markdown++;
    const file = join(path, item.name),
      text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(https?:|mailto:)/.test(target)) continue;
      if (!existsSync(resolve(dirname(file), target))) broken.push(`${file} -> ${target}`);
    }
  }
}
walk('.');
if (broken.length) throw new Error(`Broken documentation links:\n${broken.join('\n')}`);
git('diff', '--check');
git('diff', '--cached', '--check');
console.log(
  `Repository checks passed: ${markdown} Markdown documents; no broken local links; private inputs excluded; whitespace clean.`,
);
