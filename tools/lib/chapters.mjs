// 新章節的原始內容 → 加密資料檔。原始內容只放在 gitignored 的 tools/chapters.local/，
// 進 repo 的只有密文。這支程式的輸出絕不印出原文或答案。
//
// 金鑰推導與 js/case.js 一致：SHA-256('blackout20|' + parts.join('|'))
import { createHash, webcrypto, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const NS = 'blackout20';
const subtle = webcrypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const SOURCE_DIR = 'tools/chapters.local';
export const ROLES = ['brief', 'scene', 'interrogation', 'accuse'];
export const SERIES = {
  title: '懷錶檔案',
  subtitle: '雙人合作推理・序章與三個案件'
};
export const PROLOGUE_ENTRY = {
  id: 'prologue',
  label: '序章',
  title: '停電的二十分鐘',
  teaser: '雨夜跳電的二十分鐘裡，書房抽屜裡的古董懷錶不見了。',
  href: 'prologue/',
  open: true
};

export const material = (parts) => [NS, ...parts].join('|');
export const sha = (parts) => createHash('sha256').update(material(parts), 'utf8').digest();
export const shaHex = (parts) => sha(parts).toString('hex');
const hex = (buf) => Buffer.from(buf).toString('hex');

export function normalizeCode(text) {
  return String(text ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function normalizeLock(kind, value) {
  const v = String(value ?? '').trim();
  if (kind === 'digits') return v.replace(/\D/g, '');
  if (kind === 'letters') return v.toUpperCase().replace(/[^A-Z]/g, '');
  if (kind === 'clock') {
    const m = v.match(/^(\d{1,2})\D*(\d{2})$/);
    return m ? m[1].padStart(2, '0') + m[2] : '';
  }
  return v;
}

export async function seal(parts, value) {
  const key = await subtle.importKey('raw', sha(parts), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = randomBytes(12);
  const c = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(typeof value === 'string' ? value : JSON.stringify(value)));
  return { iv: hex(iv), c: hex(c) };
}

export async function unseal(parts, box) {
  const key = await subtle.importKey('raw', sha(parts), { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(box.iv, 'hex') }, key, Buffer.from(box.c, 'hex'));
  return JSON.parse(dec.decode(plain));
}

/* ---------- 讀原始內容並檢查 ---------- */

export function loadSources(root) {
  const dir = path.join(root, SOURCE_DIR);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /^ch\d+\.json$/.test(f));
  if (!files.length) return null;
  const chapters = files.map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
  chapters.sort((a, b) => a.order - b.order);
  return chapters;
}

// 走訪所有物品（含鎖住、藏起來的）
export function allItems(chapter) {
  const out = [];
  const walk = (items, room, parent) => {
    for (const item of items || []) {
      out.push({ ...item, room, parent });
      if (item.lock) walk(item.lock.items, room, item.no);
    }
  };
  for (const room of chapter.scene.rooms) walk(room.items, room.id, null);
  return out;
}

// 還沒到時候的反應：{ say, observe }，跟一般反應一樣呈現
function hintOf(h) {
  return h ? { say: h.say, observe: h.observe || null } : null;
}

// 走訪所有口供句（開場、追問、翻供）
export function allLines(chapter) {
  const out = [];
  for (const p of chapter.interrogation.people) {
    for (const l of p.lines || []) out.push({ ...l, person: p.id, source: 'line' });
    for (const f of p.followups || []) for (const l of f.lines) out.push({ ...l, person: p.id, source: 'followup' });
    for (const b of p.breaks || []) for (const l of b.lines || []) out.push({ ...l, person: p.id, source: 'break' });
  }
  return out;
}

export function validate(chapters) {
  const problems = [];
  const ids = new Set();
  const codes = new Set();
  chapters.forEach((ch, index) => {
    const where = ch.id || `#${index}`;
    const bad = (msg) => problems.push(`${where}：${msg}`);
    if (!/^ch\d+$/.test(ch.id || '')) bad('id 要是 ch 加數字');
    if (ids.has(ch.id)) bad('id 重複');
    ids.add(ch.id);
    if (normalizeCode(ch.code).length !== 6 || normalizeCode(ch.code) !== ch.code) bad('code 要是 6 個大寫英數字');
    if (codes.has(ch.code)) bad('code 和別章重複');
    codes.add(ch.code);
    for (const k of ['label', 'title', 'teaser']) if (!ch[k]) bad(`缺少 ${k}`);

    const items = allItems(ch);
    const nos = items.map((i) => i.no);
    if (nos.some((n) => !Number.isInteger(n) || n < 1)) bad('證物編號要是正整數');
    if (new Set(nos).size !== nos.length) bad('證物編號重複');
    for (const item of items) {
      if (!item.name || !item.desc) bad(`證物 ${item.no} 缺名稱或描述`);
      if (item.lock) {
        const l = item.lock;
        if (!['digits', 'letters', 'clock'].includes(l.kind)) bad(`證物 ${item.no} 的鎖種類不對`);
        const code = normalizeLock(l.kind, l.code);
        if (l.kind === 'digits' && !new RegExp(`^\\d{${l.length}}$`).test(code)) bad(`證物 ${item.no} 的數字鎖密碼長度不對`);
        if (l.kind === 'letters' && !new RegExp(`^[A-Z]{${l.length}}$`).test(code)) bad(`證物 ${item.no} 的字母鎖密碼長度不對`);
        if (l.kind === 'clock' && !/^(0[1-9]|1[0-2])[0-5]\d$/.test(code)) bad(`證物 ${item.no} 的時鐘鎖要是 1–12 點`);
        if (!l.text) bad(`證物 ${item.no} 的鎖打開後沒有內容`);
      }
    }

    const people = ch.interrogation.people;
    const personIds = new Set(people.map((p) => p.id));
    if (personIds.size !== people.length) bad('人物 id 重複');
    const lines = allLines(ch);
    const lineNos = lines.map((l) => l.no);
    if (lineNos.some((n) => !Number.isInteger(n) || n < 1)) bad('口供編號要是正整數');
    if (new Set(lineNos).size !== lineNos.length) bad('口供編號重複');
    for (const p of people) {
      if (!p.name || !p.role || !p.monogram) bad(`${p.id} 缺名字、身分或印章字`);
      if (!(p.deflect || []).length) bad(`${p.id} 缺出示錯證物時的回應`);
      const breaks = p.breaks || [];
      const keys = breaks.map((b) => b.key).filter(Boolean);
      if (new Set(keys).size !== keys.length) bad(`${p.id} 的改口 key 重複`);
      const seenEvidence = new Set();
      for (const b of breaks) {
        for (const e of b.evidence) {
          if (!nos.includes(e)) bad(`${p.id} 的翻供對應到不存在的證物 ${e}`);
          if (seenEvidence.has(e)) bad(`${p.id} 有兩段改口都用證物 ${e} 觸發`);
          seenEvidence.add(e);
        }
        const hasLines = Array.isArray(b.lines) && b.lines.length > 0;
        if (hasLines === Boolean(b.react)) bad(`${p.id} 的每段出示結果要嘛是改口（lines），要嘛是反應（react），不能兩者都有或都沒有`);
        for (const r of b.requires || []) if (!keys.includes(r) || r === b.key) bad(`${p.id} 的改口前置條件 ${r} 不存在`);
        for (const r of Object.keys(b.earlyBy || {})) if (!(b.requires || []).includes(r)) bad(`${p.id} 的 earlyBy 有不在前置條件裡的 ${r}`);
        if ((b.requires || []).length && !b.early) bad(`${p.id} 有前置條件的改口要寫 early 暗示`);
        // 還沒到時候的反應要跟一般反應長得一樣：一句話（say）加上觀察（observe）
        for (const h of [b.early, ...Object.values(b.earlyBy || {})].filter(Boolean)) {
          if (typeof h !== 'object' || typeof h.say !== 'string' || !h.say || (h.observe != null && typeof h.observe !== 'string')) bad(`${p.id} 的 early／earlyBy 要寫成 { say, observe }`);
        }
      }
      // 前置條件不能繞成一圈
      const byKey = new Map(breaks.filter((b) => b.key).map((b) => [b.key, b]));
      const visiting = new Set();
      const done = new Set();
      const cyclic = (key) => {
        if (done.has(key)) return false;
        if (visiting.has(key)) return true;
        visiting.add(key);
        const hit = (byKey.get(key)?.requires || []).some(cyclic);
        visiting.delete(key);
        done.add(key);
        return hit;
      };
      if ([...byKey.keys()].some(cyclic)) bad(`${p.id} 的改口前置條件繞成一圈`);
    }

    const a = ch.accuse;
    const fieldIds = a.fields.map((f) => f.id);
    if (new Set(fieldIds).size !== fieldIds.length) bad('指控欄位 id 重複');
    if (a.fields[0].type !== 'person') bad('第一個指控欄位必須是人物（判定訊息依它決定）');
    for (const f of a.fields) {
      const values = a.answer[f.id];
      if (!Array.isArray(values) || !values.length) {
        bad(`指控欄位 ${f.id} 沒有正解`);
        continue;
      }
      if (f.type === 'person') {
        for (const pid of f.people) if (!personIds.has(pid)) bad(`指控欄位 ${f.id} 有不存在的人物 ${pid}`);
        for (const v of values) if (!f.people.includes(v)) bad(`指控欄位 ${f.id} 的正解不在選項裡`);
      } else if (f.type === 'choice') {
        const opts = f.options.map((o) => o.id);
        if (new Set(opts).size !== opts.length) bad(`指控欄位 ${f.id} 的選項 id 重複`);
        for (const v of values) if (!opts.includes(v)) bad(`指控欄位 ${f.id} 的正解不在選項裡`);
      } else if (f.type === 'evidence') {
        for (const v of values) if (!nos.includes(v)) bad(`指控欄位 ${f.id} 的正解不是證物編號`);
      } else if (f.type === 'statement') {
        for (const v of values) if (!lineNos.includes(v)) bad(`指控欄位 ${f.id} 的正解不是口供編號`);
      } else bad(`指控欄位 ${f.id} 的種類不對`);
    }
    const culpritField = a.fields[0];
    for (const pid of culpritField.people) {
      if (a.answer[culpritField.id].includes(pid)) continue;
      if (!a.messages.wrong || !a.messages.wrong[pid]) bad(`缺少選錯 ${pid} 時的判定訊息`);
    }
    if (!a.messages.incomplete) bad('缺少「兇手對、其他不完整」的判定訊息');
    if (!(a.truth || []).length) bad('缺少真相');
    for (const h of ch.brief.hints || []) if (!h.topic || !(h.steps || []).length) bad('提示格式不對');
  });
  return problems;
}

/* ---------- 組出各頁的內容並加密 ---------- */

const chapterInfo = (ch) => ({ id: ch.id, label: ch.label, title: ch.title, order: ch.order });

function serialize(fields, values) {
  return fields.map((f) => `${f.id}=${values[f.id]}`).join(';');
}

function crossProduct(fields, answer) {
  let combos = [{}];
  for (const f of fields) {
    const next = [];
    for (const c of combos) for (const v of answer[f.id]) next.push({ ...c, [f.id]: String(v) });
    combos = next;
  }
  return combos;
}

async function sceneItem(item, salt) {
  const out = { no: item.no, name: item.name, icon: item.icon || '🔎', desc: item.desc };
  if (item.reveal) out.reveal = { button: item.reveal.button, text: item.reveal.text };
  if (item.lock) {
    const l = item.lock;
    const code = normalizeLock(l.kind, l.code);
    const inner = { text: l.text, items: [] };
    for (const child of l.items || []) inner.items.push(await sceneItem(child, salt));
    out.lock = {
      label: l.label,
      kind: l.kind,
      length: l.length || null,
      prompt: l.prompt || null,
      i: shaHex(['lockidx', salt, String(item.no), code]),
      ...(await seal(['lock', salt, String(item.no), code], inner))
    };
  }
  return out;
}

export async function buildPayloads(ch, chapters, salt) {
  const theme = ch.theme || 'default';
  const info = chapterInfo(ch);
  const items = allItems(ch);
  const lines = allLines(ch);
  const maxEvidence = Math.max(...items.map((i) => i.no));
  const maxStatement = Math.max(...lines.map((l) => l.no));

  const brief = {
    chapter: info,
    theme,
    recap: ch.brief.recap || [],
    preface: ch.brief.preface || [],
    mechanics: ch.brief.mechanics || [],
    hints: ch.brief.hints || []
  };

  const rooms = [];
  for (const room of ch.scene.rooms) {
    const r = { id: room.id, name: room.name, intro: room.intro || null, items: [] };
    for (const item of room.items) r.items.push(await sceneItem(item, salt));
    rooms.push(r);
  }
  const scene = { chapter: info, theme, intro: ch.scene.intro || '', plan: ch.scene.plan, rooms, maxEvidence };

  const breaks = [];
  for (const p of ch.interrogation.people) {
    const list = p.breaks || [];
    const idOf = new Map(list.map((b, k) => [b.key || `#${k}`, `${p.id}-${k + 1}`]));
    for (const [k, b] of list.entries()) {
      // 同一段改口可能有好幾件證物都能觸發；id 讓頁面認得出是同一段，不重複顯示。
      // requires：要先逼出哪幾段，這段才會說；沒達成時只給 early 這句暗示。
      const id = `${p.id}-${k + 1}`;
      const requires = (b.requires || []).map((key) => idOf.get(key));
      // earlyBy：還缺哪一段，就給哪一句暗示（依 requires 的順序取第一個缺的）
      // 暗示的樣子跟一般反應一樣（say＋observe），玩家分不出這件證物之後會不會讓對方改口
      const early = hintOf(b.early);
      const earlyBy = b.earlyBy ? Object.fromEntries(Object.entries(b.earlyBy).map(([key, h]) => [idOf.get(key), hintOf(h)])) : null;
      // final：認罪或坦白。之後再出示別的證物，對方只會說已經全部招了，不扣信用
      const final = Boolean(b.final || ['認罪', '坦白'].includes(b.title));
      const content = b.react
        ? { id, react: true, say: b.react, observe: b.observe || null, requires, early, earlyBy }
        : { id, lines: b.lines, observe: b.observe || null, title: b.title || null, requires, early, earlyBy, final };
      for (const e of b.evidence) {
        breaks.push({
          i: shaHex(['presentidx', salt, p.id, String(e)]),
          ...(await seal(['present', salt, p.id, String(e)], content))
        });
      }
    }
  }
  breaks.sort((x, y) => (x.i < y.i ? -1 : 1));
  const interrogation = {
    chapter: info,
    theme,
    intro: ch.interrogation.intro || '',
    maxEvidence,
    credibility: ch.interrogation.credibility || 5,
    credibilityOut: ch.interrogation.credibilityOut || null,
    people: ch.interrogation.people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      monogram: p.monogram,
      kind: p.kind || 'suspect',
      lines: p.lines || [],
      followups: (p.followups || []).map((f) => ({ q: f.q, lines: f.lines, observe: f.observe || null })),
      deflect: p.deflect
    })),
    breaks
  };

  // 指控與判定
  const a = ch.accuse;
  const fields = a.fields;
  const culpritField = fields[0];
  const personMap = new Map(ch.interrogation.people.map((p) => [p.id, p]));
  const verdictPeople = culpritField.people.map((pid) => ({
    id: pid,
    json: JSON.stringify({ k: a.answer[culpritField.id].includes(pid) ? 'culprit' : 'wrong', m: a.answer[culpritField.id].includes(pid) ? a.messages.incomplete : a.messages.wrong[pid] })
  }));
  const longest = Math.max(...verdictPeople.map((p) => enc.encode(p.json).length));
  const size = Math.ceil((longest + 16) / 64) * 64;
  const peopleBoxes = [];
  for (const p of verdictPeople) {
    const padded = p.json + ' '.repeat(size - enc.encode(p.json).length);
    peopleBoxes.push({ i: shaHex(['personidx', salt, p.id]), ...(await seal(['person', salt, p.id], padded)) });
  }
  peopleBoxes.sort((x, y) => (x.i < y.i ? -1 : 1));

  const next = chapters.find((c) => c.order === ch.order + 1) || null;
  const truthPayload = {
    t: a.truth,
    epilogue: a.epilogue || null,
    next: next ? { id: next.id, label: next.label, title: next.title, code: next.code, href: `../${next.id}/` } : null
  };
  const solutions = crossProduct(fields, a.answer);
  const solved = [];
  const near = new Set();
  const truth = [];
  for (const s of solutions) {
    const ser = serialize(fields, s);
    solved.push(shaHex(['full', salt, ser]));
    truth.push({ i: shaHex(['truthidx', salt, ser]), ...(await seal(['truth', salt, ser], truthPayload)) });
    for (const f of fields.slice(1)) near.add(shaHex(['near', salt, serialize(fields, { ...s, [f.id]: '*' })]));
  }
  solved.sort();
  truth.sort((x, y) => (x.i < y.i ? -1 : 1));
  const accuse = {
    chapter: info,
    theme,
    intro: a.intro || '',
    fields: fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      hint: f.hint || null,
      options: f.type === 'choice' ? f.options.map((o) => ({ id: o.id, text: o.text })) : undefined,
      people: f.type === 'person' ? f.people : undefined
    })),
    people: ch.interrogation.people.map((p) => ({ id: p.id, name: p.name, role: p.role, monogram: p.monogram })).filter((p) => fields.some((f) => f.type === 'person' && f.people.includes(p.id))),
    maxEvidence,
    maxStatement,
    verdict: { people: peopleBoxes, solved, near: [...near].sort(), truth }
  };

  return { brief, scene, interrogation, accuse };
}

