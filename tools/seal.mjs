// 新章節原始內容的加密封存：tools/chapters.local/*.json（gitignored，有劇透）⇄ tools/chapters.sealed.json（進 git）
//
//   npm run chapters:seal                     用 CHAPTERS_PASSPHRASE 封存；內容沒變就不改寫檔案
//   npm run chapters:seal -- --new-passphrase 產生新的通關密語並封存（密語只印這一次，請自己保管）
//   npm run chapters:unseal                   用 CHAPTERS_PASSPHRASE 還原到 tools/chapters.local/
//
// 序章的機密原文（tools/secrets.local.json）是使用者的，不放進封存檔。
// 輸出只有檔名與數量，絕不印出內容。
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEALED_FILE, readSources, readSealed, openSealed, sealFiles, newPassphrase, sameFiles } from './lib/sealed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const fresh = process.argv.includes('--new-passphrase');
const force = process.argv.includes('--force');

if (mode === 'seal') {
  const files = readSources(ROOT);
  if (!files) {
    console.error('找不到 tools/chapters.local/ch*.json，沒有東西可以封存。');
    process.exit(1);
  }
  let passphrase = process.env.CHAPTERS_PASSPHRASE;
  if (fresh) passphrase = newPassphrase();
  if (!passphrase) {
    console.error('請用環境變數 CHAPTERS_PASSPHRASE 提供通關密語，或加 --new-passphrase 產生一組新的。');
    process.exit(1);
  }
  const existing = readSealed(ROOT);
  if (!fresh && existing) {
    try {
      if (sameFiles(await openSealed(existing, passphrase), files)) {
        console.log(`✓ 封存檔已經是最新的（${Object.keys(files).length} 個檔），沒有改寫`);
        process.exit(0);
      }
    } catch {
      if (!force) {
        console.error('這組通關密語打不開現有的封存檔。確定要用新密語覆蓋，請加 --force（舊密語就不能用了）。');
        process.exit(1);
      }
    }
  }
  await sealFiles(ROOT, passphrase, files);
  if (!sameFiles(await openSealed(readSealed(ROOT), passphrase), files)) {
    console.error('✗ 封存後解不回原內容');
    process.exit(1);
  }
  console.log(`✓ 已封存 ${Object.keys(files).length} 個檔到 ${SEALED_FILE}，並確認解得回來`);
  if (fresh) console.log(`新的通關密語（只顯示這一次，請另外保管）：${passphrase}`);
} else if (mode === 'unseal') {
  const passphrase = process.env.CHAPTERS_PASSPHRASE;
  if (!passphrase) {
    console.error('請用環境變數 CHAPTERS_PASSPHRASE 提供通關密語。');
    process.exit(1);
  }
  const box = readSealed(ROOT);
  if (!box) {
    console.error(`找不到 ${SEALED_FILE}。`);
    process.exit(1);
  }
  let files;
  try {
    files = await openSealed(box, passphrase);
  } catch {
    console.error('通關密語不對，或封存檔壞了。');
    process.exit(1);
  }
  const dir = path.join(ROOT, 'tools', 'chapters.local');
  mkdirSync(dir, { recursive: true });
  const current = readSources(ROOT) || {};
  const changed = Object.keys(files).filter((n) => current[n] !== undefined && current[n] !== files[n]);
  if (changed.length && !force) {
    console.error(`本機的 ${changed.join('、')} 和封存檔不同；要用封存檔覆蓋請加 --force。`);
    process.exit(1);
  }
  for (const [n, text] of Object.entries(files)) writeFileSync(path.join(dir, n), text);
  console.log(`✓ 已還原 ${Object.keys(files).length} 個檔到 tools/chapters.local/`);
} else {
  console.error('用法：node tools/seal.mjs seal [--new-passphrase] [--force] | unseal [--force]');
  process.exit(1);
}
