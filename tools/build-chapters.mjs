// 從 tools/chapters.local/*.json（gitignored）產生新章節：
//   chN/{index,scene,interrogation,accuse}.html   頁面外殼（不含案件內容）
//   chN/{brief,scene,interrogation,accuse}.data.js 用通行碼推導的金鑰加密的內容
//   chapters.js                                    章節選單用的標題、一句話簡介與解鎖驗證密文
// 產生後立刻用通行碼解開、窮舉所有鎖／出示證物／指控組合，確認和原始內容一致。
// 輸出只有數量與檢查結果，絕不印出內容或答案。
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOURCE_DIR,
  ROLES,
  PROLOGUE_ENTRY,
  SERIES,
  loadSources,
  validate,
  buildChapter,
  renderDataJs,
  renderManifest,
  verifyAgainstSources
} from './lib/chapters.mjs';

// --root 可以指定別的資料夾（測試用）；預設是 repo 根目錄
const rootArg = process.argv.indexOf('--root');
const ROOT = rootArg !== -1 ? path.resolve(process.argv[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%8D%3C/text%3E%3C/svg%3E";
const FONTS = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&amp;display=swap';

const PAGE = {
  brief: { file: 'index.html', role: null, back: ['../index.html', '章節選單'], title: '案件簡報' },
  scene: { file: 'scene.html', role: '現場調查員', back: ['index.html', '本章'], title: '現場調查' },
  interrogation: { file: 'interrogation.html', role: '偵訊官', back: ['index.html', '本章'], title: '偵訊紀錄' },
  accuse: { file: 'accuse.html', role: '最終指控', back: ['index.html', '本章'], title: '提出指控' }
};

function shell(ch, role) {
  const p = PAGE[role];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#15110d">
  <meta name="robots" content="noindex">
  <title>${esc(ch.label)}・${esc(p.title)}｜${esc(SERIES.title)}</title>
  <link rel="icon" href="${FAVICON}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${FONTS}"></noscript>
  <link rel="stylesheet" href="../css/style.css">
  <script>document.documentElement.classList.add('js');</script>
</head>
<body class="page-case page-${role}">
  <header class="topbar">
    <a class="topbar-back" href="${p.back[0]}">← ${p.back[1]}</a>
    <p class="topbar-role">${esc(p.role || ch.label)}</p>
    <p class="topbar-progress" id="topbar-status" aria-live="polite"></p>
  </header>

  <main class="page" id="app">
    <noscript><p class="notice">這一頁要開啟 JavaScript 才能玩。</p></noscript>
    <p class="loading">檔案解密中…</p>
  </main>
${role === 'accuse' ? '\n  <div class="lights" id="lights" aria-hidden="true"></div>\n' : ''}
  <script src="../js/case.js"></script>
  <script src="${role}.data.js"></script>
  <script src="../js/case-${role}.js"></script>
</body>
</html>
`;
}

const chapters = loadSources(ROOT);
if (!chapters) {
  console.error(`找不到 ${SOURCE_DIR}/ch*.json。新章節的原始內容只放在本機；在新的 session 裡先用 npm run chapters:unseal 還原。`);
  process.exit(1);
}
const problems = validate(chapters);
if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}

const manifest = [PROLOGUE_ENTRY];
for (const ch of chapters) {
  const built = await buildChapter(ch, chapters);
  const dir = path.join(ROOT, ch.id);
  mkdirSync(dir, { recursive: true });
  for (const role of ROLES) {
    writeFileSync(path.join(dir, `${role}.data.js`), renderDataJs(built.files[role]));
    writeFileSync(path.join(dir, PAGE[role].file), shell(ch, role));
  }
  manifest.push({ id: ch.id, label: ch.label, title: ch.title, teaser: ch.teaser, href: `${ch.id}/`, salt: built.salt, check: built.check });
}
writeFileSync(path.join(ROOT, 'chapters.js'), renderManifest(manifest));

// 驗證：只用通行碼解開剛寫出的檔案，窮舉後和原始內容比對
const { problems: verifyProblems, summaries } = await verifyAgainstSources(ROOT, chapters);
for (const line of summaries) console.log('✓ ' + line);
if (verifyProblems.length) {
  for (const p of verifyProblems) console.error('  ✗ ' + p);
  console.error(`✗ 驗證失敗 ${verifyProblems.length} 項`);
  process.exit(1);
}
console.log(`✓ 已產生 ${chapters.length} 章的加密資料、頁面與 chapters.js，內容和原始檔一致`);
