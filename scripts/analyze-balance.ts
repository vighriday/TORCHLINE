import { mkdir, writeFile } from 'node:fs/promises';
import { analyzeBalance } from './balance-analysis.ts';
const report = analyzeBalance();
await mkdir('docs/reports', { recursive: true });
await writeFile('docs/reports/balance-ark-v2.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
