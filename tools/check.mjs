// npm run check：只用 node 的全站檢查。
//   內容逐字、角色隔離、共用檔不放案件內容、外部資源、Pages 發布範圍、
//   判定窮舉（假資料一定跑；有 js/secrets.js 就再跑真資料）、明文答案掃描、機密檔沒進 git，
//   最後在暫存複本上做負向案例，確認上面的檢查真的抓得到問題。
// 輸出絕不印出機密原文或正解。
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpec } from './lib/spec.mjs';
import { PAGES, read, publishedFiles, localAssets, htmlText, accuseOptions, walk } from './lib/site.mjs';
import { buildSynthetic, loadVerdict, enumerate, compareWithInput, normalizeInput, syntheticInput, buildData, renderSecretsJs } from './lib/secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.w3.org'];
const GAME_FILE = /^([^/]+\.html|css\/[^/]+\.css|js\/[^/]+\.js)$/;

function windows(text, n) {
  const out = new Set();
  const chars = [...text.replace(/\s+/g, '')];
  for (let i = 0; i + n <= chars.length; i += 1) out.add(chars.slice(i, i + n).join(''));
  return out;
}

// 檔案原文＋去標籤後的文字，兩種都掃
function haystack(root, rel) {
  const raw = read(root, rel);
  return rel.endsWith('.html') ? raw + '\n' + htmlText(raw) : raw;
}

