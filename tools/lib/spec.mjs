// 從 docs/SPEC.md 讀出案件內容，當作檢查與 e2e 逐字比對的標準答案。
// 只讀規格的公開部分；機密段本來就不在 SPEC 裡。
import { readFileSync } from 'node:fs';
import path from 'node:path';

// SPEC 裡的嫌疑人標頭 → 頁面上用的 ID、名字、身分
export const SUSPECTS = [
  { header: '陳先生（屋主）', id: 'chen', name: '陳先生', role: '屋主' },
  { header: '管家老林', id: 'lin', name: '老林', role: '管家' },
  { header: '外甥阿哲', id: 'zhe', name: '阿哲', role: '外甥' },
  { header: '藝術品商人 蘇小姐', id: 'su', name: '蘇小姐', role: '藝術品商人' }
];

export const ROOMS = [
  { name: '飯廳', id: 'dining' },
  { name: '書房', id: 'study' },
  { name: '陽台', id: 'balcony' },
  { name: '地下室', id: 'basement' },
  { name: '走廊', id: 'hallway' }
];

export const ITEM_IDS = {
  燭台: 'candelabra',
  餐桌: 'table',
  書桌: 'desk',
  地板: 'floor',
  窗戶: 'window',
  菸灰缸: 'ashtray',
  地面: 'ground',
  電箱: 'fusebox',
  酒窖: 'cellar',
  盆栽: 'plant'
};

function section(lines, prefix) {
  const start = lines.findIndex((l) => l.startsWith('## ' + prefix));
  if (start === -1) throw new Error(`SPEC 找不到段落：${prefix}`);
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) out.push(lines[i]);
  return out;
}

// 「（中性物品）」這類句尾括號是設計註記，不顯示
function splitNotes(text) {
  const notes = [];
  let rest = text;
  let m;
  while ((m = rest.match(/（([^（）]*)）$/))) {
    notes.unshift(m[1]);
    rest = rest.slice(0, m.index);
  }
  return { text: rest, notes };
}

// 去掉外層「」，依 。？！ 斷句（標點留在句尾）
export function sentences(quoted) {
  const inner = quoted.replace(/^「/, '').replace(/」$/, '');
  return inner.split(/(?<=[。？！])/).map((s) => s.trim()).filter(Boolean);
}

export function parseSpec(md) {
  const lines = md.split(/\r?\n/);

  const preface = section(lines, '案件前言').map((l) => l.trim()).find(Boolean);

  // 現場物品
  const rooms = [];
  let room = null;
  for (const raw of section(lines, 'scene.html')) {
    const line = raw.trim();
    const roomDef = ROOMS.find((r) => r.name === line);
    if (roomDef) {
      room = { ...roomDef, items: [] };
      rooms.push(room);
      continue;
    }
    const m = line.match(/^- ([^：]+)：(.+)$/);
    if (!m || !room) continue;
    const name = m[1];
    if (!ITEM_IDS[name]) throw new Error(`SPEC 出現未知物品：${name}`);
    let body = m[2];
    let reveal = null;
    const r = body.match(/^(.*?)點選「(.+?)」後才顯示：(.+)$/);
    if (r) {
      body = r[1];
      reveal = { button: r[2], text: splitNotes(r[3]).text };
    }
    const { text, notes } = splitNotes(body);
    room.items.push({ id: ITEM_IDS[name], name, room: room.id, roomName: room.name, desc: text, notes, reveal });
  }

  // 口供
  const suspects = [];
  let s = null;
  for (const raw of section(lines, 'interrogation.html')) {
    const line = raw.trim();
    const def = SUSPECTS.find((d) => d.header === line);
    if (def) {
      s = { ...def, reaction: null };
      suspects.push(s);
      continue;
    }
    if (!s) continue;
    let m;
    if ((m = line.match(/^- 口供：(「.+」)$/))) s.testimony = m[1];
    else if ((m = line.match(/^- 追問(「.+?」)：(「.+」)$/))) {
      s.question = m[1];
      s.answer = m[2];
    } else if ((m = line.match(/^觀察反應：(.+)$/))) s.reaction = m[1];
  }

  for (const sus of suspects) {
    if (!sus.testimony || !sus.question || !sus.answer) throw new Error(`SPEC 的 ${sus.header} 缺少口供或追問`);
    let n = 0;
    sus.statements = [...sentences(sus.testimony), ...sentences(sus.answer)].map((text) => ({
      id: `${sus.id}-${(n += 1)}`,
      suspect: sus.id,
      text
    }));
  }

  const items = rooms.flatMap((r) => r.items);
  const statements = suspects.flatMap((x) => x.statements);
  if (rooms.length !== ROOMS.length || items.length !== 10) throw new Error('SPEC 現場物品解析數量不對');
  if (suspects.length !== 4 || statements.length !== 12) throw new Error('SPEC 口供解析數量不對');
  return { preface, rooms, items, suspects, statements };
}

export function loadSpec(root) {
  return parseSpec(readFileSync(path.join(root, 'docs', 'SPEC.md'), 'utf8'));
}
