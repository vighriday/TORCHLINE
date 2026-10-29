import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';

const frames = resolve('.local/readme-frames');
const extraction = join(frames, `source-${randomUUID()}`);
await mkdir(extraction, { recursive: true });
const browsers = resolve('.local/browsers');
const ffmpegDirectory = (await readdir(browsers)).find((name) => name.startsWith('ffmpeg-'));
if (!ffmpegDirectory) throw new Error('Install the Playwright browser/FFmpeg bundle first.');
const directory = join(browsers, ffmpegDirectory);
const executable = (await readdir(directory)).find((name) => name.startsWith('ffmpeg'));
if (!executable) throw new Error('The Playwright FFmpeg executable is unavailable.');
execFileSync(
  join(directory, executable),
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    resolve('.local/game-review/encounter-demo.webm'),
    '-r',
    '6',
    '-s',
    '800x500',
    '-start_number',
    '0',
    join(extraction, 'frame-%04d.png'),
  ],
  { windowsHide: true, timeout: 60000 },
);
const originals = (await readdir(extraction)).filter((name) => name.endsWith('.png')).sort();
const { ranges } = JSON.parse(await readFile('.local/game-review/capture-timing.json', 'utf8')) as {
  ranges: [number, number][];
};
if (
  ranges.length !== 3 ||
  ranges.some(([start, end]) => !Number.isFinite(start + end) || start < 0 || end <= start)
)
  throw new Error('Recording must include three valid gameplay time ranges.');
for (let i = 0; i < 72; i++) {
  const segment = Math.floor(i / 24),
    phase = (i % 24) / 23;
  const range = ranges[segment];
  const index = Math.min(
    originals.length - 1,
    Math.floor(6 * (range[0] + (range[1] - range[0]) * phase)),
  );
  await copyFile(
    join(extraction, originals[index]),
    join(frames, `game-${String(i).padStart(3, '0')}.png`),
  );
}
process.env.PLAYWRIGHT_BROWSERS_PATH ??= browsers;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 180 },
    deviceScaleFactor: 1,
  });
  await page.setContent(await readFile('assets/readme/world-trace-still.svg', 'utf8'));
  await page.addStyleTag({ content: 'body{margin:0;background:#080e15}' });
  for (let i = 0; i < 48; i++) {
    await page.evaluate(
      (i) => document.getElementById('signal')!.setAttribute('cx', String(220 + (960 * i) / 47)),
      i,
    );
    await page.screenshot({ path: join(frames, `trace-${String(i).padStart(3, '0')}.png`) });
  }
  await copyFile('.local/game-review/encounter-challenge.png', 'assets/readme/gameplay-still.png');
  await writeFile(
    join(frames, 'manifest.json'),
    JSON.stringify(
      {
        source: 'Actual isolated simulation recording',
        sourceFramesAtSixFPS: originals.length,
        gifSeconds: 12.24,
        frames: 72,
        timeline:
          'Three chronological excerpts, compressed for README. Not native Twitch evidence.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({ decodedSourceFrames: originals.length, gameFrames: 72, traceFrames: 48 }),
  );
} finally {
  await browser.close();
}
