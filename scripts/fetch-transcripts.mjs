/**
 * 透過 firecrawl 提供的 rawHtml 解析 TED 逐字稿
 * 用法：node scripts/fetch-transcripts.mjs
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(ROOT, 'data.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function translateToZh(text) {
  if (!text) return '';
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|zh-TW`);
    const d = await r.json();
    return d?.responseData?.translatedText || '';
  } catch { return ''; }
}

function extractTranscriptFromHtml(html) {
  // TED transcript sentences are in aria-label attributes of div[role="button"] elements
  const regex = /aria-label="([^"]+)"/g;
  const sentences = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    let text = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    // Filter: only transcript sentences (not UI labels)
    if (text.length > 10 && !/^(Play|Pause|Mute|Share|Save|Like|Comment|Read|Enter|Exit|Close)/.test(text)) {
      sentences.push(text);
    }
  }
  return sentences;
}

// Group short sentences into paragraphs (~2-3 sentences each)
function groupIntoParagraphs(sentences) {
  const paragraphs = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > 200 && current) {
      paragraphs.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current) paragraphs.push(current.trim());
  return paragraphs;
}

async function fetchTranscript(slug) {
  const url = `https://www.ted.com/talks/${slug}/transcript`;
  console.log(`  爬取: ${slug}`);

  try {
    // Use a simple fetch first - TED embeds transcript in initial HTML
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!res.ok) {
      console.log(`    HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();
    const sentences = extractTranscriptFromHtml(html);
    if (sentences.length < 5) {
      console.log(`    只找到 ${sentences.length} 句，跳過`);
      return null;
    }

    const paragraphs = groupIntoParagraphs(sentences);
    console.log(`    找到 ${sentences.length} 句，合併為 ${paragraphs.length} 段`);

    // Translate each paragraph
    const result = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const zh = await translateToZh(paragraphs[i]);
      await sleep(350);
      result.push({ en: paragraphs[i], zh: zh || '' });
      if ((i + 1) % 10 === 0) {
        console.log(`    翻譯進度: ${i + 1}/${paragraphs.length}`);
      }
    }
    return result;
  } catch (e) {
    console.log(`    錯誤: ${e.message}`);
    return null;
  }
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  if (!data.transcripts) data.transcripts = {};

  const slugs = data.tedSlugs || [];
  const missing = slugs.filter(s => !data.transcripts[s]?.length);
  console.log(`需要爬取 ${missing.length} 部逐字稿\n`);

  for (const slug of missing) {
    const transcript = await fetchTranscript(slug);
    if (transcript?.length) {
      data.transcripts[slug] = transcript;
      // 每部完成就存檔
      writeFileSync(dataPath, JSON.stringify(data, null, 2));
      console.log(`    ✓ 已儲存\n`);
    } else {
      console.log(`    ✗ 無法取得\n`);
    }
    await sleep(2000); // 間隔 2 秒避免被擋
  }

  console.log(`\n完成！共 ${Object.keys(data.transcripts).length} 部有逐字稿`);
}

main().catch(console.error);