export async function buildChapter(ch, chapters) {
  const salt = hex(randomBytes(16));
  const payloads = await buildPayloads(ch, chapters, salt);
  const files = {};
  for (const role of ROLES) {
    files[role] = { v: 1, chapter: ch.id, role, salt, box: await seal(['chapter', ch.id, salt, ch.code], payloads[role]) };
  }
  const check = await seal(['chapter', ch.id, salt, ch.code], { ok: ch.id });
  return { salt, files, check };
}

export function renderDataJs(file) {
  return '/* 由 tools/build-chapters.mjs 產生，不要手改。內容用通行碼推導的金鑰加密。 */\nwindow.CASE_DATA = ' + JSON.stringify(file) + ';\n';
}

export function renderManifest(entries) {
  return (
    '/* 由 tools/build-chapters.mjs 產生，不要手改。只有章節標題、一句話簡介與解鎖用的驗證密文。 */\nwindow.BLACKOUT_CHAPTERS = ' +
    JSON.stringify({ v: 1, series: SERIES, chapters: entries }, null, 1) +
    ';\n'
  );
}

/* ---------- 讀回已發布的資料（check、e2e 用；只需要通行碼，不需要原始內容） ---------- */

export function readDataFile(root, chapterId, role) {
  const file = path.join(root, chapterId, `${role}.data.js`);
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(readFileSync(file, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.CASE_DATA));
}

