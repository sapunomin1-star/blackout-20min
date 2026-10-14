// npm run e2e：用 playwright-core 開真的瀏覽器，用真點擊與鍵盤跑完四頁。
//   手機直式 390×844：每件物品、每段口供逐字核對；指控的五種結果都跑到；每頁沒有水平捲動。
//   桌機 1280 寬抽查。截圖存在 output/e2e/（gitignored）。
// 玩家操作只用 click／鍵盤；page.evaluate 只拿來讀狀態。
// 正解不寫死：先用 node 窮舉 js/verdict.js 找出各種結果的組合，再用真點擊去選。
// 還沒有 prologue/secrets.js 時，改用每次隨機產生的假判定資料（攔截 secrets.js 的請求）測判定流程。
// 瀏覽器：E2E_EXECUTABLE=/path/to/chromium；沒設時依序試 /opt/pw-browsers/chromium、playwright 內建、本機 Chrome。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from '../tools/serve.mjs';
import { loadSpec } from '../tools/lib/spec.mjs';
import { accuseOptions } from '../tools/lib/site.mjs';
import { buildSynthetic, loadVerdict, enumerate } from '../tools/lib/secrets.mjs';
import { readManifest, openRole, crackLocks, crackPresents, crackAccuse, judgeAccuse, fieldSpace, normalizeCode } from '../tools/lib/chapters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output', 'e2e');
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) if (name.endsWith('.png')) rmSync(path.join(OUT, name));

const spec = loadSpec(ROOT);
const HAS_SECRETS = existsSync(path.join(ROOT, 'prologue', 'secrets.js'));
const options = accuseOptions(ROOT);
const failures = [];
let passed = 0;

function check(cond, msg) {
  if (cond) passed += 1;
  else {
    failures.push(msg);
    console.log('  ✗ ' + msg);
  }
}
const squash = (s) => String(s).replace(/\s+/g, '');
const step = (title) => console.log('\n' + title);

/* ---------- 瀏覽器 ---------- */

async function launch() {
  const args = ['--host-resolver-rules=MAP lan.test 127.0.0.1'];
  if (process.env.HTTPS_PROXY) {
    // 雲端容器要經過代理才連得到 Google Fonts；本機伺服器不走代理
    args.push('--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost;lan.test');
  }
  const tries = [];
  if (process.env.E2E_EXECUTABLE) tries.push({ executablePath: process.env.E2E_EXECUTABLE });
  else {
    if (existsSync('/opt/pw-browsers/chromium')) tries.push({ executablePath: '/opt/pw-browsers/chromium' });
    tries.push({}, { channel: 'chrome' });
  }
  let lastErr;
  for (const t of tries) {
    try {
      return await chromium.launch({ ...t, args });
    } catch (err) {
      lastErr = err;
    }
  }
  console.error('開不了瀏覽器。請設定 E2E_EXECUTABLE 指向 Chromium／Chrome，或執行 npx playwright-core install chromium。');
  throw lastErr;
}

// 還沒產生判定資料時，任何頁面連到指控頁都會有 secrets.js 的 404，這是預期的
function watch(page, label, { allow404 = HAS_SECRETS ? [] : ['/prologue/secrets.js'] } = {}) {
  page.on('pageerror', (err) => check(false, `${label}：頁面 JS 錯誤 ${err.message}`));
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (req.url().startsWith('data:')) return;
    const ok = ['127.0.0.1', 'localhost', 'lan.test', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host);
    if (!ok) check(false, `${label}：不該連到外部網址 ${req.url()}`);
  });
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'lan.test') return;
    if (res.status() >= 400 && !allow404.includes(url.pathname)) check(false, `${label}：${url.pathname} 回應 ${res.status()}`);
  });
}

async function noHScroll(page, label) {
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    view: document.documentElement.clientWidth
  }));
  check(m.doc <= m.view && m.body <= m.view, `${label}：有水平捲動（內容寬 ${Math.max(m.doc, m.body)}，畫面 ${m.view}）`);
}

// 窄手機（320 寬）也不能水平捲動；量完換回原本的寬度
async function narrowNoHScroll(page, label) {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: 320, height: vp.height });
  await noHScroll(page, `${label}（320 寬）`);
  await page.setViewportSize(vp);
}

async function shot(page, name) {
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]));
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
}

// details 的 toggle 事件是非同步觸發的，標記要等一下才會出現
const visibleSoon = (locator) => locator.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
const visibleText = async (locator) => ((await locator.isVisible()) ? squash(await locator.innerText()) : null);

/* ---------- 首頁 ---------- */

async function testIndex(ctx, base) {
  step('首頁');
  const page = await ctx.newPage();
  watch(page, '首頁');
  await page.goto(base + 'prologue/index.html');
  check((await page.title()) === '停電的二十分鐘', '首頁標題不對');
  check((await visibleText(page.locator('.preface'))) === squash(spec.preface), '首頁前言和規格不一致');
  check((await page.locator('.rules').innerText()).includes('不能看對方的畫面，只能用說的。'), '首頁少了規則「不能看對方的畫面，只能用說的。」');
  await noHScroll(page, '首頁');
  await shot(page, 'm-index');

  const accuseLink = page.getByRole('link', { name: '提出指控' });
  const box = await accuseLink.boundingBox();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  check(box && box.y > height * 0.7, '「提出指控」入口應該在頁面底部');

  await page.getByRole('link', { name: /我是現場調查員/ }).click();
  await page.waitForURL(/scene\.html$/);
  await page.goBack();
  await page.getByRole('link', { name: /我是偵訊官/ }).click();
  await page.waitForURL(/interrogation\.html$/);
  await page.goBack();
  await accuseLink.click();
  await page.waitForURL(/accuse\.html$/);
  console.log('  ✓ 前言逐字、規則、兩個身分按鈕與底部指控入口都能用');
  await page.close();
}

/* ---------- 現場 ---------- */

