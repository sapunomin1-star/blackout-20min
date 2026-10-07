// npm run e2e：用 playwright-core 開真的瀏覽器，用真點擊與鍵盤跑完四頁。
//   手機直式 390×844：每件物品、每段口供逐字核對；指控的五種結果都跑到；每頁沒有水平捲動。
//   桌機 1280 寬抽查。截圖存在 output/e2e/（gitignored）。
// 玩家操作只用 click／鍵盤；page.evaluate 只拿來讀狀態。
// 正解不寫死：先用 node 窮舉 js/verdict.js 找出各種結果的組合，再用真點擊去選。
// 還沒有 js/secrets.js 時，改用每次隨機產生的假判定資料（攔截 js/secrets.js 的請求）測判定流程。
// 瀏覽器：E2E_EXECUTABLE=/path/to/chromium；沒設時依序試 /opt/pw-browsers/chromium、playwright 內建、本機 Chrome。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from '../tools/serve.mjs';
import { loadSpec } from '../tools/lib/spec.mjs';
import { accuseOptions } from '../tools/lib/site.mjs';
import { buildSynthetic, loadVerdict, enumerate } from '../tools/lib/secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output', 'e2e');
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) if (name.endsWith('.png')) rmSync(path.join(OUT, name));

const spec = loadSpec(ROOT);
const HAS_SECRETS = existsSync(path.join(ROOT, 'js', 'secrets.js'));
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

// 還沒產生判定資料時，任何頁面連到指控頁都會有 js/secrets.js 的 404，這是預期的
function watch(page, label, { allow404 = HAS_SECRETS ? [] : ['/js/secrets.js'] } = {}) {
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
  await page.goto(base + 'index.html');
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
  await page.goto(base + 'scene.html');
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
  await page.goto(base + 'interrogation.html');
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
  await page.goto(base + 'accuse.html');
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
  const realPath = path.join(ROOT, 'js', 'secrets.js');
  const real = existsSync(realPath);
  let js;
  if (real) {
    js = readFileSync(realPath, 'utf8');
    console.log('  使用真的判定資料 js/secrets.js');
  } else {
    js = (await buildSynthetic(ROOT)).js;
    writeFileSync(path.join(OUT, 'secrets.synthetic.js'), js);
    console.log('  ⚠ 還沒有 js/secrets.js：先確認頁面會提示，再用隨機假資料測判定流程');
  }

  const ctx = await browser.newContext(ctxOptions);
  {
    const page = await ctx.newPage();
    watch(page, '指控（無資料）');
    await page.goto(base + 'accuse.html');
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
    await ctx.route('**/js/secrets.js', (route) => route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: js }));
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
    await page.goto(base + 'accuse.html');
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
    await p.goto(`http://lan.test:${port}/accuse.html`);
    check(await p.locator('#insecure-notice').isVisible(), '非安全環境（http 區網網址）應該提示改用 Pages 網址');
    check(await p.locator('#submit').isDisabled(), '非安全環境應該停用送出');
    await shot(p, 'm-accuse-insecure');
    await p.close();
    console.log('  ✓ 用 http 區網網址開啟時會提示改用 https 的 Pages 網址');
  }
  await ctx.close();
}

/* ---------- 桌機抽查 ---------- */

async function testDesktop(browser, base) {
  step('桌機 1280 寬抽查');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-TW' });
  for (const name of ['index', 'scene', 'interrogation', 'accuse']) {
    const page = await ctx.newPage();
    watch(page, `桌機・${name}`);
    await page.goto(base + name + '.html');
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
  await testDesktop(browser, base);
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