export function readManifest(root) {
  const file = path.join(root, 'chapters.js');
  if (!existsSync(file)) return null;
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(readFileSync(file, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.BLACKOUT_CHAPTERS));
}

export async function openRole(root, chapterId, role, code) {
  const data = readDataFile(root, chapterId, role);
  const payload = await unseal(['chapter', chapterId, data.salt, normalizeCode(code)], data.box);
  return { data, payload };
}

// 依鎖的種類列出所有可能的密碼（窮舉用）
export function lockSpace(lock) {
  if (lock.kind === 'digits') {
    const n = lock.length;
    return Array.from({ length: 10 ** n }, (_, i) => String(i).padStart(n, '0'));
  }
  if (lock.kind === 'letters') {
    const n = lock.length;
    const out = [];
    const rec = (prefix) => {
      if (prefix.length === n) return out.push(prefix);
      for (let c = 65; c <= 90; c += 1) rec(prefix + String.fromCharCode(c));
    };
    rec('');
    return out;
  }
  if (lock.kind === 'clock') {
    const out = [];
    for (let h = 1; h <= 12; h += 1) for (let m = 0; m < 60; m += 1) out.push(String(h).padStart(2, '0') + String(m).padStart(2, '0'));
    return out;
  }
  return [];
}

// 窮舉現場頁所有的鎖（包含鎖裡面的鎖），回傳 [{ no, code, inner }]
export async function crackLocks(scenePayload, salt) {
  const found = [];
  const visit = async (items) => {
    for (const item of items) {
      if (!item.lock) continue;
      const codes = lockSpace(item.lock).filter((code) => shaHex(['lockidx', salt, String(item.no), code]) === item.lock.i);
      for (const code of codes) {
        const inner = await unseal(['lock', salt, String(item.no), code], item.lock);
        found.push({ no: item.no, code, kind: item.lock.kind, inner });
        await visit(inner.items || []);
      }
    }
  };
  for (const room of scenePayload.rooms) await visit(room.items);
  return found;
}

