import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import type { ReadmeModel } from '../../apps/web/tools/readme-studio.ts';

const root = process.cwd(),
  output = resolve('.local/readme-studio');
if (!output.startsWith(resolve('.local') + sep)) throw new Error('Unsafe documentation output.');
await mkdir(output, { recursive: true });
const webRequire = createRequire(resolve('apps/web/package.json'));
const { build } = await import(pathToFileURL(webRequire.resolve('vite')).href);
await build({
  configFile: false,
  root,
  logLevel: 'warn',
  resolve: { alias: { three: resolve('apps/web/node_modules/three') } },
  build: {
    outDir: output,
    emptyOutDir: false,
    lib: { entry: resolve('apps/web/tools/readme-studio.ts'), formats: ['es'], fileName: 'studio' },
  },
});
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><script type="module" src="/studio.js"></script>');
      return;
    }
    const path = resolve(output, '.' + (request.url ?? ''));
    if (!path.startsWith(output + sep) || extname(path) !== '.js') {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'text/javascript');
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((done) => server.listen(3105, '127.0.0.1', done));
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.local/browsers');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3105');
  await page.waitForFunction(() => 'captureReadmeModel' in window);
  const result = await page.evaluate(() =>
    (window as Window & { captureReadmeModel?: () => ReadmeModel }).captureReadmeModel!(),
  );
  const png = Buffer.from(result.png.split(',')[1], 'base64'),
    stl = Buffer.from(result.stl, 'base64');
  if (stl.length > 10_000_000 || stl.readUInt32LE(80) !== result.triangles)
    throw new Error('STL exceeds the GitHub viewer limit or its triangle count is invalid.');
  await mkdir('assets/readme', { recursive: true });
  await writeFile('assets/readme/ark-render.png', png);
  await writeFile('assets/readme/ark.stl', stl);
  console.log(
    JSON.stringify({
      source: 'Existing buildArk geometry; static pristine presentation, not gameplay proof',
      triangles: result.triangles,
      stlBytes: stl.length,
      pngBytes: png.length,
    }),
  );
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
}