function firstHit(fragments, text) {
  for (const f of fragments) if (text.includes(f)) return f;
  return null;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

export async function runChecks(root, { useGit = true } = {}) {
  const results = [];
  const pass = (cat, msg) => results.push({ level: 'pass', cat, msg });
  const fail = (cat, msg) => results.push({ level: 'fail', cat, msg });
  const warn = (cat, msg) => results.push({ level: 'warn', cat, msg });

  const spec = loadSpec(root);
  const published = publishedFiles(root);

  /* ---------- 1. 內容逐字 ---------- */
  {
    const cat = '內容逐字';
    let bad = 0;
    const need = (cond, msg) => {
      if (!cond) {
        bad += 1;
        fail(cat, msg);
      }
    };
    need(htmlText(read(root, 'index.html')).includes(spec.preface), 'index.html 沒有逐字的案件前言');

    const scene = read(root, 'scene.html');
    for (const item of spec.items) {
      const found = scene.split('<details class="item').find((b) => b.includes(`data-item="${item.id}"`));
      const block = found ? [found] : null;
      const text = block ? htmlText(block[0]) : '';
      need(block && text.includes(item.name), `scene.html 找不到物品「${item.name}」`);
      need(text.includes(item.desc), `scene.html 的「${item.name}」描述和規格不一致`);
      need(scene.includes(`data-room="${item.room}"`) && new RegExp(`id="room-${item.room}"[\\s\\S]*?data-item="${item.id}"`).test(scene), `「${item.name}」不在${item.roomName}`);
      for (const note of item.notes) need(!htmlText(scene).includes(note), `scene.html 顯示了設計註記「${note}」`);
      if (item.reveal) {
        const dig = text.match(/翻開泥土/);
        need(dig && block[0].includes(`<span class="dig-button">${item.reveal.button}</span>`), `「${item.name}」沒有「${item.reveal.button}」按鈕`);
        need(/<details class="dig">[\s\S]*?<\/summary>\s*<p[^>]*>([^<]+)<\/p>/.test(block[0]) && block[0].match(/<details class="dig">[\s\S]*?<\/summary>\s*<p[^>]*>([^<]+)<\/p>/)[1] === item.reveal.text, `「${item.name}」翻開後的文字和規格不一致`);
      }
    }
    need(!htmlText(scene).includes('後才顯示'), 'scene.html 顯示了互動說明文字');

    const inter = read(root, 'interrogation.html');
    for (const s of spec.suspects) {
      const m = inter.match(new RegExp(`<article class="paper suspect" id="suspect-${s.id}"[\\s\\S]*?</article>`));
      const block = m ? m[0] : '';
      const pick = (cls) => [...block.matchAll(new RegExp(`class="${cls}"[^>]*>([^<]*)<`, 'g'))].map((x) => x[1]);
      need(block, `interrogation.html 找不到 ${s.name}`);
      need(pick('suspect-name')[0] === s.name && pick('suspect-role')[0] === s.role, `${s.name} 的名字或身分不對`);
      need(pick('testimony')[0] === s.testimony, `${s.name} 的口供和規格不一致`);
      need(pick('question')[0] === s.question, `${s.name} 的追問和規格不一致`);
      need(pick('answer')[0] === s.answer, `${s.name} 的回答和規格不一致`);
      const reactions = pick('reaction');
      if (s.reaction) need(reactions.length === 1 && reactions[0] === s.reaction, `${s.name} 的觀察反應和規格不一致`);
      else need(reactions.length === 0, `${s.name} 在規格裡沒有觀察反應，頁面卻有`);
      need(/<details class="follow-up">\s*<summary>[\s\S]*?追問[\s\S]*?<\/summary>/.test(block), `${s.name} 沒有「追問」按鈕`);
    }

    const opts = accuseOptions(root);
    need(JSON.stringify(opts.suspects.map((s) => [s.id, s.name, s.role])) === JSON.stringify(spec.suspects.map((s) => [s.id, s.name, s.role])), 'accuse.html 的嫌疑人選項和規格不一致');
    need(JSON.stringify(opts.items.map((i) => [i.id, i.text, i.group])) === JSON.stringify(spec.items.map((i) => [i.id, i.name, i.roomName])), 'accuse.html 的現場證據選項和規格不一致（要依房間分組、只列名稱）');
    need(JSON.stringify(opts.statements.map((s) => [s.id, s.text])) === JSON.stringify(spec.statements.map((s) => [s.id, s.text])), 'accuse.html 的口供句選項和規格不一致（一句一個選項）');
    const accuseText = htmlText(read(root, 'accuse.html'));
    for (const item of spec.items) need(!accuseText.includes(item.desc), `accuse.html 不該列出「${item.name}」的描述`);
    if (!bad) pass(cat, `首頁前言、10 件物品、4 位嫌疑人的口供／追問／回答／觀察反應、指控頁 4＋10＋12 個選項都和規格逐字相同`);
  }

  /* ---------- 2. 角色隔離 ---------- */
  {
    const cat = '角色隔離';
    let bad = 0;
    const testimonyTexts = spec.suspects.flatMap((s) => [s.testimony, s.question, s.answer, s.reaction].filter(Boolean));
    const sceneTexts = spec.items.flatMap((i) => [i.desc, i.reveal && i.reveal.text].filter(Boolean));
    const testimonyFrags = new Set(testimonyTexts.flatMap((t) => [...windows(t, 6)]));
    const sceneFrags = new Set(sceneTexts.flatMap((t) => [...windows(t, 6)]));
    const scan = (page, frags, what) => {
      for (const rel of [page, ...localAssets(root, page)]) {
        if (!existsSync(path.join(root, rel))) continue;
        const hit = firstHit(frags, haystack(root, rel));
        if (hit) {
          bad += 1;
          fail(cat, `${rel}（${page} 會載入）出現${what}片段「${hit}」`);
        }
      }
    };
    scan('scene.html', testimonyFrags, '口供');
    scan('interrogation.html', sceneFrags, '現場物品描述');

    // 共用檔：被兩頁以上載入的本機檔，不能有任何案件內容
    const usage = new Map();
    for (const page of PAGES) for (const rel of localAssets(root, page)) usage.set(rel, (usage.get(rel) || 0) + 1);
    const shared = [...usage].filter(([, n]) => n > 1).map(([rel]) => rel);
    const caseFrags = new Set([spec.preface, ...testimonyTexts, ...sceneTexts].flatMap((t) => [...windows(t, 4)]));
    const names = [...spec.items.map((i) => i.name), ...spec.suspects.map((s) => s.name), ...spec.rooms.map((r) => r.name)];
    for (const rel of shared) {
      const text = haystack(root, rel);
      const hit = firstHit(caseFrags, text) || names.find((n) => text.includes(n));
      if (hit) {
        bad += 1;
        fail(cat, `共用檔 ${rel} 含有案件內容「${hit}」`);
      }
    }
    if (!bad) pass(cat, `scene 不含口供、interrogation 不含物品描述；共用檔（${shared.join('、')}）沒有案件內容`);
  }

  /* ---------- 3. 外部資源與發布範圍 ---------- */
  {
    const cat = '外部資源';
    let bad = 0;
    for (const rel of published) {
      if (!/\.(html|css|js|svg)$/.test(rel)) continue;
      const text = read(root, rel);
      for (const m of text.matchAll(/https?:\/\/([^/\s"'()<>]+)[^\s"'()<>]*/g)) {
        if (!ALLOWED_HOSTS.includes(m[1])) {
          bad += 1;
          fail(cat, `${rel} 引用了外部網址 ${m[0]}`);
        }
      }
      if (/<img\b|<iframe\b|<video\b|<audio\b|<image\b|<embed\b|<object\b/i.test(text)) {
        bad += 1;
        fail(cat, `${rel} 有圖片或嵌入元素（插圖只能用 CSS、inline SVG 或 emoji）`);
      }
      for (const m of text.replace(/url\("data:[^"]*"\)/g, '').matchAll(/url\(\s*["']?([^"')]+)/g)) {
        if (!/^(data:|#)/.test(m[1])) {
          bad += 1;
          fail(cat, `${rel} 的 url(${m[1]}) 不是內嵌資料`);
        }
      }
      for (const m of text.matchAll(/font-family:\s*([^;]+);|--font-[a-z]+:\s*([^;]+);/g)) {
        const stack = (m[1] || m[2]).trim();
        if (/Noto Serif TC/.test(stack) && !/(serif|sans-serif|monospace)\s*$/.test(stack)) {
          bad += 1;
          fail(cat, `${rel} 的字體 ${stack} 沒有系統字體 fallback`);
        }
      }
    }
    if (!bad) pass(cat, '沒有外部圖片；外部連線只有 Google Fonts，且字體都有系統 fallback');
  }
  {
    const cat = '發布範圍';
    let bad = 0;
    for (const rel of published) {
      if (!GAME_FILE.test(rel)) {
        bad += 1;
        fail(cat, `${rel} 會被 GitHub Pages 發布；不是遊戲檔就補進 _config.yml 的 exclude`);
      }
    }
    for (const page of PAGES) {
      if (!published.includes(page)) {
        bad += 1;
        fail(cat, `${page} 不在發布範圍`);
      }
      const html = read(root, page);
      if (/^\s*---/.test(html)) {
        bad += 1;
        fail(cat, `${page} 有 YAML front matter，Jekyll 會改寫它`);
      }
      if (!/<meta name="viewport" content="width=device-width/.test(html) || !/<html lang="zh-Hant/.test(html)) {
        bad += 1;
        fail(cat, `${page} 缺少手機 viewport 或繁體中文 lang`);
      }
      for (const rel of localAssets(root, page)) {
        if (rel !== 'js/secrets.js' && !existsSync(path.join(root, rel))) {
          bad += 1;
          fail(cat, `${page} 載入的 ${rel} 不存在`);
        }
      }
    }
    if (existsSync(path.join(root, '.nojekyll'))) {
      bad += 1;
      fail(cat, '有 .nojekyll：exclude 會失效，docs/ 會被一起發布');
    }
    if (!bad) pass(cat, `只會發布 ${published.length} 個遊戲檔：${published.join('、')}`);
  }

  /* ---------- 4. 判定 ---------- */
  const secretsPath = path.join(root, 'js', 'secrets.js');
  const localPath = path.join(root, 'tools', 'secrets.local.json');
  const options = accuseOptions(root);
  // 假資料：可接受的破綻一句、兩句各測一次
  for (const flawCount of [1, 2]) {
    const cat = '判定窮舉';
    const synth = await buildSynthetic(root, { flawCount });
    const r = await enumerate(loadVerdict(root, synth.js), options);
    const diffs = compareWithInput(r.answer, synth.norm);
    if (r.problems.length || diffs.length) fail(cat, `假資料（破綻 ${flawCount} 句）測試失敗：${[...r.problems, ...diffs].join('；')}`);
    else pass(cat, `隨機假資料（破綻 ${flawCount} 句）：窮舉 ${r.total} 種組合，只有一人走兇手路徑、${r.solvedCount} 組全對（${r.evidenceCount} 件證據 × ${r.flawCount} 句破綻），其他人都回自己的訊息，解密結果逐字相同`);
  }

  let secretTexts = null;
  if (existsSync(secretsPath)) {
    const cat = '判定窮舉';
    const js = readFileSync(secretsPath, 'utf8');
    try {
      const runner = loadVerdict(root, js);
      const data = runner.data;
      const lens = new Set(data.suspects.map((s) => s.c.length));
      const sorted = data.suspects.every((s, i, a) => i === 0 || a[i - 1].i < s.i);
      const ids = [...options.suspects, ...options.items, ...options.statements].map((o) => o.id);
      const leakedId = ids.find((id) => new RegExp(`["']${id}["']`).test(js.replace(/^\/\*[\s\S]*?\*\//, '')));
      if (data.suspects.length !== options.suspects.length) fail(cat, 'js/secrets.js 的嫌疑人筆數不對');
      else if (lens.size !== 1) fail(cat, 'js/secrets.js 四筆嫌疑人密文長度不同，可能看得出誰是兇手');
      else if (!sorted) fail(cat, 'js/secrets.js 的嫌疑人資料沒有依雜湊排序');
      else if (leakedId) fail(cat, `js/secrets.js 出現明文選項 ID「${leakedId}」`);
      else pass(cat, 'js/secrets.js 只有鹽、雜湊與密文：四筆密文等長、依雜湊排序');

      const r = await enumerate(runner, options);
      if (r.problems.length) fail(cat, `真資料：${r.problems.join('；')}`);
      else pass(cat, `真資料：窮舉 ${r.total} 種組合，剛好一人走兇手路徑、${r.solvedCount} 組全對（${r.evidenceCount} 件證據 × ${r.flawCount} 句破綻的完整組合），其他三人都回自己的訊息`);
      secretTexts = [...Object.values(r.answer.messages), r.answer.truth].filter(Boolean);

      if (existsSync(localPath)) {
        try {
          const norm = normalizeInput(JSON.parse(readFileSync(localPath, 'utf8')), options);
          const diffs = compareWithInput(r.answer, norm);
          if (diffs.length) fail(cat, `解密結果和 tools/secrets.local.json 不同：${diffs.join('、')}（重跑 npm run build:secrets）`);
          else pass(cat, '解密結果和 tools/secrets.local.json 逐字相同');
        } catch (err) {
          fail(cat, 'tools/secrets.local.json 有問題：' + err.message);
        }
      } else {
        warn(cat, '沒有 tools/secrets.local.json，略過「解密結果與機密原文逐字比對」（雲端 session 結束後這個檔就不在了，屬正常）');
      }
    } catch (err) {
      fail(cat, 'js/secrets.js 無法判定：' + err.message);
    }
  } else {
    warn('判定窮舉', '還沒有 js/secrets.js：遊戲目前不能判定指控。請使用者貼上機密段，整理成 tools/secrets.local.json 後執行 npm run build:secrets');
    if (existsSync(localPath)) warn('判定窮舉', '已有 tools/secrets.local.json，但還沒產生 js/secrets.js');
  }

  /* ---------- 5. 明文答案掃描 ---------- */
  {
    const cat = '明文掃描';
    if (!secretTexts) {
      warn(cat, '沒有判定資料可解密，略過明文掃描（假資料的掃描在自我測試裡驗證）');
    } else {
      const specText = read(root, 'docs/SPEC.md');
      const frags = new Set();
      for (const t of secretTexts) for (const w of windows(t, 6)) if (!specText.includes(w)) frags.add(w);
      const targets = new Map();
      for (const rel of published) targets.set(rel, haystack(root, rel));
      if (useGit) {
        const tracked = git(root, ['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean);
        for (const rel of tracked) {
          if (existsSync(path.join(root, rel)) && !/\.(png|jpe?g|gif|woff2?)$/.test(rel)) targets.set(rel, haystack(root, rel));
        }
        targets.set('（git commit 訊息）', git(root, ['log', '--all', '--format=%B']));
      }
      let bad = 0;
      for (const [rel, text] of targets) {
        const hit = firstHit(frags, text);
        if (hit) {
          bad += 1;
          fail(cat, `${rel} 含有機密原文片段（為了不擴散，這裡不印出片段）`);
        }
      }
      if (!bad) pass(cat, `${frags.size} 個機密片段（6 字以上、不含規格公開文字）都沒出現在 ${targets.size} 個檔案${useGit ? '與 commit 訊息' : ''}裡`);
    }
  }

  /* ---------- 6. 機密檔沒進 git ---------- */
  if (useGit) {
    const cat = '機密檔';
    const rel = 'tools/secrets.local.json';
    let tracked = true;
    try {
      git(root, ['ls-files', '--error-unmatch', rel]);
    } catch {
      tracked = false;
    }
    let ignored = true;
    try {
      git(root, ['check-ignore', '-q', rel]);
    } catch {
      ignored = false;
    }
    const inHistory = git(root, ['log', '--all', '--format=%H', '--', rel]).trim();
    if (tracked) fail(cat, `${rel} 被 git 追蹤了！先別 push，告訴使用者`);
    else if (!ignored) fail(cat, `${rel} 沒有被 .gitignore 擋住`);
    else if (inHistory) fail(cat, `${rel} 曾經進過 git 歷史！告訴使用者，不要自己改寫歷史`);
    else pass(cat, `${rel} 沒被追蹤、已被 .gitignore 擋住、也不在 git 歷史裡`);
  }

  return results;
}

/* ---------- 負向案例：在暫存複本上故意犯規，確認檢查會紅 ---------- */

async function selfTest() {
  const out = [];
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'blackout-check-'));
  try {
    const copy = () => {
      const dir = mkdtempSync(path.join(tmp, 'case-'));
      for (const rel of walk(ROOT).filter((r) => !/^(node_modules|output)\//.test(r) && r !== 'tools/secrets.local.json' && r !== 'js/secrets.js')) {
        mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        cpSync(path.join(ROOT, rel), path.join(dir, rel));
      }
      return dir;
    };
    const spec = loadSpec(ROOT);
    const options = accuseOptions(ROOT);
    const inject = (dir, rel, text) => {
      const file = path.join(dir, rel);
      writeFileSync(file, readFileSync(file, 'utf8').replace('</main>', `<p>${text}</p></main>`).replace(/\}\)\(\);\s*$/, `  /* ${text} */\n})();\n`));
    };
    const expect = async (name, dir, cat) => {
      const res = await runChecks(dir, { useGit: false });
      const caught = res.some((r) => r.level === 'fail' && r.cat === cat);
      out.push({ name, caught });
    };

    let dir = copy();
    inject(dir, 'scene.html', spec.suspects[3].statements[1].text);
    await expect('scene.html 放一句口供', dir, '角色隔離');

    dir = copy();
    inject(dir, 'interrogation.html', spec.items[0].desc);
    await expect('interrogation.html 放一段物品描述', dir, '角色隔離');

    dir = copy();
    inject(dir, 'js/common.js', spec.suspects[1].reaction);
    await expect('共用 JS 放案件內容', dir, '角色隔離');

    dir = copy();
    inject(dir, 'index.html', '<img src="https://example.com/a.png" alt="">');
    await expect('放外部圖片', dir, '外部資源');

    dir = copy();
    writeFileSync(path.join(dir, 'notes.md'), '隨手筆記');
    await expect('新增沒被 exclude 的檔案', dir, '發布範圍');

    dir = copy();
    const raw = syntheticInput(options);
    const norm = normalizeInput(raw, options);
    writeFileSync(path.join(dir, 'js', 'secrets.js'), renderSecretsJs(await buildData(norm, options)));
    writeFileSync(path.join(dir, 'tools', 'secrets.local.json'), JSON.stringify(raw));
    const clean = await runChecks(dir, { useGit: false });
    out.push({ name: '假機密資料本身應該全部通過', caught: !clean.some((r) => r.level === 'fail') });
    inject(dir, 'accuse.html', norm.truth.split('\n')[0]);
    await expect('任一頁放一段真相', dir, '明文掃描');

    dir = copy();
    writeFileSync(path.join(dir, 'tools', 'secrets.local.json'), JSON.stringify(raw));
    const other = normalizeInput(syntheticInput(options), options);
    writeFileSync(path.join(dir, 'js', 'secrets.js'), renderSecretsJs(await buildData(other, options)));
    await expect('判定資料和機密檔不一致', dir, '判定窮舉');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}

/* ---------- CLI ---------- */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const icon = { pass: '✓', fail: '✗', warn: '⚠' };
  const results = await runChecks(ROOT, { useGit: existsSync(path.join(ROOT, '.git')) });
  let lastCat = null;
  for (const r of results) {
    if (r.cat !== lastCat) console.log(`\n【${r.cat}】`);
    lastCat = r.cat;
    console.log(`  ${icon[r.level]} ${r.msg}`);
  }

  console.log('\n【自我測試：負向案例】');
  const st = await selfTest();
  for (const c of st) console.log(`  ${c.caught ? '✓' : '✗'} ${c.name}${c.caught ? '：有抓到' : '：沒抓到！'}`);

  const failed = results.filter((r) => r.level === 'fail').length + st.filter((c) => !c.caught).length;
  const warned = results.filter((r) => r.level === 'warn').length;
  console.log('');
  if (failed) {
    console.log(`✗ 檢查失敗：${failed} 項`);
    process.exit(1);
  }
  console.log(warned ? `✓ 檢查通過（有 ${warned} 項提醒，見上方 ⚠）` : '✓ 全部檢查通過');
}