// 窮舉偵訊頁「人物 × 證物編號」，回傳會翻供的組合
export async function crackPresents(interPayload, salt) {
  const index = new Map(interPayload.breaks.map((b) => [b.i, b]));
  const found = [];
  for (const p of interPayload.people) {
    for (let e = 1; e <= interPayload.maxEvidence; e += 1) {
      const box = index.get(shaHex(['presentidx', salt, p.id, String(e)]));
      if (box) found.push({ person: p.id, evidence: e, content: await unseal(['present', salt, p.id, String(e)], box) });
    }
  }
  return found;
}

// 判定一組指控（和 js/case-accuse.js 的邏輯相同）
export async function judgeAccuse(accusePayload, salt, values) {
  const fields = accusePayload.fields;
  const v = accusePayload.verdict;
  const ser = serialize(fields, values);
  if (v.solved.includes(shaHex(['full', salt, ser]))) {
    const idx = shaHex(['truthidx', salt, ser]);
    const box = v.truth.find((b) => b.i === idx);
    return { outcome: 'solved', ...(await unseal(['truth', salt, ser], box)) };
  }
  const culprit = values[fields[0].id];
  const pbox = v.people.find((b) => b.i === shaHex(['personidx', salt, culprit]));
  const person = JSON.parse(JSON.stringify(await unseal(['person', salt, culprit], pbox)));
  let near = false;
  if (person.k === 'culprit') {
    for (const f of fields.slice(1)) {
      if (v.near.includes(shaHex(['near', salt, serialize(fields, { ...values, [f.id]: '*' })]))) near = true;
    }
  }
  return { outcome: person.k === 'culprit' ? 'incomplete' : 'wrong', message: person.m, near };
}

