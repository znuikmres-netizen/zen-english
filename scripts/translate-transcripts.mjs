/**
 * 翻譯 data.json 中逐字稿的中文部分
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(ROOT, 'data.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function translate(text) {
  if (!text) return '';
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|zh-TW`);
    const d = await r.json();
    return d?.responseData?.translatedText || '';
  } catch { return ''; }
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const transcripts = data.transcripts || {};
  let total = 0, done = 0;

  for (const slug of Object.keys(transcripts)) {
    const lines = transcripts[slug];
    const needTranslate = lines.filter(l => !l.zh);
    if (!needTranslate.length) continue;

    console.log(`\n翻譯: ${slug} (${needTranslate.length} 段)`);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].zh) continue;
      const zh = await translate(lines[i].en);
      await sleep(350);
      lines[i].zh = zh;
      done++;
      if (done % 20 === 0) {
        console.log(`  進度: ${done} 段`);
        writeFileSync(dataPath, JSON.stringify(data, null, 2));
      }
    }
    total += needTranslate.length;
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`  ✓ ${slug} 完成`);
  }

  writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log(`\n全部完成！翻譯了 ${done} 段逐字稿`);
}

main().catch(console.error);
