/**
 * 用 Google Translate 非官方端點重翻所有被 MyMemory 汙染的 zh 欄位
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(ROOT, 'data.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isBad(zh) {
  if (!zh) return true;
  const upper = zh.toUpperCase();
  return upper.includes('MYMEMORY') || upper.includes('YOU USED ALL AVAILABLE');
}

async function translateGoogle(text) {
  if (!text) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text.slice(0, 5000))}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return '';
    const d = await r.json();
    return (d[0] || []).map(x => x[0]).filter(Boolean).join('');
  } catch { return ''; }
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const transcripts = data.transcripts || {};
  let done = 0, failed = 0;
  const todo = [];
  for (const slug of Object.keys(transcripts)) {
    for (let i = 0; i < transcripts[slug].length; i++) {
      if (isBad(transcripts[slug][i].zh)) todo.push([slug, i]);
    }
  }
  console.log(`需要重翻 ${todo.length} 段`);

  for (let k = 0; k < todo.length; k++) {
    const [slug, i] = todo[k];
    const line = transcripts[slug][i];
    let zh = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      zh = await translateGoogle(line.en);
      if (zh) break;
      await sleep(1500);
    }
    if (zh) {
      line.zh = zh;
      done++;
    } else {
      line.zh = '';
      failed++;
    }
    if ((k + 1) % 25 === 0) {
      console.log(`  進度 ${k + 1}/${todo.length} (成功 ${done}, 失敗 ${failed})`);
      writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }
    await sleep(250);
  }
  writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log(`\n完成：${done} 成功，${failed} 失敗`);
}

main().catch(e => { console.error(e); process.exit(1); });