// 每個欄位所有可能的值
export function fieldSpace(accusePayload, field) {
  if (field.type === 'person') return field.people;
  if (field.type === 'choice') return field.options.map((o) => o.id);
  if (field.type === 'evidence') return Array.from({ length: accusePayload.maxEvidence }, (_, i) => String(i + 1));
  if (field.type === 'statement') return Array.from({ length: accusePayload.maxStatement }, (_, i) => String(i + 1));
  return [];
}

// 窮舉所有指控組合，只用雜湊比對找出全對的組合（不解密），回傳 { total, solved: [values] }
export function crackAccuse(accusePayload, salt) {
  const fields = accusePayload.fields;
  const solvedSet = new Set(accusePayload.verdict.solved);
  const spaces = fields.map((f) => fieldSpace(accusePayload, f));
  const solved = [];
  let total = 0;
  const rec = (i, values) => {
    if (i === fields.length) {
      total += 1;
      if (solvedSet.has(shaHex(['full', salt, serialize(fields, values)]))) solved.push({ ...values });
      return;
    }
    for (const v of spaces[i]) {
      values[fields[i].id] = v;
      rec(i + 1, values);
    }
    delete values[fields[i].id];
  };
  rec(0, {});
  return { total, solved };
}

/* ---------- 和原始內容比對（build 與 check 共用） ---------- */