async function testScene(ctx, base) {
  step('現場調查員（scene.html）');
  const page = await ctx.newPage();
  watch(page, '現場');
  await page.goto(base + 'prologue/scene.html');
  check(squash(await page.locator('#seen-count').innerText()) === '0', '一開始的已查看數應該是 0');

  for (const [ri, room] of spec.rooms.entries()) {
    // 一半用平面圖點，一半用分頁點
    if (ri % 2 === 0) await page.locator(`#tab-${room.id}`).click();
    else await page.locator(`.fp-room[data-room="${room.id}"]`).first().click();
    check(await page.locator(`#room-${room.id}`).isVisible(), `${room.name} 的分頁沒有顯示`);
    for (const other of spec.rooms) if (other.id !== room.id) check(!(await page.locator(`#room-${other.id}`).isVisible()), `切到${room.name}時${other.name}應該隱藏`);
    check((await page.locator(`#tab-${room.id}`).getAttribute('aria-selected')) === 'true', `${room.name} 分頁沒有標成選取`);

    for (const item of room.items) {
      const card = page.locator(`.item[data-item="${item.id}"]`);
      const desc = card.locator('.item-body > .item-desc');
      check(!(await desc.isVisible()), `「${item.name}」的描述應該點了才出現`);
      check(squash(await card.locator('.item-name').innerText()) === item.name, `「${item.name}」名稱不對`);
      await card.locator(':scope > summary').click();
      check((await visibleText(desc)) === squash(item.desc), `「${item.name}」的描述和規格不一致`);
      if (item.reveal) {
        const result = card.locator('.dig-result');
        check(!(await result.isVisible()), `「${item.name}」埋著的東西應該按「${item.reveal.button}」後才出現`);
        const button = card.locator('.dig > summary');
        check(squash(await button.innerText()) === item.reveal.button, `沒有「${item.reveal.button}」按鈕`);
        await button.click();
        check((await visibleText(result)) === squash(item.reveal.text), `「${item.name}」翻開後的文字和規格不一致`);
      }
      check(await visibleSoon(card.locator('.seen-mark')), `「${item.name}」看過後沒有標記`);
    }
    await noHScroll(page, `現場・${room.name}`);
    await shot(page, `m-scene-${ri + 1}-${room.id}`);
  }

  const body = await page.locator('body').innerText();
  for (const item of spec.items) for (const note of item.notes) check(!body.includes(note), `現場頁不該顯示設計註記「${note}」`);
  check(!body.includes('後才顯示'), '現場頁不該顯示互動說明');
  for (const s of spec.suspects) for (const st of s.statements) check(!body.includes(st.text), '現場頁出現了口供');
  check(squash(await page.locator('#seen-count').innerText()) === String(spec.items.length), '十件物品都看過後，已查看數應該是 10');

  await page.reload();
  check(squash(await page.locator('#seen-count').innerText()) === String(spec.items.length), '重新整理後已查看紀錄沒有保留');
  await page.locator('#reset-marks').click();
  check(squash(await page.locator('#seen-count').innerText()) === '0', '清除查看紀錄後應該歸零');
  console.log('  ✓ 5 個房間、10 件物品逐字相同；盆栽要翻開泥土才看得到；設計註記沒顯示；已查看紀錄可保留與清除');
  await page.close();
}

/* ---------- 偵訊 ---------- */

async function testInterrogation(ctx, base) {
  step('偵訊官（interrogation.html）');
  const page = await ctx.newPage();
  watch(page, '偵訊');
  await page.goto(base + 'prologue/interrogation.html');
  for (const s of spec.suspects) {
    const card = page.locator(`#suspect-${s.id}`);
    check(squash(await card.locator('.suspect-name').innerText()) === s.name, `${s.name} 名字不對`);
    check(squash(await card.locator('.suspect-role').innerText()) === s.role, `${s.name} 身分不對`);
    check((await visibleText(card.locator('.testimony'))) === squash(s.testimony), `${s.name} 的口供和規格不一致`);
    check(!(await card.locator('.question').isVisible()) && !(await card.locator('.answer').isVisible()), `${s.name} 的追問應該按了才出現`);
    const button = card.locator('.follow-up > summary');
    check(squash(await button.innerText()) === '追問', `${s.name} 沒有「追問」按鈕`);
    await button.click();
    check((await visibleText(card.locator('.question'))) === squash(s.question), `${s.name} 的追問和規格不一致`);
    check((await visibleText(card.locator('.answer'))) === squash(s.answer), `${s.name} 的回答和規格不一致`);
    const reaction = card.locator('.reaction');
    if (s.reaction) {
      check((await visibleText(reaction)) === squash(s.reaction), `${s.name} 的觀察反應和規格不一致`);
      check((await reaction.evaluate((el) => getComputedStyle(el).fontStyle)) === 'italic', `${s.name} 的觀察反應應該是斜體`);
    } else {
      check((await reaction.count()) === 0, `${s.name} 在規格裡沒有觀察反應，不該顯示`);
    }
    check(await visibleSoon(card.locator('.seen-mark')), `${s.name} 追問後沒有標記`);
  }
  const body = await page.locator('body').innerText();
  for (const item of spec.items) check(!body.includes(item.desc), `偵訊頁出現了「${item.name}」的描述`);
  check(squash(await page.locator('#asked-count').innerText()) === '4', '四位都追問後，已追問數應該是 4');
  await noHScroll(page, '偵訊');
  await shot(page, 'm-interrogation');
  console.log('  ✓ 4 位嫌疑人的口供、追問、回答、斜體觀察反應逐字相同；陳先生沒有觀察反應');
  await page.close();
}

/* ---------- 指控 ---------- */

async function openForm(page, base) {
  await page.goto(base + 'prologue/accuse.html');
  await page.locator('#gate-ready').click();
  check(await page.locator('#accuse-form').isVisible(), '按「準備好了」後應該出現指控表單');
}

