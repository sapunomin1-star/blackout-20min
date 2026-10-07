// 從 tools/secrets.local.json（gitignored）產生 js/secrets.js。
//   npm run build:secrets                 → 讀 tools/secrets.local.json，寫 js/secrets.js，接著窮舉驗證
//   npm run ids                           → 列出嫌疑人、物品、口供句的 ID（填 JSON 用）
//   node tools/build-secrets.mjs --in a.json --out b.js
// 輸出只說明數量與檢查結果，絕不印出原文或正解。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accuseOptions } from './lib/site.mjs';
import { normalizeInput, buildData, renderSecretsJs, loadVerdict, enumerate, compareWithInput } from './lib/secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const options = accuseOptions(ROOT);

if (args.includes('--ids')) {
  console.log('嫌疑人（culprit、wrongSuspect[].suspect）');
  for (const s of options.suspects) console.log(`  ${s.id.padEnd(10)} ${s.name}（${s.role}）`);
  console.log('\n現場物品（acceptedEvidence）');
  for (const i of options.items) console.log(`  ${i.id.padEnd(10)} ${i.group}・${i.text}`);
  console.log('\n口供句（flaws，可以填多句）');
  for (const s of options.statements) console.log(`  ${s.id.padEnd(10)} ${s.text}`);
  console.log('\n也可以直接填名字或句子原文，工具會自動對到 ID。');
  process.exit(0);
}

const input = path.resolve(ROOT, arg('--in', 'tools/secrets.local.json'));
const output = path.resolve(ROOT, arg('--out', 'js/secrets.js'));

if (!existsSync(input)) {
  console.error(`找不到 ${path.relative(ROOT, input)}。`);
  console.error('請把使用者貼的機密段整理成這個檔（格式見 tools/secrets.example.json），它已被 .gitignore 擋住。');
  process.exit(1);
}

let norm;
try {
  norm = normalizeInput(JSON.parse(readFileSync(input, 'utf8')), options);
} catch (err) {
  console.error('機密檔有問題：' + err.message);
  process.exit(1);
}

const js = renderSecretsJs(await buildData(norm, options));
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, js);

// 立刻用 js/verdict.js 窮舉一次，確認解出來的東西和原文逐字相同
const result = await enumerate(loadVerdict(ROOT, js), options);
const diffs = compareWithInput(result.answer, norm);
console.log(`已產生 ${path.relative(ROOT, output)}：${options.suspects.length} 筆嫌疑人密文、${result.solvedCount} 組全對雜湊、${result.flawCount} 份真相密文。`);
console.log(`窮舉 ${result.total} 種組合。`);
if (result.problems.length || diffs.length) {
  for (const p of result.problems) console.error('✗ ' + p);
  for (const d of diffs) console.error('✗ 解密結果和機密檔不同：' + d);
  process.exit(1);
}
console.log('✓ 判定結構正確，解密結果和機密檔逐字相同。');