// 只用通行碼解開已發布的檔案，窮舉所有鎖、出示證物與指控，和原始內容比對。回傳 { problems, summaries }，都不含原文。
export async function verifyAgainstSources(root, chapters) {
  const problems = [];
  const summaries = [];
  for (const ch of chapters) {
    const fail = (msg) => problems.push(`${ch.id}：${msg}`);
    const opened = {};
    try {
      for (const role of ROLES) opened[role] = await openRole(root, ch.id, role, ch.code);
    } catch {
      fail('用原始內容裡的通行碼解不開已發布的資料（要重新 build）');
      continue;
    }
    const salt = opened.scene.data.salt;
    if (ROLES.some((r) => opened[r].data.salt !== salt)) fail('四個資料檔的鹽不一致');

    const locks = await crackLocks(opened.scene.payload, salt);
    const expectedLocks = allItems(ch).filter((i) => i.lock);
    for (const item of expectedLocks) {
      const hits = locks.filter((l) => l.no === item.no);
      if (hits.length !== 1 || hits[0].code !== normalizeLock(item.lock.kind, item.lock.code)) fail(`證物 ${item.no} 的鎖不是剛好一組密碼打得開`);
    }

    const presents = await crackPresents(opened.interrogation.payload, salt);
    const expected = ch.interrogation.people.flatMap((p) => (p.breaks || []).flatMap((b) => b.evidence.map((e) => `${p.id}:${e}`))).sort();
    const got = presents.map((p) => `${p.person}:${p.evidence}`).sort();
    if (expected.join() !== got.join()) fail('出示證物的翻供組合和原始內容不一致');
    // 同一段改口的每件證物要解出同一個 id 和同樣的內容；不同段的 id 不能撞；前置條件要對得上
    for (const p of ch.interrogation.people) {
      const ids = new Set();
      const list = p.breaks || [];
      const idOf = new Map(list.map((b, k) => [b.key || `#${k}`, null]));
      for (const b of list) {
        const hits = presents.filter((x) => x.person === p.id && b.evidence.includes(x.evidence));
        const hitIds = new Set(hits.map((x) => x.content.id));
        if (hitIds.size !== 1 || ids.has([...hitIds][0])) fail(`${p.id} 的改口 id 不一致或重複`);
        const id = [...hitIds][0];
        ids.add(id);
        if (b.key) idOf.set(b.key, id);
        const want = b.react ? { react: true, say: b.react } : { lines: b.lines };
        for (const x of hits) {
          const got = b.react ? { react: x.content.react, say: x.content.say } : { lines: x.content.lines };
          if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${p.id} 的出示結果和原始內容不同`);
        }
      }
      for (const b of list) {
        const hit = presents.find((x) => x.person === p.id && b.evidence.includes(x.evidence));
        const want = (b.requires || []).map((key) => idOf.get(key));
        if (hit && JSON.stringify(hit.content.requires || []) !== JSON.stringify(want)) fail(`${p.id} 的改口前置條件和原始內容不同`);
        const wantEarly = { early: hintOf(b.early), earlyBy: b.earlyBy ? Object.fromEntries(Object.entries(b.earlyBy).map(([key, h]) => [idOf.get(key), hintOf(h)])) : null };
        if (hit && JSON.stringify({ early: hit.content.early, earlyBy: hit.content.earlyBy }) !== JSON.stringify(wantEarly)) fail(`${p.id} 的還沒到時候的反應和原始內容不同`);
      }
    }

    const accuse = opened.accuse.payload;
    const { total, solved } = crackAccuse(accuse, salt);
    const expectedSolved = accuse.fields.reduce((n, f) => n * ch.accuse.answer[f.id].length, 1);
    if (solved.length !== expectedSolved) fail(`全對組合有 ${solved.length} 組，原始內容是 ${expectedSolved} 組`);
    for (const s of solved) {
      for (const f of accuse.fields) if (!ch.accuse.answer[f.id].map(String).includes(s[f.id])) fail('出現不在正解裡的全對組合');
    }
    if (solved.length) {
      const r = await judgeAccuse(accuse, salt, solved[0]);
      const next = chapters.find((c) => c.order === ch.order + 1);
      if (r.outcome !== 'solved' || JSON.stringify(r.t) !== JSON.stringify(ch.accuse.truth)) fail('真相解不開，或和原始內容不同');
      if ((next && (!r.next || r.next.code !== next.code)) || (!next && r.next)) fail('結案畫面的下一章通行碼不對');
    }
    // 每個不是兇手的人，選了都要回他自己的訊息；兇手但不完整要回「不完整」訊息
    const culpritField = accuse.fields[0];
    for (const pid of culpritField.people) {
      const values = Object.fromEntries(accuse.fields.map((f) => [f.id, fieldSpace(accuse, f)[0]]));
      values[culpritField.id] = pid;
      const isCulprit = ch.accuse.answer[culpritField.id].includes(pid);
      const r = await judgeAccuse(accuse, salt, values);
      const want = isCulprit ? ch.accuse.messages.incomplete : ch.accuse.messages.wrong[pid];
      if (r.outcome === 'solved') continue;
      if (r.message.trim() !== want) fail(`選 ${pid} 時的判定訊息和原始內容不同`);
    }
    // 四筆人物判定密文要一樣長，看不出誰是兇手
    if (new Set(accuse.verdict.people.map((b) => b.c.length)).size !== 1) fail('人物判定密文長度不一，可能看得出兇手');
    summaries.push(
      `${ch.id}：${allItems(ch).length} 件證物（${expectedLocks.length} 道鎖）、${ch.interrogation.people.length} 位人物、${allLines(ch).length} 句口供、${presents.filter((x) => !x.content.react).length} 組出示證物會改口、${presents.filter((x) => x.content.react).length} 組有反應；窮舉 ${total.toLocaleString()} 種指控，全對 ${solved.length} 組`
    );
  }
  return { problems, summaries };
}

// 原始內容裡所有會出現在畫面上的文字（劇透），依角色分開
export function sourceTexts(ch) {
  const scene = [ch.scene.intro || ''];
  for (const room of ch.scene.rooms) scene.push(room.intro || '');
  for (const item of allItems(ch)) {
    scene.push(item.desc);
    if (item.reveal) scene.push(item.reveal.text);
    if (item.lock) scene.push(item.lock.text, item.lock.prompt || '');
  }
  const interrogation = [ch.interrogation.intro || ''];
  for (const p of ch.interrogation.people) {
    interrogation.push(...(p.deflect || []));
    for (const l of p.lines || []) interrogation.push(l.text);
    for (const f of p.followups || []) interrogation.push(f.q, f.observe || '', ...f.lines.map((l) => l.text));
    for (const b of p.breaks || []) {
      const hints = [b.early, ...Object.values(b.earlyBy || {})].filter(Boolean).flatMap((h) => [h.say || '', h.observe || '']);
      interrogation.push(b.observe || '', b.react || '', ...hints, ...(b.lines || []).map((l) => l.text));
    }
  }
  const shared = [
    ...(ch.brief.recap || []),
    ...(ch.brief.preface || []),
    ...(ch.brief.hints || []).flatMap((h) => [h.topic, ...h.steps]),
    ch.accuse.intro || '',
    ch.accuse.messages.incomplete,
    ...Object.values(ch.accuse.messages.wrong || {}),
    ...ch.accuse.truth,
    ...(ch.accuse.epilogue || []),
    ...ch.accuse.fields.flatMap((f) => [f.label, ...(f.options || []).map((o) => o.text)])
  ];
  const clean = (list) => list.filter((t) => t && t.trim());
  return { scene: clean(scene), interrogation: clean(interrogation), shared: clean(shared), publicText: [ch.label, ch.title, ch.teaser] };
}

// 從已發布的檔案，只靠序章之後一路拿到的通行碼，把每一章都破一次（不需要原始內容）
export async function playthrough(root, firstCode) {
  const manifest = readManifest(root);
  const out = [];
  let code = firstCode;
  for (const entry of manifest.chapters.filter((c) => !c.open)) {
    const step = { id: entry.id, ok: false };
    out.push(step);
    if (!code) {
      step.error = '上一章沒有給通行碼';
      break;
    }
    try {
      await unseal(['chapter', entry.id, entry.salt, normalizeCode(code)], entry.check);
    } catch {
      step.error = '上一章給的通行碼打不開這一章';
      break;
    }
    const { data, payload } = await openRole(root, entry.id, 'accuse', code);
    const { total, solved } = crackAccuse(payload, data.salt);
    step.total = total;
    step.solved = solved.length;
    if (!solved.length) {
      step.error = '窮舉找不到任何能破案的組合';
      break;
    }
    const r = await judgeAccuse(payload, data.salt, solved[0]);
    step.ok = r.outcome === 'solved';
    step.hasEpilogue = Boolean(r.epilogue && r.epilogue.length);
    code = r.next ? r.next.code : null;
    step.next = r.next ? r.next.id : null;
  }
  return out;
}
