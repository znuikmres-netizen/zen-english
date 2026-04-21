/**
 * 從 TED 官方 VTT 重建逐字稿（英文 + 繁體中文官方字幕）
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(ROOT, 'data.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getTalkInfo(slug) {
  const r = await fetch(`https://www.ted.com/talks/${slug}`, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
  if (!m) return null;
  try {
    const nd = JSON.parse(m[1]);
    const pd = JSON.parse(nd.props.pageProps.videoData.playerData);
    return {
      id: pd.id,
      hasZhTw: pd.languages.some(l => l.languageCode === 'zh-tw'),
    };
  } catch { return null; }
}

async function fetchVtt(talkId, lang) {
  const r = await fetch(`https://hls.ted.com/talks/${talkId}/subtitles/${lang}/full.vtt`, {
    headers: { 'User-Agent': UA },
  });
  if (!r.ok) return null;
  return await r.text();
}

// Parse VTT → array of { start, end, text }
function parseVtt(vtt) {
  const lines = vtt.split(/\r?\n/);
  const cues = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\d\d:\d\d:\d\d\.\d{3})\s*-->\s*(\d\d:\d\d:\d\d\.\d{3})/);
    if (m) {
      const start = m[1], end = m[2];
      i++;
      const parts = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^\d\d:\d\d:\d\d\.\d{3}\s*-->/.test(lines[i])) {
        parts.push(lines[i].trim());
        i++;
      }
      cues.push({ start, end, text: parts.join(' ').trim() });
    } else {
      i++;
    }
  }
  return cues;
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

// 00:01:23.456 → 83.456 秒
function tsToSec(ts) {
  const [h, m, s] = ts.split(':');
  return parseInt(h)*3600 + parseInt(m)*60 + parseFloat(s);
}

// 以英文段落的時間範圍為基準，把所有重疊的中文 cue 全部收進來
function groupIntoParagraphs(enCues, zhCues) {
  // 先把英文 cue 合併成段落，記錄每段的 [startSec, endSec]
  const enParas = [];
  let buf = [], bufStart = null, bufEnd = null;
  for (const c of enCues) {
    if (bufStart === null) bufStart = tsToSec(c.start);
    bufEnd = tsToSec(c.end);
    buf.push(c.text);
    const joined = buf.join(' ');
    if (joined.length > 200) {
      enParas.push({ text: joined.trim(), start: bufStart, end: bufEnd });
      buf = []; bufStart = null; bufEnd = null;
    }
  }
  if (buf.length) enParas.push({ text: buf.join(' ').trim(), start: bufStart, end: bufEnd });

  // 對每段英文，收集時間範圍重疊的所有中文 cue
  const zhSorted = (zhCues || []).map(c => ({ text: c.text, start: tsToSec(c.start), end: tsToSec(c.end) }));
  const result = [];
  for (const p of enParas) {
    const overlap = zhSorted.filter(z => z.start < p.end && z.end > p.start);
    const zhText = overlap.map(z => z.text).join(' ').trim();
    result.push({ en: p.text, zh: zhText });
  }
  return result;
}

async function rebuildOne(slug) {
  console.log(`\n▶ ${slug}`);
  const info = await getTalkInfo(slug);
  if (!info) { console.log('  ✗ 無法取得 talkId'); return null; }
  console.log(`  talkId=${info.id}, zh-tw=${info.hasZhTw ? 'YES' : 'NO'}`);

  const enVtt = await fetchVtt(info.id, 'en');
  if (!enVtt) { console.log('  ✗ 無英文字幕'); return null; }
  const enCues = parseVtt(enVtt);
  console.log(`  英文 cues: ${enCues.length}`);

  let zhCues = null;
  if (info.hasZhTw) {
    const zhVtt = await fetchVtt(info.id, 'zh-tw');
    if (zhVtt) {
      zhCues = parseVtt(zhVtt);
      console.log(`  繁中 cues: ${zhCues.length}`);
    }
  }

  let paragraphs = groupIntoParagraphs(enCues, zhCues);

  // 若無官方繁中或某段 zh 空白，回落到 Google Translate
  const emptyIdx = paragraphs.map((p, i) => p.zh ? -1 : i).filter(i => i >= 0);
  if (emptyIdx.length) {
    console.log(`  補機器翻譯 ${emptyIdx.length} 段...`);
    for (const i of emptyIdx) {
      paragraphs[i].zh = await translateGoogle(paragraphs[i].en);
      await sleep(250);
    }
  }
  console.log(`  ✓ 產生 ${paragraphs.length} 段`);
  return paragraphs;
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const slugs = data.tedSlugs || [];
  data.transcripts = data.transcripts || {};

  for (const slug of slugs) {
    try {
      const p = await rebuildOne(slug);
      if (p?.length) {
        data.transcripts[slug] = p;
        writeFileSync(dataPath, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.log('  ERROR:', e.message);
    }
    await sleep(1500);
  }
  console.log('\n全部完成');
}

main().catch(e => { console.error(e); process.exit(1); });
