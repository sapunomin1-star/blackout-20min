// 產生與驗證判定資料（js/secrets.js）。
// 這裡處理的機密原文只在記憶體裡；任何輸出都不能印出原文或正解。
import { webcrypto, randomBytes, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { accuseOptions } from './site.mjs';

const NS = 'blackout20';
const subtle = webcrypto.subtle;
const enc = new TextEncoder();

const hex = (buf) => Buffer.from(buf).toString('hex');
const material = (label, salt, parts) => [NS, label, salt, ...parts].join('|');
const sha = async (text) => new Uint8Array(await subtle.digest('SHA-256', enc.encode(text)));

async function seal(label, salt, parts, plaintext) {
  const raw = await sha(material(label, salt, parts));
  const key = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = randomBytes(12);
  const c = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { iv: hex(iv), c: hex(c) };
}

/* ---------- 讀 secrets.local.json ---------- */

function resolver(options) {
  const strip = (s) => String(s).trim().replace(/^「/, '').replace(/」$/, '');
  const find = (kind, list, value, keys) => {
    const v = strip(value);
    const hits = list.filter((o) => o.id === v || keys(o).some((k) => k === v));
    if (hits.length !== 1) {
      throw new Error(`${kind}「${value}」${hits.length ? '對到不只一個選項' : '對不到任何選項'}；可用 npm run ids 查 ID`);
    }
    return hits[0].id;
  };
  return {
    suspect: (v) => find('嫌疑人', options.suspects, v, (o) => [o.name, o.role + o.name, `${o.name}（${o.role}）`]),
    item: (v) => find('現場物品', options.items, v, (o) => [o.text, `${o.group}・${o.text}`, `${o.group}${o.text}`, `${o.group}的${o.text}`]),
    statement: (v) => find('口供句', options.statements, v, (o) => [o.text])
  };
}

const nonEmpty = (v, what) => {
  const text = Array.isArray(v) ? v.join('\n\n') : v;
  if (typeof text !== 'string' || !text.trim() || /^<.*>$/.test(text.trim())) throw new Error(`${what}是空的或還是佔位字`);
  return text.trim();
};

// 把使用者整理的 JSON 轉成統一格式：{ culprit, accepted[], flaw, messages{嫌疑人ID: 訊息}, truth }
export function normalizeInput(raw, options) {
  const r = resolver(options);
  const culprit = r.suspect(raw.culprit);
  const accepted = [...new Set((raw.acceptedEvidence || []).map(r.item))];
  if (!accepted.length) throw new Error('acceptedEvidence 至少要有一件物品');
  const flaw = r.statement(raw.flaw);
  const messages = { [culprit]: nonEmpty(raw.messages && raw.messages.culpritIncomplete, '「兇手對、理由不完整」訊息') };
  for (const w of (raw.messages && raw.messages.wrongSuspect) || []) {
    const id = r.suspect(w.suspect);
    if (id === culprit) throw new Error('wrongSuspect 不能包含兇手');
    if (messages[id]) throw new Error('wrongSuspect 有重複的嫌疑人');
    messages[id] = nonEmpty(w.message, '選錯嫌疑人的訊息');
  }
  const missing = options.suspects.filter((s) => !messages[s.id]);
  if (missing.length) throw new Error(`還缺 ${missing.length} 位嫌疑人的判定訊息`);
  const truth = nonEmpty(raw.truth, '真相解說');
  for (const id of [...options.suspects.map((s) => s.id), ...options.items.map((i) => i.id), ...options.statements.map((s) => s.id)]) {
    if (id.includes('|')) throw new Error(`選項 ID 不能有「|」：${id}`);
  }
  return { culprit, accepted, flaw, messages, truth };
}

/* ---------- 產生 js/secrets.js ---------- */

export async function buildData(norm, options) {
  const salt = hex(randomBytes(16));
  const payloads = options.suspects.map((s) => ({
    id: s.id,
    json: JSON.stringify({ k: s.id === norm.culprit ? 'culprit' : 'wrong', m: norm.messages[s.id] })
  }));
  // 四筆補成同樣的位元組長度，密文長度就看不出差別
  const longest = Math.max(...payloads.map((p) => enc.encode(p.json).length));
  const size = Math.ceil((longest + 16) / 64) * 64;
  const suspects = [];
  for (const p of payloads) {
    const padded = p.json + ' '.repeat(size - enc.encode(p.json).length);
    const box = await seal('key', salt, [p.id], padded);
    suspects.push({ i: hex(await sha(material('idx', salt, [p.id]))), ...box });
  }
  suspects.sort((a, b) => (a.i < b.i ? -1 : 1));
  const solved = [];
  for (const e of norm.accepted) solved.push(hex(await sha(material('full', salt, [norm.culprit, e, norm.flaw]))));
  solved.sort();
  const truth = await seal('truth', salt, [norm.culprit, norm.flaw], JSON.stringify({ t: norm.truth }));
  return { v: 1, salt, suspects, solved, truth };
}

export function renderSecretsJs(data) {
  return (
    '/* 由 tools/build-secrets.mjs 產生，不要手改。只有鹽、雜湊與密文，沒有任何原文。 */\n' +
    'window.BLACKOUT_SECRETS = ' +
    JSON.stringify(data, null, 1) +
    ';\n'
  );
}

/* ---------- 用 js/verdict.js 在 node 裡判定 ---------- */

export function loadVerdict(root, secretsJs) {
  const context = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder, console });
  context.window = context;
  vm.runInContext(readFileSync(path.join(root, 'js', 'verdict.js'), 'utf8'), context, { filename: 'verdict.js' });
  vm.runInContext(secretsJs, context, { filename: 'secrets.js' });
  const data = context.BLACKOUT_SECRETS;
  if (!data) throw new Error('secrets.js 沒有設定 window.BLACKOUT_SECRETS');
  return {
    data: JSON.parse(JSON.stringify(data)),
    judge: (choice) => context.BlackoutVerdict.judge(data, choice).then((r) => JSON.parse(JSON.stringify(r)))
  };
}