async function choose(page, choice) {
  await page.locator(`.suspect-option:has(input[value="${choice.suspect}"])`).click();
  for (const [field, value] of [['evidence', choice.evidence], ['flaw', choice.flaw]]) {
    const dropdown = page.locator(`.dropdown[data-field="${field}"]`);
    await dropdown.locator(':scope > summary').click();
    const opt = dropdown.locator(`.opt:has(input[value="${value}"])`);
    await opt.click();
    await page.waitForFunction((f) => !document.querySelector(`.dropdown[data-field="${f}"]`).open, field);
    const shown = squash(await dropdown.locator('.dropdown-value').innerText());
    check(shown.includes(squash(await opt.locator('.opt-text').innerText())), `${field} 選好後，選單上應該顯示選到的項目`);
  }
}

async function submitAndRead(page) {
  await page.locator('#submit').click();
  await page.locator('#verdict').waitFor({ state: 'visible', timeout: 10000 });
  return {
    solved: await page.locator('#solved-stamp').isVisible(),
    title: squash(await page.locator('#verdict-title').innerText()),
    text: squash(await page.locator('#verdict-text').innerText())
  };
}

async function testAccuse(browser, ctxOptions, base, port) {
  step('指控（accuse.html）');
  const realPath = path.join(ROOT, 'prologue', 'secrets.js');
  const real = existsSync(realPath);
  let js;
  if (real) {
    js = readFileSync(realPath, 'utf8');
    console.log('  使用真的判定資料 prologue/secrets.js');
  } else {
    js = (await buildSynthetic(ROOT)).js;
    writeFileSync(path.join(OUT, 'secrets.synthetic.js'), js);
    console.log('  ⚠ 還沒有 prologue/secrets.js：先確認頁面會提示，再用隨機假資料測判定流程');
  }

  const ctx = await browser.newContext(ctxOptions);
  {
    const page = await ctx.newPage();
    watch(page, '指控（無資料）');
    await page.goto(base + 'prologue/accuse.html');
    check(await page.locator('#gate').isVisible(), '指控頁要先問「兩人都準備好了嗎？」');
    check((await page.locator('#gate').innerText()).includes('兩人都準備好了嗎？'), '開場確認文字不對');
    check(!(await page.locator('#accuse-form').isVisible()), '還沒按準備好之前不該看到表單');
    await shot(page, 'm-accuse-1-gate');
    await page.locator('#gate-ready').click();
    await page.locator('#submit').click();
    check(((await visibleText(page.locator('#form-error'))) || '').includes('三個欄位都要選'), '沒填完就送出，應該提示三個欄位都要選');
    await noHScroll(page, '指控表單');
    if (!real) {
      await choose(page, { suspect: options.suspects[0].id, evidence: options.items[0].id, flaw: options.statements[0].id });
      await page.locator('#submit').click();
      await page.waitForFunction(() => !document.querySelector('#form-error').hidden && /判定資料/.test(document.querySelector('#form-error').textContent));
          console.log('  ✓ 沒有判定資料時會提示「判定資料尚未建立」');
    }
    await page.close();
  }
  if (!real) {
    await ctx.route('**/prologue/secrets.js', (route) => route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: js }));
  }

  // 用 node 窮舉找出各種結果的組合（不寫死正解）
  const runner = loadVerdict(ROOT, js);
  const { answer, problems } = await enumerate(runner, options);
  check(problems.length === 0, '判定資料結構有問題：' + problems.join('；'));
  const culprit = answer.culprit;
  const wrongEvidence = options.items.find((i) => !answer.accepted.includes(i.id)).id;
  const wrongFlaw = options.statements.find((s) => !answer.flaws.includes(s.id)).id;
  // 全對：每件可接受的證據 × 每句可接受的破綻，全部用真點擊跑一次
  const solvedChoices = answer.accepted.flatMap((e) => answer.flaws.map((f) => ({ suspect: culprit, evidence: e, flaw: f })));
  const scenarios = [
    ...solvedChoices.map((choice, i) => ({ name: `全對（第 ${i + 1} 組）`, choice })),
    { name: '兇手對、證據錯', choice: { suspect: culprit, evidence: wrongEvidence, flaw: answer.flaws[0] } },
    { name: '兇手對、破綻錯', choice: { suspect: culprit, evidence: answer.accepted[0], flaw: wrongFlaw } },
    ...options.suspects
      .filter((s) => s.id !== culprit)
      .map((s, i) => ({ name: `選錯人（第 ${i + 1} 位）`, choice: { suspect: s.id, evidence: answer.accepted[0], flaw: answer.flaws[0] } }))
  ];

  const page = await ctx.newPage();
  watch(page, '指控');
  let n = 0;
  const kinds = new Set();
  for (const sc of scenarios) {
    const expected = await runner.judge(sc.choice);
    await openForm(page, base);
    await choose(page, sc.choice);
    const got = await submitAndRead(page);
    const isSolved = expected.outcome === 'solved';
    kinds.add(isSolved ? 'solved' : expected.kind + ':' + sc.choice.suspect);
    check(got.solved === isSolved, `${sc.name}：破案動畫顯示與否不對`);
    check(got.title === (isSolved ? '真相' : '判定'), `${sc.name}：標題不對`);
    check(got.text === squash(expected.text), `${sc.name}：畫面上的${isSolved ? '真相' : '判定訊息'}和解密結果不一致`);
    if (isSolved) {
      check(!(await page.locator('#accuse-form').isVisible()), `${sc.name}：破案後表單應該收起`);
      if (real) check(await page.locator('#next-code').isVisible(), `${sc.name}：破案後要顯示第一章通行碼`);
      await page.waitForTimeout(2200);
      check(await page.locator('#home-link').isVisible(), `${sc.name}：破案後要有回到首頁`);
    } else {
      check(await page.locator('#retry').isVisible(), `${sc.name}：要有「重新指控」`);
    }
    await noHScroll(page, `指控・${sc.name}`);
    n += 1;
    const shotName = { '全對（第 1 組）': 'm-accuse-2-solved', '兇手對、證據錯': 'm-accuse-3-incomplete', '選錯人（第 1 位）': 'm-accuse-4-wrong' }[sc.name];
    if (shotName) await shot(page, shotName);
    if (sc.name === '兇手對、證據錯') {
      // 重新指控：回到表單，選擇保留
      await page.locator('#retry').click();
      check(await page.locator('#accuse-form').isVisible(), '按「重新指控」應該回到表單');
      check(await page.locator(`input[name="suspect"][value="${sc.choice.suspect}"]`).isChecked(), '重新指控時應該保留剛才的選擇');
    }
  }
  check(kinds.size === 5, `指控結果應該有五種（全對、兇手對理由不完整、三位選錯），實際 ${kinds.size} 種`);
  console.log(`  ✓ ${scenarios.length} 次真點擊指控：全對 ${solvedChoices.length} 組（${answer.accepted.length} 件證據 × ${answer.flaws.length} 句破綻）各一次、兇手對但證據錯、兇手對但破綻錯、選錯三位嫌疑人，畫面文字都和解密結果相同`);

  // 只用鍵盤完成一次指控
  {
    const wrong = options.suspects.find((s) => s.id !== culprit);
    const sIndex = options.suspects.indexOf(wrong);
    const eIndex = 4;
    const fIndex = 6;
    const choice = { suspect: wrong.id, evidence: options.items[eIndex].id, flaw: options.statements[fIndex].id };
    const expected = await runner.judge(choice);
    await page.goto(base + 'prologue/accuse.html');
    await page.locator('#gate-ready').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    for (let i = 0; i < sIndex; i += 1) await page.keyboard.press('ArrowRight');
    for (const index of [eIndex, fIndex]) {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      for (let i = 0; i < index; i += 1) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
    const picked = await page.evaluate(() => ['suspect', 'evidence', 'flaw'].map((n) => (document.querySelector(`input[name="${n}"]:checked`) || {}).value));
    check(JSON.stringify(picked) === JSON.stringify([choice.suspect, choice.evidence, choice.flaw]), `鍵盤操作選到的是 ${picked.join('／')}，預期 ${Object.values(choice).join('／')}`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.locator('#verdict').waitFor({ state: 'visible', timeout: 10000 });
    check(squash(await page.locator('#verdict-text').innerText()) === squash(expected.text), '鍵盤指控的判定訊息不對');
    console.log('  ✓ 只用鍵盤也能完成指控');
  }
  await page.close();

  // 區網 IP 這類 http 網址不是安全環境，要提示改用 Pages 網址
  {
    const p = await ctx.newPage();
    await p.goto(`http://lan.test:${port}/prologue/accuse.html`);
    check(await p.locator('#insecure-notice').isVisible(), '非安全環境（http 區網網址）應該提示改用 Pages 網址');
    check(await p.locator('#submit').isDisabled(), '非安全環境應該停用送出');
    await shot(p, 'm-accuse-insecure');
    await p.close();
    console.log('  ✓ 用 http 區網網址開啟時會提示改用 https 的 Pages 網址');
  }
  await ctx.close();
}

/* ---------- 新章節：兩支手機一路破關 ---------- */

// 序章：用 node 窮舉找出正解，再用真點擊破案，回傳結案畫面上的第一章通行碼
async function solvePrologue(page, base) {
  const runner = loadVerdict(ROOT, readFileSync(path.join(ROOT, 'prologue', 'secrets.js'), 'utf8'));
  const { answer } = await enumerate(runner, options);
  await openForm(page, base);
  await choose(page, { suspect: answer.culprit, evidence: answer.accepted[0], flaw: answer.flaws[0] });
  await page.locator('#submit').click();
  await page.locator('#next-code').waitFor({ state: 'visible', timeout: 10000 });
  return normalizeCode(await page.locator('#next-code .code-display').innerText());
}

// 把加密的現場資料攤平成 編號 → { 物品, 房間 }（含鎖裡的東西）
function indexItems(scenePayload, locks) {
  const map = new Map();
  const add = (items, room) => {
    for (const item of items || []) {
      map.set(item.no, { item, room });
      const opened = locks.find((l) => l.no === item.no);
      if (opened) add(opened.inner.items, room);
    }
  };
  for (const room of scenePayload.rooms) add(room.items, room.id);
  return map;
}

async function typeInto(page, locator, text) {
  await locator.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(String(text));
}

async function openCard(page, no) {
  const card = page.locator(`.item[data-item="${no}"]`).first();
  if (!(await card.evaluate((el) => el.open))) await card.locator(':scope > summary').click();
  return card;
}

async function playScene(page, base, entry, code) {
  const { data, payload } = await openRole(ROOT, entry.id, 'scene', code);
  const locks = await crackLocks(payload, data.salt);
  const items = indexItems(payload, locks);
  await page.goto(base + entry.id + '/scene.html');
  await page.locator('.room-tabs').waitFor();
  check(squash(await page.locator('.page-title').innerText()) === squash(entry.title), `${entry.id} 現場頁標題不對`);
  const activate = (room) => page.locator(`#tab-${room}`).click();

  // 先打一次錯的密碼，確認鎖不會開
  if (locks.length && locks[0].kind !== 'clock') {
    const first = locks[0];
    await activate(items.get(first.no).room);
    await openCard(page, first.no);
    const wrong = first.code === '1'.repeat(first.code.length) ? '2'.repeat(first.code.length) : '1'.repeat(first.code.length);
    await typeInto(page, page.locator(`.lock[data-no="${first.no}"] .lock-input`), first.kind === 'letters' ? wrong.replace(/\d/g, 'A') : wrong);
    await page.locator(`.lock[data-no="${first.no}"] .lock-submit`).click();
    await page.waitForFunction((no) => /沒有打開|沒有發生/.test(document.querySelector(`.lock[data-no="${no}"] .lock-message`).textContent), first.no);
    // 鎖的輸入框不能把卡片撐出窄螢幕
    await narrowNoHScroll(page, `${entry.id} 現場・打開的鎖`);
  }
  // 依序打開每一道鎖（密碼由 node 窮舉找出）
  for (const lock of locks) {
    await activate(items.get(lock.no).room);
    await openCard(page, lock.no);
    const form = page.locator(`.lock[data-no="${lock.no}"]`);
    if (lock.kind === 'clock') {
      const h = Number(lock.code.slice(0, 2));
      const m = Number(lock.code.slice(2));
      for (let i = 0; i < (h - 12 + 12) % 12; i += 1) await form.getByRole('button', { name: '時加1', exact: true }).click();
      for (let i = 0; i < Math.floor(m / 10); i += 1) await form.getByRole('button', { name: '分加10', exact: true }).click();
      for (let i = 0; i < m % 10; i += 1) await form.getByRole('button', { name: '分加1', exact: true }).click();
      check(squash(await form.locator('.clock-readout').innerText()) === squash(`${h} 點 ${String(m).padStart(2, '0')} 分`), `${entry.id} 時鐘鎖的指針沒有撥到正確位置`);
    } else {
      await typeInto(page, form.locator('.lock-input'), lock.kind === 'letters' ? lock.code.toLowerCase() : lock.code);
    }
    await form.locator('.lock-submit').click();
    await page.locator(`.item[data-item="${lock.no}"] .unlocked`).first().waitFor({ timeout: 10000 });
    check(squash(await page.locator(`.item[data-item="${lock.no}"] .unlocked > .item-desc`).first().innerText()) === squash(lock.inner.text), `${entry.id} 證物 ${lock.no} 打開後的內容不對`);
  }
  // 每件證物都點開核對描述，有「翻開」的也翻開
  for (const [no, { item, room }] of items) {
    await activate(room);
    const card = await openCard(page, no);
    check(squash(await card.locator(':scope > .item-body > .item-desc').innerText()) === squash(item.desc), `${entry.id} 證物 ${no} 的描述和資料不一致`);
    check(squash(await card.locator('.evidence-tag').first().innerText()) === `No.${String(no).padStart(2, '0')}`, `${entry.id} 證物 ${no} 的編號標籤不對`);
    if (item.reveal) {
      await card.locator(':scope > .item-body > .dig > summary').click();
      check((await visibleText(card.locator(':scope > .item-body > .dig .dig-result'))) === squash(item.reveal.text), `${entry.id} 證物 ${no} 翻開後的內容不對`);
    }
  }
  await noHScroll(page, `${entry.id} 現場`);
  await narrowNoHScroll(page, `${entry.id} 現場`);
  return { items, locks };
}

async function playInterrogation(page, base, entry, code) {
  const { data, payload } = await openRole(ROOT, entry.id, 'interrogation', code);
  const presents = await crackPresents(payload, data.salt);
  await page.goto(base + entry.id + '/interrogation.html');
  await page.locator('.suspects').waitFor();
  for (const p of payload.people) {
    const card = page.locator(`#person-${p.id}`);
    for (const line of p.lines) {
      check(squash(await card.locator(`.testimony-line[data-no="${line.no}"] .line-text`).first().innerText()) === squash(line.text), `${entry.id} ${p.name} 的口供 #${line.no} 不一致`);
    }
    const followups = card.locator(':scope > .follow-up');
    for (let i = 0; i < p.followups.length; i += 1) {
      await followups.nth(i).locator(':scope > summary').click();
      for (const line of p.followups[i].lines) {
        check((await visibleText(followups.nth(i).locator(`.testimony-line[data-no="${line.no}"] .line-text`))) === squash(line.text), `${entry.id} ${p.name} 的追問回答 #${line.no} 不一致`);
      }
    }
  }
  // 出示一件不相干的證物：要回應推託的話、扣一點信用
  const breakSet = new Set(presents.map((x) => `${x.person}:${x.evidence}`));
  const missPerson = payload.people[0];
  let missNo = 1;
  while (breakSet.has(`${missPerson.id}:${missNo}`)) missNo += 1;
  const before = await page.locator('.credibility .dot.is-on').count();
  await page.locator(`#person-${missPerson.id} .present > summary`).click();
  await typeInto(page, page.locator(`#person-${missPerson.id} .present-input`), missNo);
  await page.locator(`#person-${missPerson.id} .present-form button`).click();
  await page.locator(`#person-${missPerson.id} .present-feedback.is-miss`).waitFor();
  check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 出示錯的證物應該扣一點信用`);
  // 證人：出示證物不扣信用
  const witness = payload.people.find((p) => p.kind === 'witness');
  if (witness) {
    let wNo = 1;
    while (breakSet.has(`${witness.id}:${wNo}`)) wNo += 1;
    const wCard = page.locator(`#person-${witness.id}`);
    await wCard.locator('.present > summary').click();
    await typeInto(page, wCard.locator('.present-input'), wNo);
    await wCard.locator('.present-form button').click();
    await wCard.locator('.present-feedback.is-miss').waitFor();
    check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 給證人看證物不該扣信用`);
  }
  // 有前置條件的改口：還沒逼出前一段就先出示，看起來就跟一般的反應一樣，不扣信用
  const early = presents.find((x) => (x.content.requires || []).length);
  if (early) {
    const card = page.locator(`#person-${early.person}`);
    const details = card.locator('.present');
    if (!(await details.evaluate((el) => el.open))) await details.locator(':scope > summary').click();
    await typeInto(page, card.locator('.present-input'), early.evidence);
    await card.locator('.present-form button').click();
    const note = card.locator(`section.react-note[data-early][data-evidence~="${early.evidence}"]`);
    await note.waitFor({ timeout: 10000 });
    const firstMissing = early.content.requires[0];
    const hint = (early.content.earlyBy && early.content.earlyBy[firstMissing]) || early.content.early;
    check(squash(await note.locator('.react-say').innerText()) === squash(hint.say), `${entry.id} 前置條件沒達成時的反應不對`);
    if (hint.observe) check(squash(await note.locator('.reaction').innerText()) === squash(hint.observe), `${entry.id} 前置條件沒達成時的觀察不對`);
    check(squash(await card.locator('.present-feedback').innerText()).includes('反應記在上面了'), `${entry.id} 前置條件沒達成時，回饋要跟一般反應一樣`);
    check((await card.locator(`section.break[data-evidence~="${early.evidence}"]`).count()) === 0, `${entry.id} 前置條件沒達成時不該顯示改口`);
    check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 前置條件沒達成時不該扣信用`);
    check((await card.locator(`[data-log-for="${early.person}"]`).textContent()).includes('No.' + String(early.evidence).padStart(2, '0') + ' 有反應'), `${entry.id} 前置條件沒達成時，出示紀錄要寫「有反應」`);
    // 重新整理後，這則反應還在
    await page.reload();
    await page.locator('.suspects').waitFor();
    await card.locator(`section.react-note[data-early][data-evidence~="${early.evidence}"]`).waitFor({ state: 'attached', timeout: 10000 });
  }
  // 出示對的證物（組合由 node 窮舉找出）：依前置條件的順序，對方要改口或有反應
  const pending = [...presents];
  const revealedIds = new Set();
  const seenBreaks = new Set();
  const seenReacts = new Set();
  while (pending.length) {
    // 認罪之後對方就不再給反應，所以認罪那一段排到最後
    const ready = (x) => (x.content.requires || []).every((id) => revealedIds.has(id));
    let index = pending.findIndex((x) => ready(x) && !x.content.final);
    if (index === -1) index = pending.findIndex(ready);
    check(index !== -1, `${entry.id} 有改口的前置條件永遠達不成`);
    if (index === -1) break;
    const x = pending.splice(index, 1)[0];
    const card = page.locator(`#person-${x.person}`);
    const details = card.locator('.present');
    if (!(await details.evaluate((el) => el.open))) await details.locator(':scope > summary').click();
    await typeInto(page, card.locator('.present-input'), x.evidence);
    await card.locator('.present-form button').click();
    const section = card.locator(`[data-breaks-for="${x.person}"] > section:not([data-early])[data-evidence~="${x.evidence}"]`);
    await section.waitFor({ timeout: 10000 });
    check((await card.locator(`section.react-note[data-early][data-evidence~="${x.evidence}"]`).count()) === 0, `${entry.id} 真的改口或有反應之後，先前那則還沒到時候的反應要拿掉`);
    const key = `${x.person}:${x.content.id}`;
    if (x.content.react) {
      check(squash(await section.locator('.react-say').innerText()) === squash(x.content.say), `${entry.id} 出示 No.${x.evidence} 給 ${x.person} 的反應不一致`);
      seenReacts.add(key);
    } else {
      if (seenBreaks.has(key)) {
        // 另一件證物觸發同一段改口：只顯示一次，回饋說明和先前那件一樣
        await card.locator('.present-feedback').filter({ hasText: '一樣' }).waitFor();
        check((await card.locator(`[data-break="${x.content.id}"]`).count()) === 1, `${entry.id} 同一段改口被顯示了兩次（${x.person}）`);
        check((await section.locator('.break-cause').innerText()).includes('No.' + String(x.evidence).padStart(2, '0')), `${entry.id} 改口的觸發證物沒有列出 No.${x.evidence}`);
      }
      seenBreaks.add(key);
      for (const line of x.content.lines) {
        check(squash(await section.locator(`.testimony-line[data-no="${line.no}"] .line-text`).innerText()) === squash(line.text), `${entry.id} 出示 No.${x.evidence} 給 ${x.person} 後的口供不一致`);
      }
    }
    revealedIds.add(x.content.id);
  }
  check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 出示對的證物不該扣信用`);
  check((await page.locator('section.react-note[data-early]').count()) === 0, `${entry.id} 全部逼出來之後，不該還留著還沒到時候的反應`);
  // 有反應的證物再出示一次：回應和第一次一樣（跟還沒到時候的反應分不出來），不扣信用
  const finals = new Set(presents.filter((x) => x.content.final).map((x) => x.person));
  const again = presents.find((x) => x.content.react && !finals.has(x.person));
  if (again) {
    const card = page.locator(`#person-${again.person}`);
    const details = card.locator('.present');
    if (!(await details.evaluate((el) => el.open))) await details.locator(':scope > summary').click();
    await typeInto(page, card.locator('.present-input'), again.evidence);
    await card.locator('.present-form button').click();
    await card.locator('.present-feedback').filter({ hasText: '反應記在上面了' }).waitFor({ timeout: 10000 });
    check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 有反應的證物再出示一次不該扣信用`);
  }
  // 認罪之後：再出示別的證物，只會說已經全部招了，不扣信用
  const confessor = presents.find((x) => x.content.final);
  if (confessor) {
    let cNo = 1;
    while (breakSet.has(`${confessor.person}:${cNo}`)) cNo += 1;
    const cCard = page.locator(`#person-${confessor.person}`);
    const cDetails = cCard.locator('.present');
    if (!(await cDetails.evaluate((el) => el.open))) await cDetails.locator(':scope > summary').click();
    await typeInto(page, cCard.locator('.present-input'), cNo);
    await cCard.locator('.present-form button').click();
    await cCard.locator('.present-feedback.is-early').filter({ hasText: '都已經說了' }).waitFor({ timeout: 10000 });
    check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 認罪之後再出示不該扣信用`);
  }
  check((await page.locator('section.break').count()) === seenBreaks.size, `${entry.id} 改口段數應該是 ${seenBreaks.size}`);
  check((await page.locator('section.react-note').count()) === seenReacts.size, `${entry.id} 反應段數應該是 ${seenReacts.size}`);
  const missLog = await page.locator(`[data-log-for="${missPerson.id}"]`).textContent();
  check(missLog.includes('No.' + String(missNo).padStart(2, '0') + ' 沒鬆口'), `${entry.id} 出示紀錄要記下沒能讓對方鬆口的那一件`);
  // 重新整理後，已經改口的內容要還在，而且不重複
  await page.reload();
  await page.locator('.suspects').waitFor();
  if (seenBreaks.size) await page.locator('section.break').nth(seenBreaks.size - 1).waitFor({ state: 'attached', timeout: 10000 });
  if (seenReacts.size) await page.locator('section.react-note').nth(seenReacts.size - 1).waitFor({ state: 'attached', timeout: 10000 });
  check((await page.locator('section.break').count()) === seenBreaks.size, `${entry.id} 重新整理後改口段數不對`);
  check((await page.locator('section.react-note').count()) === seenReacts.size, `${entry.id} 重新整理後反應段數不對`);
  check((await page.locator('.credibility .dot.is-on').count()) === before - 1, `${entry.id} 重新整理後信用不對`);
  await noHScroll(page, `${entry.id} 偵訊`);
  await narrowNoHScroll(page, `${entry.id} 偵訊`);
  return { payload, presents };
}

async function fillAccuse(page, accuse, values) {
  for (const f of accuse.fields) {
    const box = page.locator(`.field[data-field="${f.id}"]`);
    const v = values[f.id];
    if (f.type === 'person') await box.locator(`.suspect-option:has(input[value="${v}"])`).click();
    else if (f.type === 'choice') await box.locator(`.choice:has(input[value="${v}"])`).click();
    else await typeInto(page, box.locator('.number-input'), v);
  }
  await page.locator('.accuse-form button[type=submit]').click();
  await page.locator('.verdict').waitFor({ state: 'visible', timeout: 10000 });
  return squash(await page.locator('.verdict-card').innerText());
}

async function playAccuse(page, base, entry, code) {
  const { data, payload } = await openRole(ROOT, entry.id, 'accuse', code);
  const { solved } = crackAccuse(payload, data.salt);
  check(solved.length > 0, `${entry.id} 窮舉找不到能破案的組合`);
  const fields = payload.fields;
  const wrongValue = (f) => fieldSpace(payload, f).find((v) => !solved.some((s) => s[f.id] === v));
  await page.goto(base + entry.id + '/accuse.html');
  await page.locator('.gate button').click();
  const scenarios = [];
  // 選錯人：每一位非兇手各一次
  for (const pid of fields[0].people.filter((p) => !solved.some((s) => s[fields[0].id] === p))) {
    scenarios.push({ name: `選錯人 ${pid}`, values: { ...solved[0], [fields[0].id]: pid } });
  }
  // 兇手對、只錯一處（要提示「只差一處」）、錯兩處
  const others = fields.slice(1).filter((f) => wrongValue(f) !== undefined);
  if (others.length) scenarios.push({ name: '只錯一處', values: { ...solved[0], [others[0].id]: wrongValue(others[0]) } });
  if (others.length > 1) scenarios.push({ name: '錯兩處', values: { ...solved[0], [others[0].id]: wrongValue(others[0]), [others[1].id]: wrongValue(others[1]) } });
  for (const sc of scenarios) {
    const expected = await judgeAccuse(payload, data.salt, sc.values);
    const text = await fillAccuse(page, payload, sc.values);
    check(text.includes(squash(expected.message)), `${entry.id} ${sc.name}：判定訊息和解密結果不一致`);
    check(text.includes('只差一處') === Boolean(expected.near), `${entry.id} ${sc.name}：「只差一處」提示不對`);
    await page.locator('.verdict button').click();
  }
  const expected = await judgeAccuse(payload, data.salt, solved[0]);
  const text = await fillAccuse(page, payload, solved[0]);
  check(text.includes('破案') && text.includes(squash(expected.t[0])), `${entry.id} 全對時要破案並顯示真相`);
  if (expected.epilogue) check(text.includes(squash(expected.epilogue[0])), `${entry.id} 終章要有尾聲`);
  await page.waitForTimeout(2200);
  await noHScroll(page, `${entry.id} 結案`);
  await narrowNoHScroll(page, `${entry.id} 結案`);
  return expected.next ? normalizeCode(await page.locator('.next-code .code-display').innerText()) : null;
}

async function testCampaign(browser, ctxOptions, base) {
  step('新章節：兩支手機從序章一路破到終章');
  const manifest = readManifest(ROOT);
  const ctxA = await browser.newContext(ctxOptions);
  const ctxB = await browser.newContext(ctxOptions);
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  watch(A, '手機A');
  watch(B, '手機B');

  await B.goto(base);
  await shot(B, 'm-menu-locked');
  const firstLocked = manifest.chapters.find((c) => !c.open);
  const lockedCard = B.locator(`[data-chapter="${firstLocked.id}"]`);
  await typeInto(B, lockedCard.locator('.code-input'), 'ABC123');
  await lockedCard.locator('button[type=submit]').click();
  await lockedCard.locator('.form-error').waitFor({ state: 'visible' });
  check((await lockedCard.locator('.form-error').innerText()).includes('不對'), '輸入錯的通行碼要提示不對');
  await noHScroll(B, '章節選單');
  await narrowNoHScroll(B, '章節選單');

  let code = await solvePrologue(A, base);
  check(code && code.length === 6, '序章破案後要拿到第一章通行碼');
  const firstCode = code;
  for (const entry of manifest.chapters.filter((c) => !c.open)) {
    // 偵訊官的手機：在章節選單輸入通行碼（小寫加連字號也要能用）
    await B.goto(base);
    const card = B.locator(`[data-chapter="${entry.id}"]`);
    await typeInto(B, card.locator('.code-input'), code.toLowerCase().slice(0, 3) + '-' + code.toLowerCase().slice(3));
    await card.locator('button[type=submit]').click();
    await card.locator('a.btn').waitFor({ timeout: 10000 });
    // 破案的那支手機：章節選單上已經自動解鎖
    await A.goto(base);
    await A.locator(`[data-chapter="${entry.id}"] a.btn`).waitFor({ timeout: 10000 });
    await A.locator(`[data-chapter="${entry.id}"] a.btn`).click();
    await A.waitForURL(new RegExp(`${entry.id}/$`));
    await A.locator('.chapter-title').waitFor();
    check(squash(await A.locator('.chapter-title').innerText()) === squash(entry.title), `${entry.id} 簡報頁標題不對`);
    await noHScroll(A, `${entry.id} 簡報`);
    await narrowNoHScroll(A, `${entry.id} 簡報`);
    await shot(A, `m-${entry.id}-1-brief`);

    await playScene(A, base, entry, code);
    await shot(A, `m-${entry.id}-2-scene`);
    const { payload: inter, presents } = await playInterrogation(B, base, entry, code);
    await shot(B, `m-${entry.id}-3-interrogation`);

    // 角色隔離：現場手機看不到任何一句口供，偵訊手機看不到任何物品描述
    const sceneText = squash(await A.locator('body').innerText());
    const lines = [
      ...inter.people.flatMap((p) => [...p.lines, ...p.followups.flatMap((f) => f.lines)]),
      ...presents.flatMap((x) => x.content.lines || []),
      ...presents.filter((x) => x.content.react).map((x) => ({ text: x.content.say }))
    ];
    check(!lines.some((l) => sceneText.includes(squash(l.text))), `${entry.id} 現場頁出現了口供`);
    const { data: sd, payload: sp } = await openRole(ROOT, entry.id, 'scene', code);
    const allItems = indexItems(sp, await crackLocks(sp, sd.salt));
    const interText = squash(await B.locator('body').innerText());
    check(![...allItems.values()].some(({ item }) => interText.includes(squash(item.desc))), `${entry.id} 偵訊頁出現了物品描述`);

    const next = await playAccuse(A, base, entry, code);
    await shot(A, `m-${entry.id}-4-solved`);
    const reacts = presents.filter((x) => x.content.react).length;
    console.log(`  ✓ ${entry.label}《${entry.title}》：通行碼解鎖、所有鎖與證物、${presents.length - reacts} 次改口${reacts ? `、${reacts} 次反應` : ''}、四種判定與破案都用真點擊跑過`);
    code = next;
  }
  check(code === null, '終章破案後不該再有下一章通行碼');
  await A.goto(base);
  check((await A.locator('.chapter-card.is-solved').count()) === manifest.chapters.length, '全部破案後，章節選單上每一章都要標成「結案」');
  check(await A.locator('#series-complete').isVisible(), '全部破案後，選單要出現「全卷結案」總結卡');
  check((await A.locator('.chapter-card .chapter-score').count()) === manifest.chapters.filter((c) => !c.open).length, '新章節結案後，選單卡片上要有評等星星');
  await B.goto(base);
  await B.locator('.chapter-card').first().waitFor();
  check((await B.locator('#series-complete').count()) === 0, '另一支手機沒有破案紀錄，不該出現總結卡');
  await noHScroll(A, '全部結案的選單');
  await narrowNoHScroll(A, '全部結案的選單');
  await shot(A, 'm-menu-complete');
  await ctxA.close();
  await ctxB.close();
  return firstCode;
}

/* ---------- 桌機抽查 ---------- */

async function testDesktop(browser, base, firstCode = null) {
  step('桌機 1280 寬抽查');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-TW' });
  for (const name of ['index', 'scene', 'interrogation', 'accuse']) {
    const page = await ctx.newPage();
    watch(page, `桌機・${name}`);
    await page.goto(base + 'prologue/' + name + '.html');
    if (name === 'scene') await page.locator('.item[data-item] > summary').first().click();
    if (name === 'interrogation') await page.locator('.follow-up > summary').first().click();
    if (name === 'accuse') {
      await page.locator('#gate-ready').click();
      await page.locator('.dropdown[data-field="flaw"] > summary').click();
    }
    await noHScroll(page, `桌機・${name}`);
    await shot(page, `d-${name}`);
    await page.close();
  }
  console.log('  ✓ 四頁在桌機寬度正常、沒有水平捲動');
  // 章節選單與第一章：在桌機的選單輸入通行碼解鎖，再看四頁
  const page = await ctx.newPage();
  watch(page, '桌機・章節');
  await page.goto(base);
  await noHScroll(page, '桌機・章節選單');
  await shot(page, 'd-menu');
  if (firstCode) {
    const entry = readManifest(ROOT).chapters.find((c) => !c.open);
    const card = page.locator(`[data-chapter="${entry.id}"]`);
    await typeInto(page, card.locator('.code-input'), firstCode);
    await card.locator('button[type=submit]').click();
    await card.locator('a.btn').click();
    await page.locator('.chapter-title').waitFor();
    await noHScroll(page, `桌機・${entry.id} 簡報`);
    await shot(page, `d-${entry.id}-brief`);
    await page.goto(base + entry.id + '/scene.html');
    await page.locator('.item > summary').first().click();
    await noHScroll(page, `桌機・${entry.id} 現場`);
    await shot(page, `d-${entry.id}-scene`);
    await page.goto(base + entry.id + '/interrogation.html');
    await page.locator('.present > summary').first().click();
    await noHScroll(page, `桌機・${entry.id} 偵訊`);
    await shot(page, `d-${entry.id}-interrogation`);
    await page.goto(base + entry.id + '/accuse.html');
    await page.locator('.gate button').click();
    await noHScroll(page, `桌機・${entry.id} 指控`);
    await shot(page, `d-${entry.id}-accuse`);
    console.log(`  ✓ 章節選單與${entry.label}四頁在桌機寬度正常、沒有水平捲動`);
  } else {
    console.log('  ✓ 章節選單在桌機寬度正常、沒有水平捲動');
  }
  await page.close();
  await ctx.close();
}

/* ---------- 執行 ---------- */

const server = await startServer({ root: ROOT });
const base = `http://127.0.0.1:${server.port}/`;
const browser = await launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-TW' };
try {
  const ctx = await browser.newContext(mobile);
  await testIndex(ctx, base);
  await testScene(ctx, base);
  await testInterrogation(ctx, base);
  await ctx.close();
  await testAccuse(browser, mobile, base, server.port);
  let firstCode = null;
  if (HAS_SECRETS && readManifest(ROOT)) firstCode = await testCampaign(browser, mobile, base);
  else console.log('\n⚠ 沒有序章判定資料或章節資料，略過新章節的一路破關測試');
  await testDesktop(browser, base, firstCode);
} catch (err) {
  failures.push('執行中斷：' + (err && err.stack ? err.stack : err));
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n截圖：${path.relative(ROOT, OUT)}/`);
if (failures.length) {
  console.log(`✗ e2e 失敗 ${failures.length} 項：`);
  for (const f of failures) console.log('  - ' + f.split('\n')[0]);
  if (failures.some((f) => f.startsWith('執行中斷'))) console.log(failures.find((f) => f.startsWith('執行中斷')));
  process.exit(1);
}
console.log(`✓ e2e 全部通過（${passed} 項斷言）`);
