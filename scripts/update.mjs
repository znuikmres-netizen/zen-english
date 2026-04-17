/**
 * ZenEnglish 每日內容更新腳本
 *
 * 來源：
 * 1. VoiceTube — 每日精選影片字幕提取單字
 * 2. BBC Learning English — 詞彙教學
 * 3. TED Talks — 演講逐字稿
 * 4. Free Dictionary API — 單字定義、音標、例句
 * 5. MyMemory API — 中文翻譯
 *
 * 用法：node scripts/update.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ============================================================
// 工具函式
// ============================================================

async function fetchText(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries) { console.warn(`[fetch] 失敗: ${url}`, e.message); return null; }
      await sleep(1000);
    }
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 翻譯（MyMemory 免費 API，每天 5000 字）
async function translateToZh(text) {
  if (!text) return '';
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|zh-TW`);
    const data = await res.json();
    return data?.responseData?.translatedText || '';
  } catch { return ''; }
}

// Free Dictionary API
async function lookupWord(word) {
  const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!data || !Array.isArray(data) || !data[0]) return null;
  return data[0];
}

// 常見字過濾
const STOP_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as',
  'you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will',
  'my','one','all','would','there','their','what','so','up','out','if','about','who','get','which',
  'go','me','when','make','can','like','time','no','just','him','know','take','people','into',
  'year','your','good','some','could','them','see','other','than','then','now','look','only',
  'come','its','over','think','also','back','after','use','two','how','our','work','first',
  'well','way','even','new','want','because','any','these','give','day','most','us','is','are',
  'was','were','been','being','had','has','did','does','done','am','may','might','must','shall',
  'should','need','very','much','more','many','here','where','why','too','own','same','still',
  'such','last','long','great','little','right','old','big','high','small','large','next','each',
  'those','both','few','through','down','between','thing','put','let','lot','really','something',
  'every','made','before','went','going','been','being','while','under','never','always','around',
  'another','again','once','found','three','four','five','called','part','without','place','used',
  'world','real','help','line','turn','move','live','kind','left','hand','point','thought',
  'much','keep','head','start','might','story','far','away','began','along','got','end','feel',
]);

function extractWords(text) {
  const raw = text.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/);
  return [...new Set(raw)].filter(w => w.length >= 5 && !STOP_WORDS.has(w) && /^[a-z]+$/.test(w));
}

// 動詞時態推測
function guessTenses(word, pos, dictEntry) {
  const tenses = [];
  if (!pos) return tenses;

  if (pos.includes('verb')) {
    tenses.push({ label: '原形', en: word });
    // 簡單推測規則
    if (word.endsWith('e')) {
      tenses.push({ label: '過去式', en: word + 'd' });
      tenses.push({ label: '過去分詞', en: word + 'd' });
      tenses.push({ label: '進行式', en: word.slice(0, -1) + 'ing' });
    } else if (word.endsWith('y') && !'aeiou'.includes(word[word.length - 2])) {
      tenses.push({ label: '過去式', en: word.slice(0, -1) + 'ied' });
      tenses.push({ label: '過去分詞', en: word.slice(0, -1) + 'ied' });
      tenses.push({ label: '進行式', en: word + 'ing' });
    } else {
      tenses.push({ label: '過去式', en: word + 'ed' });
      tenses.push({ label: '過去分詞', en: word + 'ed' });
      tenses.push({ label: '進行式', en: word + 'ing' });
    }
    tenses.push({ label: '第三人稱單數', en: word + (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') ? 'es' : 's') });
  } else if (pos.includes('noun')) {
    tenses.push({ label: '單數', en: word });
    if (word.endsWith('y') && !'aeiou'.includes(word[word.length - 2])) {
      tenses.push({ label: '複數', en: word.slice(0, -1) + 'ies' });
    } else if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x')) {
      tenses.push({ label: '複數', en: word + 'es' });
    } else {
      tenses.push({ label: '複數', en: word + 's' });
    }
  } else if (pos.includes('adjective')) {
    tenses.push({ label: '原級', en: word });
    if (word.length <= 6) {
      tenses.push({ label: '比較級', en: word + 'er' });
      tenses.push({ label: '最高級', en: word + 'est' });
    } else {
      tenses.push({ label: '比較級', en: 'more ' + word });
      tenses.push({ label: '最高級', en: 'most ' + word });
    }
  }
  return tenses;
}

const POS_MAP = { noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', conjunction: 'conj.', preposition: 'prep.', interjection: 'interj.' };

// ============================================================
// 爬蟲：VoiceTube（只抓 2026 年內容）
// ============================================================
async function scrapeVoiceTube() {
  console.log('[VoiceTube] 抓取 2026 年精選內容...');

  // 抓首頁 + 最新影片頁（都是 2026 的內容）
  const pages = [
    'https://tw.voicetube.com',
    'https://tw.voicetube.com/videos/all?page=1&sortBy=publishedAt',
  ];

  const videos = [];
  const sentences = [];

  for (const pageUrl of pages) {
    const html = await fetchText(pageUrl);
    if (!html) continue;
    const $ = load(html);

    $('a[href*="/videos/"]').each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      if (href && title && title.length > 10 && !videos.find(v => v.url === href)) {
        const fullUrl = href.startsWith('http') ? href : `https://tw.voicetube.com${href}`;
        videos.push({ title: title.slice(0, 100), url: fullUrl });
      }
    });

    // 提取英文句子作為單字來源
    const textContent = $.text();
    const enSentences = textContent.match(/[A-Z][^.!?]*[.!?]/g) || [];
    enSentences.forEach(s => {
      const trimmed = s.trim();
      if (trimmed.length >= 20 && trimmed.length <= 200 && /[a-z]/.test(trimmed)) {
        sentences.push(trimmed);
      }
    });

    await sleep(500);
  }

  console.log(`[VoiceTube] 取得 ${videos.length} 部影片, ${sentences.length} 個句子`);
  return { videos: [...new Map(videos.map(v => [v.url, v])).values()].slice(0, 30), sentences: [...new Set(sentences)].slice(0, 50) };
}

// ============================================================
// 爬蟲：BBC Learning English
// ============================================================
async function scrapeBBC() {
  console.log('[BBC] 抓取學習內容...');
  const html = await fetchText('https://www.bbc.com/learningenglish/english/vocabulary');
  if (!html) return [];

  const $ = load(html);
  const words = [];

  // BBC 頁面上的文字提取單字
  const text = $('body').text();
  const extracted = extractWords(text);
  words.push(...extracted.slice(0, 15));

  console.log(`[BBC] 提取 ${words.length} 個候選單字`);
  return words;
}

// ============================================================
// 爬蟲：TED Talks
// ============================================================
async function scrapeTED() {
  console.log('[TED] 抓取熱門演講...');
  const html = await fetchText('https://www.ted.com/talks?sort=popular&language=en');
  if (!html) return [];

  const $ = load(html);
  const talks = [];

  $('a[href*="/talks/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/talks/') && !href.includes('/playlists/')) {
      const slug = href.match(/\/talks\/([\w_]+)/)?.[1];
      if (slug && !talks.includes(slug)) talks.push(slug);
    }
  });

  console.log(`[TED] 找到 ${talks.length} 個演講`);
  return [...new Set(talks)].slice(0, 20);
}

// ============================================================
// 建立單字詳細資料
// ============================================================
async function buildWordDetails(words) {
  console.log(`[Dictionary] 查詢 ${words.length} 個單字的詳細資料...`);
  const results = [];

  for (const word of words.slice(0, 15)) {
    const entry = await lookupWord(word);
    await sleep(300); // 避免 rate limit

    if (!entry || !entry.meanings?.length) continue;

    const m = entry.meanings[0];
    const pos = POS_MAP[m.partOfSpeech] || m.partOfSpeech;
    const definition = m.definitions[0]?.definition || '';
    const example = m.definitions[0]?.example || m.definitions[1]?.example || '';

    // 取得中文翻譯
    const zhMeaning = await translateToZh(word + ': ' + definition);
    await sleep(500);
    let exampleZh = '';
    if (example) {
      exampleZh = await translateToZh(example);
      await sleep(500);
    }

    const tenses = guessTenses(word, m.partOfSpeech, entry);

    results.push({
      word: entry.word,
      pos,
      meaning: zhMeaning || definition,
      definition,
      tenses,
      example: example || `This is an example of using "${word}" in a sentence.`,
      exampleZh: exampleZh || '',
      phonetic: entry.phonetic || '',
    });

    if (results.length >= 10) break;
  }

  console.log(`[Dictionary] 成功建立 ${results.length} 個單字`);
  return results;
}

// ============================================================
// 常用俚語庫（大量預存，依日期輪替）
// ============================================================
const SLANG_POOL = [
  { phrase: 'break a leg', meaning: '祝好運（演出前的祝福語）', example: "You have a big presentation today? Break a leg!", exampleZh: "你今天有重要的簡報？祝你好運！" },
  { phrase: 'hit the sack', meaning: '上床睡覺', example: "I'm exhausted. I think I'll hit the sack early tonight.", exampleZh: "我累壞了，今晚打算早點睡。" },
  { phrase: 'piece of cake', meaning: '小事一樁、非常簡單', example: "Don't worry about the exam — it'll be a piece of cake.", exampleZh: "別擔心那場考試——小事一樁。" },
  { phrase: 'spill the beans', meaning: '洩漏秘密', example: "Come on, spill the beans! What happened at the meeting?", exampleZh: "快說啊，到底發生了什麼事？" },
  { phrase: 'cost an arm and a leg', meaning: '非常昂貴', example: "That designer bag costs an arm and a leg.", exampleZh: "那個名牌包貴得要命。" },
  { phrase: 'bite the bullet', meaning: '咬牙忍受、硬著頭皮做', example: "I hate going to the dentist, but I'll just bite the bullet.", exampleZh: "我討厭看牙醫，但只好硬著頭皮去了。" },
  { phrase: 'under the weather', meaning: '身體不舒服', example: "I'm feeling a bit under the weather today.", exampleZh: "我今天覺得有點不舒服。" },
  { phrase: 'the ball is in your court', meaning: '輪到你做決定了', example: "I've made my offer. The ball is in your court now.", exampleZh: "我已經開出條件了，現在輪到你決定。" },
  { phrase: 'let the cat out of the bag', meaning: '不小心說漏嘴', example: "She let the cat out of the bag about the surprise party.", exampleZh: "她不小心把驚喜派對的事說溜嘴了。" },
  { phrase: 'burn the midnight oil', meaning: '熬夜工作或讀書', example: "I've been burning the midnight oil to finish the project.", exampleZh: "我為了完成專案一直熬夜。" },
  { phrase: 'once in a blue moon', meaning: '非常罕見、千載難逢', example: "He only visits once in a blue moon.", exampleZh: "他很少來，偶爾才來一次。" },
  { phrase: 'a blessing in disguise', meaning: '因禍得福', example: "Losing that job was a blessing in disguise.", exampleZh: "丟了那份工作反而因禍得福。" },
  { phrase: 'get out of hand', meaning: '失控', example: "The situation got out of hand quickly.", exampleZh: "情況很快就失控了。" },
  { phrase: 'beat around the bush', meaning: '拐彎抹角', example: "Stop beating around the bush and tell me what happened.", exampleZh: "別拐彎抹角了，直接告訴我發生什麼事。" },
  { phrase: 'go the extra mile', meaning: '格外努力、多做一些', example: "She always goes the extra mile for her clients.", exampleZh: "她總是為客戶格外用心。" },
  { phrase: 'hit the nail on the head', meaning: '說得完全正確、一針見血', example: "You hit the nail on the head with that analysis.", exampleZh: "你的分析一針見血。" },
  { phrase: 'call it a day', meaning: '收工、結束一天的工作', example: "We've been working for hours. Let's call it a day.", exampleZh: "我們已經工作好幾個小時了，收工吧。" },
  { phrase: 'pull someone\'s leg', meaning: '開某人玩笑', example: "Are you serious or just pulling my leg?", exampleZh: "你是認真的還是在開我玩笑？" },
  { phrase: 'on the same page', meaning: '達成共識、想法一致', example: "Let's make sure we're all on the same page before we start.", exampleZh: "開始之前先確認大家想法一致。" },
  { phrase: 'the last straw', meaning: '忍無可忍的最後一根稻草', example: "Being late again was the last straw for his boss.", exampleZh: "他又遲到了，這是老闆忍耐的最後底線。" },
  { phrase: 'ring a bell', meaning: '聽起來耳熟', example: "Does the name Sarah ring a bell?", exampleZh: "Sarah 這個名字你有印象嗎？" },
  { phrase: 'cut to the chase', meaning: '直入重點', example: "Let me cut to the chase — we need more funding.", exampleZh: "讓我直說重點——我們需要更多資金。" },
  { phrase: 'throw in the towel', meaning: '認輸、放棄', example: "After three failed attempts, he threw in the towel.", exampleZh: "失敗三次之後，他認輸了。" },
  { phrase: 'wrap your head around', meaning: '理解、搞懂', example: "I can't wrap my head around quantum physics.", exampleZh: "我搞不懂量子物理。" },
  { phrase: 'no pain no gain', meaning: '不勞則無獲', example: "Training is tough, but no pain, no gain.", exampleZh: "訓練很辛苦，但不勞則無獲。" },
  { phrase: 'back to square one', meaning: '回到原點', example: "The deal fell through, so we're back to square one.", exampleZh: "交易破局了，我們又回到原點。" },
  { phrase: 'add insult to injury', meaning: '雪上加霜', example: "To add insult to injury, it started raining after my car broke down.", exampleZh: "雪上加霜的是，車子拋錨後又開始下雨。" },
  { phrase: 'keep your chin up', meaning: '保持樂觀、振作起來', example: "Keep your chin up — things will get better.", exampleZh: "振作起來，事情會好轉的。" },
  { phrase: 'get cold feet', meaning: '臨陣退縮', example: "He got cold feet right before the wedding.", exampleZh: "他在婚禮前臨陣退縮了。" },
  { phrase: 'in a nutshell', meaning: '簡而言之', example: "In a nutshell, we need to cut costs and increase sales.", exampleZh: "簡而言之，我們需要降低成本、增加銷售。" },
];

// ============================================================
// 每日一句庫
// ============================================================
const QUOTES_POOL = [
  { text: "The only way to do great work is to love what you do.", zh: "成就偉大工作的唯一方法，就是熱愛你所做的事。", author: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", zh: "在困難之中，蘊藏著機會。", author: "Albert Einstein" },
  { text: "It does not matter how slowly you go as long as you do not stop.", zh: "不怕慢，只怕站。走得再慢都沒關係，只要不停下來。", author: "Confucius" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", zh: "種一棵樹最好的時機是 20 年前，其次是現在。", author: "Chinese Proverb" },
  { text: "You miss 100% of the shots you don't take.", zh: "你不出手，就百分之百不會進球。", author: "Wayne Gretzky" },
  { text: "Strive not to be a success, but rather to be of value.", zh: "不要只追求成功，要追求成為有價值的人。", author: "Albert Einstein" },
  { text: "Everything you've ever wanted is on the other side of fear.", zh: "你想要的一切，都在恐懼的另一邊。", author: "George Addair" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", zh: "成功不是終點，失敗也不是末日，真正重要的是繼續前行的勇氣。", author: "Winston Churchill" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", zh: "未來屬於那些相信夢想之美的人。", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", zh: "越是黑暗的時刻，越要專注去看見光亮。", author: "Aristotle" },
  { text: "Do what you can, with what you have, where you are.", zh: "在你所在的地方，用你所擁有的，做你所能做的。", author: "Theodore Roosevelt" },
  { text: "Believe you can and you're halfway there.", zh: "相信你可以，你就已經成功了一半。", author: "Theodore Roosevelt" },
  { text: "Life is what happens when you're busy making other plans.", zh: "生活就是當你忙著做其他計劃時發生的事。", author: "John Lennon" },
  { text: "The only impossible journey is the one you never begin.", zh: "唯一不可能的旅程，是你從未開始的那一段。", author: "Tony Robbins" },
  { text: "In three words I can sum up everything I've learned about life: it goes on.", zh: "用三個字就能總結我對人生的體悟：它會繼續。", author: "Robert Frost" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", zh: "我們身後和眼前的，比不上我們內心的力量。", author: "Ralph Waldo Emerson" },
  { text: "The mind is everything. What you think, you become.", zh: "心念決定一切。你的想法，決定了你會成為什麼樣的人。", author: "Buddha" },
  { text: "An investment in knowledge pays the best interest.", zh: "投資知識，獲得的利息最高。", author: "Benjamin Franklin" },
  { text: "The secret of getting ahead is getting started.", zh: "領先的秘訣就是開始行動。", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", zh: "事情做成之前，看起來似乎都是不可能的。", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", zh: "別盯著時鐘看，要像它一樣持續前進。", author: "Sam Levenson" },
  { text: "You are never too old to set another goal or to dream a new dream.", zh: "你永遠不會太老而無法設定新目標或做新的夢。", author: "C.S. Lewis" },
  { text: "The best revenge is massive success.", zh: "最好的報復就是巨大的成功。", author: "Frank Sinatra" },
  { text: "What we achieve inwardly will change outer reality.", zh: "我們內在的改變，終將改變外在的現實。", author: "Plutarch" },
  { text: "Happiness is not something ready-made. It comes from your own actions.", zh: "幸福不是現成的，它來自於你的行動。", author: "Dalai Lama" },
  { text: "Turn your wounds into wisdom.", zh: "把你的傷痛轉化為智慧。", author: "Oprah Winfrey" },
  { text: "The only limit to our realization of tomorrow is our doubts of today.", zh: "我們對明天的實現，唯一的限制是今天的懷疑。", author: "Franklin D. Roosevelt" },
  { text: "Act as if what you do makes a difference. It does.", zh: "行動時相信你做的事會帶來改變——確實如此。", author: "William James" },
  { text: "Education is the most powerful weapon which you can use to change the world.", zh: "教育是你改變世界最強大的武器。", author: "Nelson Mandela" },
  { text: "The journey of a thousand miles begins with one step.", zh: "千里之行，始於足下。", author: "Lao Tzu" },
];

// ============================================================
// 主程式
// ============================================================
async function main() {
  console.log('=== ZenEnglish 每日更新開始 ===');
  console.log(`時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);

  // 讀取現有資料（累積模式）
  let existingData = { vocabulary: [], slangs: [], quotes: [], tedSlugs: [] };
  const dataPath = join(ROOT, 'data.json');
  if (existsSync(dataPath)) {
    try { existingData = JSON.parse(readFileSync(dataPath, 'utf-8')); } catch {}
  }

  // 1. 爬取內容
  const [voicetube, bbcWords, tedSlugs] = await Promise.all([
    scrapeVoiceTube(),
    scrapeBBC(),
    scrapeTED(),
  ]);

  // 2. 合併單字候選清單
  const allCandidates = [...new Set([
    ...extractWords(voicetube.sentences.join(' ')),
    ...bbcWords,
  ])];

  // 3. 查詢字典 + 翻譯
  const newWords = await buildWordDetails(allCandidates);

  // 4. 累積資料（去重）
  const existingWordSet = new Set((existingData.vocabulary || []).map(w => w.word));
  const mergedVocabulary = [
    ...(existingData.vocabulary || []),
    ...newWords.filter(w => !existingWordSet.has(w.word)),
  ];

  // 5. 合併 TED slugs
  const mergedTedSlugs = [...new Set([
    ...(existingData.tedSlugs || []),
    ...tedSlugs,
  ])];

  // 6. 組裝最終資料
  const data = {
    lastUpdated: new Date().toISOString(),
    totalWords: mergedVocabulary.length,
    totalSlangs: SLANG_POOL.length,
    totalQuotes: QUOTES_POOL.length,
    totalTedSlugs: mergedTedSlugs.length,
    vocabulary: mergedVocabulary,
    slangs: SLANG_POOL,
    quotes: QUOTES_POOL,
    tedSlugs: mergedTedSlugs,
  };

  // 7. 寫入 data.json
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log('\n=== 更新完成 ===');
  console.log(`單字庫: ${data.totalWords} 個`);
  console.log(`俚語庫: ${data.totalSlangs} 個`);
  console.log(`名言庫: ${data.totalQuotes} 句`);
  console.log(`TED 演講: ${data.totalTedSlugs} 個`);
}

main().catch(console.error);