// 窮舉 嫌疑人×證據×破綻，整理出判定結構；回傳的 answer 只能在記憶體裡用
export async function enumerate(runner, options) {
  const problems = [];
  const all = [];
  for (const s of options.suspects) {
    for (const e of options.items) {
      for (const f of options.statements) {
        const r = await runner.judge({ suspect: s.id, evidence: e.id, flaw: f.id });
        all.push({ suspect: s.id, evidence: e.id, flaw: f.id, ...r });
      }
    }
  }
  const solved = all.filter((r) => r.outcome === 'solved');
  const answer = { culprit: null, accepted: [], flaw: null, messages: {}, truth: null };
  if (!solved.length) problems.push('沒有任何組合能破案');
  const culprits = new Set(solved.map((r) => r.suspect));
  const flaws = new Set(solved.map((r) => r.flaw));
  const truths = new Set(solved.map((r) => r.text));
  if (culprits.size > 1) problems.push('能破案的組合指向不只一位嫌疑人');
  if (flaws.size > 1) problems.push('能破案的組合用了不只一句破綻');
  if (truths.size > 1) problems.push('不同的全對組合解出不同的真相');
  if (solved.length) {
    answer.culprit = solved[0].suspect;
    answer.flaw = solved[0].flaw;
    answer.truth = solved[0].text;
    answer.accepted = [...new Set(solved.map((r) => r.evidence))].sort();
    if (answer.accepted.length !== solved.length) problems.push('同一件證據出現重複的全對組合');
  }
  for (const s of options.suspects) {
    const rest = all.filter((r) => r.suspect === s.id && r.outcome !== 'solved');
    const texts = new Set(rest.map((r) => r.text));
    const kinds = new Set(rest.map((r) => r.kind));
    const expectKind = s.id === answer.culprit ? 'culprit' : 'wrong';
    if (texts.size !== 1) problems.push('有嫌疑人的判定訊息會隨證據或破綻改變');
    if (kinds.size !== 1 || !kinds.has(expectKind)) problems.push('有嫌疑人的判定種類不對（應該剛好一人走兇手路徑）');
    answer.messages[s.id] = rest.length ? rest[0].text : null;
  }
  const kindsCulprit = options.suspects.filter((s) => all.some((r) => r.suspect === s.id && r.kind === 'culprit'));
  if (kindsCulprit.length !== 1) problems.push(`走兇手路徑的嫌疑人有 ${kindsCulprit.length} 位，應該剛好 1 位`);
  return { total: all.length, solvedCount: solved.length, answer, problems: [...new Set(problems)] };
}

// 窮舉結果和 secrets.local.json 逐字比對；回傳不符合的項目（只描述欄位，不印原文）
export function compareWithInput(answer, norm) {
  const diffs = [];
  if (answer.culprit !== norm.culprit) diffs.push('兇手');
  if (answer.flaw !== norm.flaw) diffs.push('口供破綻');
  if ([...norm.accepted].sort().join() !== answer.accepted.join()) diffs.push('可接受的現場證據');
  for (const id of Object.keys(norm.messages)) if (answer.messages[id] !== norm.messages[id]) diffs.push(`判定訊息（${id}）`);
  if (answer.truth !== norm.truth) diffs.push('真相解說');
  return diffs;
}

/* ---------- 測試用假資料 ---------- */

// 每次隨機挑兇手、證據、破綻與訊息，只用來測試判定機制，絕不代表真正的答案
export function syntheticInput(options) {
  const pick = (list) => list[randomInt(list.length)];
  const tag = () => randomBytes(4).toString('hex');
  const culprit = pick(options.suspects);
  const items = [...options.items];
  const accepted = [];
  while (accepted.length < 3) accepted.push(items.splice(randomInt(items.length), 1)[0].id);
  return {
    culprit: culprit.id,
    acceptedEvidence: accepted,
    flaw: pick(options.statements).id,
    messages: {
      culpritIncomplete: `［假訊息甲${tag()}］${tag()}`,
      wrongSuspect: options.suspects
        .filter((s) => s.id !== culprit.id)
        .map((s, i) => ({ suspect: s.id, message: `［假訊息${'乙丙丁'[i]}${tag()}］${tag()}` }))
    },
    truth: [`［假真相一${tag()}］${tag()}`, `［假真相二${tag()}］${tag()}`]
  };
}

export async function buildSynthetic(root) {
  const options = accuseOptions(root);
  const norm = normalizeInput(syntheticInput(options), options);
  const js = renderSecretsJs(await buildData(norm, options));
  return { options, norm, js };
}
