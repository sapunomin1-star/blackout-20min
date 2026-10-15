// 讀網站本身：哪些檔案會被 Pages 發布、每頁載入哪些檔、指控頁的選項 ID。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// 序章的四頁（案件內容寫在 HTML 裡，逐字對照 docs/SPEC.md）
export const PROLOGUE = 'prologue';
export const PAGES = ['index.html', 'scene.html', 'interrogation.html', 'accuse.html'].map((p) => `${PROLOGUE}/${p}`);

export function read(root, rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

// _config.yml 的 exclude 清單（格式很單純，只解析「exclude:」底下的「- 項目」）
export function jekyllExcludes(root) {
  const lines = read(root, '_config.yml').split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (/^exclude:\s*$/.test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const m = line.match(/^\s+-\s+(.+?)\s*$/);
      if (m) out.push(m[1].replace(/^["']|["']$/g, '').replace(/\/$/, ''));
      else if (/^\S/.test(line)) inList = false;
    }
  }
  return out;
}

// 所有檔案（相對路徑），略過 .git
export function walk(root, dir = '') {
  const out = [];
  for (const name of readdirSync(path.join(root, dir))) {
    if (dir === '' && name === '.git') continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(path.join(root, rel)).isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

// Jekyll 會發布的檔案：不在 exclude、路徑上沒有 . _ # ~ 開頭的部分
export function publishedFiles(root) {
  const excludes = jekyllExcludes(root);
  return walk(root).filter((rel) => {
    const parts = rel.split('/');
    if (parts.some((p) => /^[._#~]/.test(p))) return false;
    return !excludes.some((ex) => rel === ex || rel.startsWith(ex + '/'));
  });
}

// 一頁載入的本機檔（script src、stylesheet href），回傳相對 repo 根目錄的路徑
export function localAssets(root, page) {
  const html = read(root, page);
  const dir = path.posix.dirname(page);
  const resolve = (ref) => path.posix.normalize(path.posix.join(dir, ref));
  const isLocal = (r) => !/^(https?:)?\/\//.test(r) && !r.startsWith('data:');
  const refs = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) if (isLocal(m[1])) refs.push(resolve(m[1]));
  for (const m of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)) if (isLocal(m[1])) refs.push(resolve(m[1]));
  // 頁面 JS 用 script.src = '…' 動態載入的檔（路徑相對於頁面）
  for (const rel of [...refs]) {
    const js = path.join(root, rel);
    if (rel.endsWith('.js') && existsSync(js)) {
      for (const d of readFileSync(js, 'utf8').matchAll(/\.src\s*=\s*'([^']+\.js)'/g)) refs.push(resolve(d[1]));
    }
  }
  return [...new Set(refs)];
}

// 去掉標籤與註解，還原常見實體，拿來比對畫面文字
export function htmlText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// 指控頁的選項（ID 與顯示文字），是產生機密檔時的唯一 ID 來源
export function accuseOptions(root) {
  const html = read(root, `${PROLOGUE}/accuse.html`);
  const suspects = [...html.matchAll(/<input type="radio" name="suspect" value="([^"]+)">.*?<span class="opt-name">([^<]+)<\/span><span class="opt-role">([^<]+)<\/span>/g)].map(
    (m) => ({ id: m[1], name: m[2], role: m[3] })
  );
  const groupOf = (name) => {
    const out = [];
    const re = /<p class="opt-group-label"[^>]*>([^<]+)<\/p>|<input type="radio" name="([a-z]+)" value="([^"]+)"><span class="opt-text[^"]*">([^<]+)<\/span>/g;
    let group = null;
    for (const m of html.matchAll(re)) {
      if (m[1]) group = m[1];
      else if (m[2] === name) out.push({ id: m[3], text: m[4], group });
    }
    return out;
  };
  return { suspects, items: groupOf('evidence'), statements: groupOf('flaw') };
}
