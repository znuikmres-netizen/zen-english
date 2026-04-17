/**
 * 補丁腳本：為缺少中文翻譯的單字補上翻譯
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

// 判斷是否為英文開頭（代表沒有中文翻譯）
function needsZh(meaning) {
  if (!meaning) return true;
  // 如果第一個字是英文字母，代表還是英文定義
  return /^[a-zA-Z("]/.test(meaning.trim());
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  let fixedMeaning = 0, fixedExample = 0;

  for (let i = 0; i < data.vocabulary.length; i++) {
    const w = data.vocabulary[i];
    let changed = false;

    // 修中文意思
    if (needsZh(w.meaning)) {
      const zh = await translate(w.word + ': ' + (w.definition || w.meaning));
      await sleep(300);
      if (zh && !needsZh(zh)) {
        w.meaning = zh;
        fixedMeaning++;
        changed = true;
      }
    }

    // 修例句翻譯
    if (w.example && !w.exampleZh) {
      const zh = await translate(w.example);
      await sleep(300);
      if (zh) {
        w.exampleZh = zh;
        fixedExample++;
        changed = true;
      }
    }

    if ((fixedMeaning + fixedExample) % 30 === 0 && changed) {
      console.log(`  進度：已修 ${fixedMeaning} 個意思 + ${fixedExample} 個例句 (${i+1}/${data.vocabulary.length})`);
      // 每 30 個存一次，避免中途斷掉白做
      writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }
  }

  writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log(`\n完成：修復 ${fixedMeaning} 個中文意思 + ${fixedExample} 個例句翻譯`);
}

main().catch(console.error);
