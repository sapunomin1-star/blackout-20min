// 新章節原始內容的加密封存（tools/seal.mjs 與 tools/check.mjs 共用）。
// 金鑰用 PBKDF2-SHA256（60 萬次）從通關密語推導，再用 AES-GCM 加密。
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { webcrypto, randomBytes } from 'node:crypto';

const { subtle } = webcrypto;
export const SEALED_FILE = 'tools/chapters.sealed.json';
export const ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (buf) => Buffer.from(buf).toString('hex');
const unhex = (s) => new Uint8Array(Buffer.from(s, 'hex'));

export async function deriveKey(passphrase, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// 讀 tools/chapters.local/ch*.json 的原文（字串）；沒有就回 null
export function readSources(root) {
  const dir = path.join(root, 'tools', 'chapters.local');
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir).filter((n) => /^ch\d+\.json$/.test(n)).sort();
  if (!names.length) return null;
  const files = {};
  for (const n of names) {
    const text = readFileSync(path.join(dir, n), 'utf8');
    JSON.parse(text); // 壞掉的 JSON 不封存
    files[n] = text;
  }
  return files;
}

export function readSealed(root) {
  const file = path.join(root, SEALED_FILE);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export async function openSealed(box, passphrase) {
  if (box.v !== 1 || box.kdf !== 'PBKDF2-SHA256' || box.cipher !== 'AES-GCM') throw new Error('封存檔格式不對');
  const key = await deriveKey(passphrase, unhex(box.salt), box.iterations);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: unhex(box.iv) }, key, unhex(box.c));
  return JSON.parse(dec.decode(plain)).files;
}

export async function sealFiles(root, passphrase, files) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const c = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ files })));
  const box = { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-GCM', salt: hex(salt), iv: hex(iv), c: hex(c) };
  writeFileSync(path.join(root, SEALED_FILE), JSON.stringify(box, null, 2) + '\n');
}

export function newPassphrase() {
  // 20 個不易混淆的字元（約 100 bits），四個一組
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{5}/g).join('-');
}

export function sameFiles(a, b) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.join() === kb.join() && ka.every((k) => a[k] === b[k]);
}

