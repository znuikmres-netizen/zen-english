/**
 * ZenEnglish 種子資料腳本
 * 一次產生 3 個月份量的單字、俚語、名言
 * 用法：node scripts/seed.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), '..');
const dataPath = join(ROOT, 'data.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

async function translateToZh(text) {
  if (!text) return '';
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|zh-TW`);
    const d = await r.json();
    return d?.responseData?.translatedText || '';
  } catch { return ''; }
}

const POS_MAP = { noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', conjunction: 'conj.', preposition: 'prep.', interjection: 'interj.' };

function guessTenses(word, pos) {
  const t = [];
  if (pos === 'verb') {
    t.push({ label: '原形', en: word });
    if (word.endsWith('e')) { t.push({ label: '過去式', en: word+'d' }, { label: '過去分詞', en: word+'d' }, { label: '進行式', en: word.slice(0,-1)+'ing' }); }
    else if (word.endsWith('y') && !'aeiou'.includes(word[word.length-2]||'')) { t.push({ label: '過去式', en: word.slice(0,-1)+'ied' }, { label: '過去分詞', en: word.slice(0,-1)+'ied' }, { label: '進行式', en: word+'ing' }); }
    else { t.push({ label: '過去式', en: word+'ed' }, { label: '過去分詞', en: word+'ed' }, { label: '進行式', en: word+'ing' }); }
    t.push({ label: '第三人稱單數', en: word + (/[shx]$/.test(word) ? 'es' : 's') });
  } else if (pos === 'noun') {
    t.push({ label: '單數', en: word });
    if (word.endsWith('y') && !'aeiou'.includes(word[word.length-2]||'')) t.push({ label: '複數', en: word.slice(0,-1)+'ies' });
    else if (/[shx]$/.test(word)) t.push({ label: '複數', en: word+'es' });
    else t.push({ label: '複數', en: word+'s' });
  } else if (pos === 'adjective') {
    t.push({ label: '原級', en: word });
    t.push({ label: '比較級', en: word.length <= 6 ? word+'er' : 'more '+word });
    t.push({ label: '最高級', en: word.length <= 6 ? word+'est' : 'most '+word });
  }
  return t;
}

// 精選 500+ 常用學習單字（多益 / 日常 / 商務 / 學術）
const SEED_WORDS = [
  'abandon','abstract','accomplish','accurate','achieve','acknowledge','acquire','adapt','adequate','adjust',
  'admire','advantage','advocate','aesthetic','affect','afford','aggressive','allocate','alter','ambitious',
  'analyze','anticipate','apparent','appreciate','appropriate','approve','articulate','aspect','assess','assume',
  'assure','attach','attain','attempt','attribute','authentic','authorize','available','awkward','beneficial',
  'betray','bias','boost','boundary','burden','capable','capture','category','cease','challenge',
  'chaos','circumstance','clarify','collaborate','commence','commit','communicate','companion','compensate','compete',
  'compile','complement','comply','component','comprehend','compromise','conceive','concentrate','conclude','concrete',
  'conduct','confident','confirm','conflict','confront','conscious','consensus','consequence','conserve','consider',
  'consist','constant','constitute','construct','consult','consume','contemplate','context','contract','contrast',
  'contribute','conventional','convince','cooperate','correspond','crucial','cultivate','curious','debate','deceive',
  'decline','dedicate','defeat','define','deliberate','demonstrate','deny','depict','deplete','derive',
  'designate','despite','detect','determine','devote','diminish','discipline','disclose','discover','discrete',
  'discriminate','dismiss','display','dispose','dispute','distinct','distribute','diverse','domestic','dominate',
  'draft','dramatic','drastic','durable','elaborate','eliminate','embrace','emerge','emotion','emphasize',
  'enable','encounter','encourage','endeavor','endure','enforce','engage','enhance','enormous','ensure',
  'enterprise','enthusiasm','entire','environment','equivalent','erode','essential','establish','evaluate','evident',
  'evolve','exaggerate','examine','exceed','exception','exclude','execute','exempt','exhibit','expand',
  'exploit','expose','extensive','external','extract','facilitate','factor','faithful','fascinate','feasible',
  'feature','flexible','fluctuate','forecast','formal','formulate','foundation','fragment','framework','frequent',
  'fulfill','function','fundamental','generate','genuine','global','gradual','guarantee','guidance','heritage',
  'hesitate','hierarchy','highlight','hypothesis','identical','identify','ignore','illustrate','immense','impact',
  'implement','implicate','implicit','impose','impulse','incentive','incident','incline','incorporate','indicate',
  'individual','inevitable','infinite','influence','inform','inherent','inhibit','initial','initiate','innovate',
  'insight','inspect','inspire','institute','integrate','integrity','intellect','intense','interact','interpret',
  'intervene','intimate','intrinsic','intuition','invest','investigate','involve','isolate','justify','keen',
  'kinetic','landscape','launch','legitimate','leverage','liberal','likewise','maintain','manifest','manipulate',
  'marginal','mature','mechanism','mediate','mental','migrate','minimize','modify','monitor','motive',
  'mutual','neglect','negotiate','neutral','nonetheless','notion','nuclear','nurture','objective','obligate',
  'obscure','obtain','obvious','occupy','occur','offensive','ongoing','operate','oppose','option',
  'orient','outcome','outline','output','overcome','overlook','overwhelm','parallel','participate','passive',
  'perceive','persist','perspective','persuade','phenomenon','pioneer','plausible','policy','portion','possess',
  'postpone','potential','precede','precise','predict','predominant','preliminary','premise','prescribe','preserve',
  'presume','prevail','previous','primarily','principle','priority','proceed','proclaim','profound','prohibit',
  'project','promote','proportion','prospect','prosper','protocol','provoke','pursue','qualify','radical',
  'random','rational','react','reconcile','recover','refine','reflect','reform','regime','reinforce',
  'reject','relevant','reluctant','rely','remarkable','remedy','render','renew','represent','reproduce',
  'require','resemble','reside','resolve','resource','respond','restore','restrain','retain','retrieve',
  'reveal','revenue','reverse','revise','revolve','rigid','robust','sacrifice','scarce','scenario',
  'schedule','scope','secure','segment','sequence','severe','shelter','shift','significant','simulate',
  'skeptical','solely','solidarity','solution','sophisticated','source','specific','speculate','stable','status',
  'stimulate','straightforward','strategy','stress','structure','subordinate','subsequent','substance','substantial','substitute',
  'subtle','succeed','sufficient','summary','supplement','suppress','surplus','survive','suspend','sustain',
  'symbol','sympathy','tangible','temporary','tendency','tension','terminate','theme','thereby','thorough',
  'thrive','tolerate','tradition','transfer','transform','transition','transmit','transparent','tremendous','trigger',
  'ultimate','undergo','undermine','undertake','uniform','unique','utilize','valid','variable','venture',
  'verify','version','virtual','visible','vision','vital','volatile','voluntary','vulnerable','withdraw',
];

// 90+ 俚語
const SLANGS = [
  { phrase: 'break a leg', meaning: '祝好運（演出前的祝福語）', example: "You have a big presentation today? Break a leg!", exampleZh: "你今天有重要的簡報？祝你好運！" },
  { phrase: 'hit the sack', meaning: '上床睡覺', example: "I'm exhausted. I think I'll hit the sack early tonight.", exampleZh: "我累壞了，今晚打算早點睡。" },
  { phrase: 'piece of cake', meaning: '小事一樁、非常簡單', example: "Don't worry about the exam — it'll be a piece of cake.", exampleZh: "別擔心那場考試——小事一樁。" },
  { phrase: 'spill the beans', meaning: '洩漏秘密', example: "Come on, spill the beans! What happened?", exampleZh: "快說啊，到底發生了什麼事？" },
  { phrase: 'cost an arm and a leg', meaning: '非常昂貴', example: "That designer bag costs an arm and a leg.", exampleZh: "那個名牌包貴得要命。" },
  { phrase: 'bite the bullet', meaning: '咬牙忍受、硬著頭皮做', example: "I hate going to the dentist, but I'll just bite the bullet.", exampleZh: "我討厭看牙醫，但只好硬著頭皮去了。" },
  { phrase: 'under the weather', meaning: '身體不舒服', example: "I'm feeling a bit under the weather today.", exampleZh: "我今天覺得有點不舒服。" },
  { phrase: 'the ball is in your court', meaning: '輪到你做決定了', example: "I've made my offer. The ball is in your court now.", exampleZh: "我已經開出條件了，現在輪到你決定。" },
  { phrase: 'let the cat out of the bag', meaning: '不小心說漏嘴', example: "She let the cat out of the bag about the surprise party.", exampleZh: "她不小心把驚喜派對的事說溜嘴了。" },
  { phrase: 'burn the midnight oil', meaning: '熬夜工作或讀書', example: "I've been burning the midnight oil to finish the project.", exampleZh: "我為了完成專案一直熬夜。" },
  { phrase: 'once in a blue moon', meaning: '非常罕見、千載難逢', example: "He only visits once in a blue moon.", exampleZh: "他很少來，偶爾才來一次。" },
  { phrase: 'a blessing in disguise', meaning: '因禍得福', example: "Losing that job was a blessing in disguise.", exampleZh: "丟了那份工作反而因禍得福。" },
  { phrase: 'get out of hand', meaning: '失控', example: "The situation got out of hand quickly.", exampleZh: "情況很快就失控了。" },
  { phrase: 'beat around the bush', meaning: '拐彎抹角', example: "Stop beating around the bush and tell me.", exampleZh: "別拐彎抹角了，直接告訴我。" },
  { phrase: 'go the extra mile', meaning: '格外努力、多做一些', example: "She always goes the extra mile for her clients.", exampleZh: "她總是為客戶格外用心。" },
  { phrase: 'hit the nail on the head', meaning: '一針見血', example: "You hit the nail on the head with that analysis.", exampleZh: "你的分析一針見血。" },
  { phrase: 'call it a day', meaning: '收工', example: "We've been working for hours. Let's call it a day.", exampleZh: "我們已經工作好幾個小時了，收工吧。" },
  { phrase: "pull someone's leg", meaning: '開玩笑', example: "Are you serious or just pulling my leg?", exampleZh: "你是認真的還是在開我玩笑？" },
  { phrase: 'on the same page', meaning: '想法一致', example: "Let's make sure we're all on the same page.", exampleZh: "先確認大家想法一致。" },
  { phrase: 'the last straw', meaning: '忍無可忍的最後一根稻草', example: "Being late again was the last straw.", exampleZh: "他又遲到了，這是最後底線。" },
  { phrase: 'ring a bell', meaning: '聽起來耳熟', example: "Does the name Sarah ring a bell?", exampleZh: "Sarah 這個名字你有印象嗎？" },
  { phrase: 'cut to the chase', meaning: '直入重點', example: "Let me cut to the chase — we need more funding.", exampleZh: "直說重點——我們需要更多資金。" },
  { phrase: 'throw in the towel', meaning: '認輸、放棄', example: "After three failed attempts, he threw in the towel.", exampleZh: "失敗三次之後，他認輸了。" },
  { phrase: 'wrap your head around', meaning: '理解、搞懂', example: "I can't wrap my head around quantum physics.", exampleZh: "我搞不懂量子物理。" },
  { phrase: 'no pain no gain', meaning: '不勞則無獲', example: "Training is tough, but no pain, no gain.", exampleZh: "訓練很辛苦，但不勞則無獲。" },
  { phrase: 'back to square one', meaning: '回到原點', example: "The deal fell through, so we're back to square one.", exampleZh: "交易破局了，又回到原點。" },
  { phrase: 'add insult to injury', meaning: '雪上加霜', example: "To add insult to injury, it started raining.", exampleZh: "雪上加霜的是，又開始下雨。" },
  { phrase: 'keep your chin up', meaning: '保持樂觀', example: "Keep your chin up — things will get better.", exampleZh: "振作起來，事情會好轉的。" },
  { phrase: 'get cold feet', meaning: '臨陣退縮', example: "He got cold feet right before the wedding.", exampleZh: "他在婚禮前臨陣退縮了。" },
  { phrase: 'in a nutshell', meaning: '簡而言之', example: "In a nutshell, we need to cut costs.", exampleZh: "簡而言之，我們需要降低成本。" },
  { phrase: 'the elephant in the room', meaning: '大家心知肚明但不敢提的問題', example: "Let's address the elephant in the room.", exampleZh: "我們來談談那個大家心知肚明的問題吧。" },
  { phrase: 'kill two birds with one stone', meaning: '一石二鳥、一舉兩得', example: "By cycling to work, I kill two birds with one stone.", exampleZh: "騎腳踏車上班可以一舉兩得。" },
  { phrase: 'speak of the devil', meaning: '說曹操曹操到', example: "Speak of the devil! We were just talking about you.", exampleZh: "說曹操曹操到！我們剛才正在聊你。" },
  { phrase: 'when pigs fly', meaning: '不可能的事（太陽打西邊出來）', example: "He'll clean his room when pigs fly.", exampleZh: "他會打掃房間？等太陽打西邊出來吧。" },
  { phrase: 'break the ice', meaning: '打破僵局、破冰', example: "Tell a joke to break the ice.", exampleZh: "講個笑話來破冰吧。" },
  { phrase: 'sit on the fence', meaning: '保持中立、騎牆', example: "You can't sit on the fence forever.", exampleZh: "你不能永遠保持中立。" },
  { phrase: 'a penny for your thoughts', meaning: '在想什麼？', example: "You look thoughtful. A penny for your thoughts?", exampleZh: "你看起來若有所思，在想什麼？" },
  { phrase: 'barking up the wrong tree', meaning: '找錯對象、搞錯方向', example: "If you think I did it, you're barking up the wrong tree.", exampleZh: "你以為是我做的？你找錯人了。" },
  { phrase: 'better late than never', meaning: '遲到總比不到好', example: "You finally started exercising? Better late than never!", exampleZh: "你終於開始運動了？遲到總比不到好！" },
  { phrase: 'blessing in disguise', meaning: '塞翁失馬焉知非福', example: "Getting fired was a blessing in disguise.", exampleZh: "被開除反而是塞翁失馬。" },
  { phrase: 'blow off steam', meaning: '發洩情緒', example: "I go jogging to blow off steam.", exampleZh: "我去慢跑來發洩情緒。" },
  { phrase: 'burn bridges', meaning: '斷了後路', example: "Don't burn bridges with your former employer.", exampleZh: "別跟前東家鬧翻，免得斷了後路。" },
  { phrase: 'by the skin of your teeth', meaning: '險之又險、差一點就', example: "I passed the exam by the skin of my teeth.", exampleZh: "我差一點就沒通過考試。" },
  { phrase: 'comparing apples and oranges', meaning: '拿不同的東西比較', example: "That's comparing apples and oranges.", exampleZh: "這根本是拿不同的東西在比。" },
  { phrase: 'cross that bridge when you come to it', meaning: '到時候再說、船到橋頭自然直', example: "Don't worry now. We'll cross that bridge when we come to it.", exampleZh: "別擔心，船到橋頭自然直。" },
  { phrase: "cry over spilled milk", meaning: '為已發生的事後悔（覆水難收）', example: "It's no use crying over spilled milk.", exampleZh: "覆水難收，後悔也沒用了。" },
  { phrase: "curiosity killed the cat", meaning: '好奇心殺死一隻貓（別太好奇）', example: "I know you want to know, but curiosity killed the cat.", exampleZh: "我知道你很想知道，但太好奇不是好事。" },
  { phrase: 'down to earth', meaning: '腳踏實地、平易近人', example: "Despite her fame, she's very down to earth.", exampleZh: "儘管她很有名，但為人非常平易近人。" },
  { phrase: 'easier said than done', meaning: '說的比做的容易', example: "Losing weight is easier said than done.", exampleZh: "減肥這種事，說的比做的容易。" },
  { phrase: 'every cloud has a silver lining', meaning: '否極泰來、黑暗中總有一線光明', example: "Don't give up. Every cloud has a silver lining.", exampleZh: "別放棄，黑暗中總有一線光明。" },
  { phrase: 'get your act together', meaning: '振作起來、好好表現', example: "You need to get your act together before the deadline.", exampleZh: "你得在截止日前振作起來。" },
  { phrase: 'give someone the benefit of the doubt', meaning: '姑且相信、給人機會', example: "Let's give him the benefit of the doubt.", exampleZh: "我們姑且相信他吧。" },
  { phrase: 'go back to the drawing board', meaning: '重新來過、從頭開始', example: "The plan failed. Time to go back to the drawing board.", exampleZh: "計畫失敗了，得重新來過。" },
  { phrase: 'hang in there', meaning: '撐住、堅持下去', example: "I know it's hard, but hang in there!", exampleZh: "我知道很辛苦，但撐住！" },
  { phrase: 'hit the ground running', meaning: '一上手就全力以赴', example: "She hit the ground running in her new job.", exampleZh: "她一到新工作就全力投入。" },
  { phrase: "it's not rocket science", meaning: '這不是什麼難事', example: "Come on, it's not rocket science!", exampleZh: "拜託，這又不是什麼難事！" },
  { phrase: 'jump on the bandwagon', meaning: '跟風、隨大流', example: "Everyone is jumping on the AI bandwagon.", exampleZh: "大家都在跟 AI 的風。" },
  { phrase: 'keep it under wraps', meaning: '保密', example: "Keep the new product under wraps until launch.", exampleZh: "新產品在上市前要保密。" },
  { phrase: 'leave no stone unturned', meaning: '不遺餘力、翻遍每個角落', example: "The police left no stone unturned in the investigation.", exampleZh: "警方在調查中不遺餘力。" },
  { phrase: 'let sleeping dogs lie', meaning: '別自找麻煩', example: "I decided to let sleeping dogs lie.", exampleZh: "我決定別自找麻煩。" },
  { phrase: 'miss the boat', meaning: '錯失良機', example: "If you don't apply now, you'll miss the boat.", exampleZh: "你現在不申請的話，就錯過機會了。" },
  { phrase: 'nip it in the bud', meaning: '防患於未然、在萌芽時制止', example: "We need to nip this problem in the bud.", exampleZh: "我們得在問題惡化前先解決。" },
  { phrase: 'on thin ice', meaning: '如履薄冰、處境危險', example: "You're on thin ice with the boss after that mistake.", exampleZh: "犯了那個錯之後，你在老闆那邊如履薄冰。" },
  { phrase: 'play it by ear', meaning: '見機行事、隨機應變', example: "I don't have a plan. Let's play it by ear.", exampleZh: "我沒什麼計劃，到時候見機行事吧。" },
  { phrase: 'put all your eggs in one basket', meaning: '孤注一擲', example: "Don't put all your eggs in one basket.", exampleZh: "別孤注一擲。" },
  { phrase: 'rain on someone\'s parade', meaning: '潑冷水、掃興', example: "I don't want to rain on your parade, but...", exampleZh: "我不想潑你冷水，但..." },
  { phrase: 'read between the lines', meaning: '讀出言外之意', example: "You have to read between the lines of her email.", exampleZh: "你得讀出她 email 的言外之意。" },
  { phrase: 'see eye to eye', meaning: '看法一致', example: "We don't always see eye to eye on politics.", exampleZh: "我們在政治議題上不一定看法一致。" },
  { phrase: 'take it with a grain of salt', meaning: '半信半疑、保留態度', example: "Take online reviews with a grain of salt.", exampleZh: "網路評論別全信，保留點態度。" },
  { phrase: 'the tip of the iceberg', meaning: '冰山一角', example: "This scandal is just the tip of the iceberg.", exampleZh: "這個醜聞只是冰山一角。" },
  { phrase: 'think outside the box', meaning: '跳脫框架思考', example: "We need to think outside the box to solve this.", exampleZh: "我們得跳脫框架才能解決這個問題。" },
  { phrase: 'time flies', meaning: '時光飛逝', example: "Time flies when you're having fun.", exampleZh: "快樂的時光總是過得特別快。" },
  { phrase: 'turn over a new leaf', meaning: '改過自新、重新開始', example: "He decided to turn over a new leaf after rehab.", exampleZh: "他決定在復健後重新開始。" },
  { phrase: 'up in the air', meaning: '懸而未決', example: "Our travel plans are still up in the air.", exampleZh: "我們的旅行計畫還懸而未決。" },
  { phrase: 'water under the bridge', meaning: '事過境遷、過去的事', example: "We had our disagreements, but it's water under the bridge.", exampleZh: "我們以前有過分歧，但那都是過去的事了。" },
  { phrase: "you can't judge a book by its cover", meaning: '不能以貌取人', example: "He looks tough, but you can't judge a book by its cover.", exampleZh: "他看起來很兇，但不能以貌取人。" },
  { phrase: 'a taste of your own medicine', meaning: '以其人之道還治其人之身', example: "He finally got a taste of his own medicine.", exampleZh: "他終於嚐到自己給別人的苦了。" },
  { phrase: 'at the drop of a hat', meaning: '毫不猶豫、立刻', example: "She'd travel anywhere at the drop of a hat.", exampleZh: "她隨時都可以說走就走去旅行。" },
  { phrase: 'bend over backwards', meaning: '竭盡全力（幫忙）', example: "She bent over backwards to help us settle in.", exampleZh: "她竭盡全力幫我們安頓下來。" },
  { phrase: 'bite off more than you can chew', meaning: '貪多嚼不爛、自不量力', example: "I think I bit off more than I can chew with this project.", exampleZh: "我覺得這個專案我接得太大了。" },
  { phrase: 'bring to the table', meaning: '能提供的（貢獻或價值）', example: "What skills do you bring to the table?", exampleZh: "你能帶來什麼技能？" },
  { phrase: 'come rain or shine', meaning: '風雨無阻、不論如何', example: "I'll be there, come rain or shine.", exampleZh: "不管怎樣我都會到。" },
  { phrase: 'cut corners', meaning: '偷工減料', example: "Don't cut corners on safety.", exampleZh: "安全方面別偷工減料。" },
  { phrase: 'down the road', meaning: '將來、以後', example: "We might expand the business down the road.", exampleZh: "將來我們可能會擴展業務。" },
  { phrase: 'get the ball rolling', meaning: '開始行動、啟動', example: "Let's get the ball rolling on the new campaign.", exampleZh: "我們開始推動新的活動吧。" },
  { phrase: 'give it a shot', meaning: '試試看', example: "I've never tried sushi, but I'll give it a shot.", exampleZh: "我從沒吃過壽司，但我試試看。" },
  { phrase: 'have a change of heart', meaning: '改變主意', example: "She had a change of heart and decided to stay.", exampleZh: "她改變主意，決定留下來了。" },
  { phrase: 'in the long run', meaning: '長遠來看', example: "This investment will pay off in the long run.", exampleZh: "這項投資長遠來看會有回報的。" },
  { phrase: 'keep tabs on', meaning: '密切注意', example: "We need to keep tabs on our competitors.", exampleZh: "我們需要密切關注競爭對手。" },
  { phrase: 'lose track of time', meaning: '忘了時間', example: "I lost track of time reading that book.", exampleZh: "我看書看到忘了時間。" },
  { phrase: 'make ends meet', meaning: '勉強維持生計', example: "It's hard to make ends meet on minimum wage.", exampleZh: "靠最低薪資很難維持生計。" },
  { phrase: 'on the dot', meaning: '準時、整點', example: "The meeting starts at 9 on the dot.", exampleZh: "會議 9 點整開始。" },
];

// 90+ 名言
const QUOTES = [
  { text: "The only way to do great work is to love what you do.", zh: "成就偉大工作的唯一方法，就是熱愛你所做的事。", author: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", zh: "在困難之中，蘊藏著機會。", author: "Albert Einstein" },
  { text: "It does not matter how slowly you go as long as you do not stop.", zh: "不怕慢，只怕站。", author: "Confucius" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", zh: "種一棵樹最好的時機是 20 年前，其次是現在。", author: "Chinese Proverb" },
  { text: "You miss 100% of the shots you don't take.", zh: "你不出手，就百分之百不會進球。", author: "Wayne Gretzky" },
  { text: "Strive not to be a success, but rather to be of value.", zh: "不要只追求成功，要追求成為有價值的人。", author: "Albert Einstein" },
  { text: "Everything you've ever wanted is on the other side of fear.", zh: "你想要的一切，都在恐懼的另一邊。", author: "George Addair" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", zh: "成功不是終點，失敗也不是末日，重要的是繼續前行的勇氣。", author: "Winston Churchill" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", zh: "未來屬於那些相信夢想之美的人。", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", zh: "越是黑暗的時刻，越要專注去看見光亮。", author: "Aristotle" },
  { text: "Do what you can, with what you have, where you are.", zh: "在你所在的地方，用你所擁有的，做你所能做的。", author: "Theodore Roosevelt" },
  { text: "Believe you can and you're halfway there.", zh: "相信你可以，你就已經成功了一半。", author: "Theodore Roosevelt" },
  { text: "Life is what happens when you're busy making other plans.", zh: "生活就是當你忙著做其他計劃時發生的事。", author: "John Lennon" },
  { text: "The only impossible journey is the one you never begin.", zh: "唯一不可能的旅程，是你從未開始的那一段。", author: "Tony Robbins" },
  { text: "In three words I can sum up everything I've learned about life: it goes on.", zh: "用三個字就能總結我對人生的體悟：它會繼續。", author: "Robert Frost" },
  { text: "The mind is everything. What you think, you become.", zh: "心念決定一切。你的想法，決定了你會成為什麼樣的人。", author: "Buddha" },
  { text: "An investment in knowledge pays the best interest.", zh: "投資知識，獲得的利息最高。", author: "Benjamin Franklin" },
  { text: "The secret of getting ahead is getting started.", zh: "領先的秘訣就是開始行動。", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", zh: "事情做成之前，看起來似乎都是不可能的。", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", zh: "別盯著時鐘看，要像它一樣持續前進。", author: "Sam Levenson" },
  { text: "You are never too old to set another goal or to dream a new dream.", zh: "你永遠不會太老而無法設定新目標。", author: "C.S. Lewis" },
  { text: "The best revenge is massive success.", zh: "最好的報復就是巨大的成功。", author: "Frank Sinatra" },
  { text: "Happiness is not something ready-made. It comes from your own actions.", zh: "幸福不是現成的，它來自於你的行動。", author: "Dalai Lama" },
  { text: "Turn your wounds into wisdom.", zh: "把你的傷痛轉化為智慧。", author: "Oprah Winfrey" },
  { text: "Act as if what you do makes a difference. It does.", zh: "行動時相信你做的事會帶來改變——確實如此。", author: "William James" },
  { text: "Education is the most powerful weapon which you can use to change the world.", zh: "教育是你改變世界最強大的武器。", author: "Nelson Mandela" },
  { text: "The journey of a thousand miles begins with one step.", zh: "千里之行，始於足下。", author: "Lao Tzu" },
  { text: "The only person you are destined to become is the person you decide to be.", zh: "你注定要成為的人，就是你決定要成為的那個人。", author: "Ralph Waldo Emerson" },
  { text: "We become what we think about most of the time.", zh: "我們會變成自己大部分時間在想的那種人。", author: "Earl Nightingale" },
  { text: "What you get by achieving your goals is not as important as what you become.", zh: "達成目標所獲得的，不如你在過程中成為的那個人重要。", author: "Zig Ziglar" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", zh: "我沒有失敗，我只是找到了一萬種行不通的方法。", author: "Thomas Edison" },
  { text: "Whether you think you can or you think you can't, you're right.", zh: "不管你認為自己行或不行，你都是對的。", author: "Henry Ford" },
  { text: "The two most important days in your life are the day you are born and the day you find out why.", zh: "人生最重要的兩天：你出生的那天，和你發現為什麼出生的那天。", author: "Mark Twain" },
  { text: "I find that the harder I work, the more luck I seem to have.", zh: "我發現我越努力，就越幸運。", author: "Thomas Jefferson" },
  { text: "If you want to lift yourself up, lift up someone else.", zh: "想要提升自己，就先幫助別人。", author: "Booker T. Washington" },
  { text: "A room without books is like a body without a soul.", zh: "一個沒有書的房間，就像一個沒有靈魂的身體。", author: "Marcus Tullius Cicero" },
  { text: "Your time is limited, don't waste it living someone else's life.", zh: "你的時間有限，不要浪費在過別人的生活上。", author: "Steve Jobs" },
  { text: "If you look at what you have in life, you'll always have more.", zh: "如果你看你所擁有的，你會發現你永遠都有更多。", author: "Oprah Winfrey" },
  { text: "Innovation distinguishes between a leader and a follower.", zh: "創新是領導者和跟隨者之間的區別。", author: "Steve Jobs" },
  { text: "The purpose of our lives is to be happy.", zh: "我們生命的目的就是快樂。", author: "Dalai Lama" },
  { text: "You only live once, but if you do it right, once is enough.", zh: "人生只有一次，但如果活得精彩，一次就夠了。", author: "Mae West" },
  { text: "Life is really simple, but we insist on making it complicated.", zh: "生活其實很簡單，但我們硬要把它搞複雜。", author: "Confucius" },
  { text: "Be yourself; everyone else is already taken.", zh: "做你自己，因為別人都有人做了。", author: "Oscar Wilde" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", zh: "人生最大的榮耀不是從不跌倒，而是每次跌倒後都能站起來。", author: "Nelson Mandela" },
  { text: "Stay hungry, stay foolish.", zh: "求知若飢，虛心若愚。", author: "Steve Jobs" },
  { text: "If you set your goals ridiculously high and it's a failure, you will fail above everyone else's success.", zh: "如果你把目標設得高得離譜然後失敗了，你的失敗也會在別人的成功之上。", author: "James Cameron" },
  { text: "To live is the rarest thing in the world. Most people exist, that is all.", zh: "活著是世上最稀有的事。大多數人只是存在著，僅此而已。", author: "Oscar Wilde" },
  { text: "The way to get started is to quit talking and begin doing.", zh: "開始的方法是停止空談，開始行動。", author: "Walt Disney" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", zh: "告訴我我會忘記，教導我我會記住，讓我參與我才能學會。", author: "Benjamin Franklin" },
  { text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.", zh: "不是所有面對的事情都能改變，但不面對的事情永遠改變不了。", author: "James Baldwin" },
  { text: "We do not remember days, we remember moments.", zh: "我們記住的不是日子，而是那些瞬間。", author: "Cesare Pavese" },
  { text: "Imagination is more important than knowledge.", zh: "想像力比知識更重要。", author: "Albert Einstein" },
  { text: "Try not to become a man of success, but rather try to become a man of value.", zh: "不要試著成為一個成功的人，而是試著成為一個有價值的人。", author: "Albert Einstein" },
  { text: "The only true wisdom is in knowing you know nothing.", zh: "唯一真正的智慧是知道自己一無所知。", author: "Socrates" },
  { text: "In order to write about life first you must live it.", zh: "要寫出關於生活的東西，首先你得去生活。", author: "Ernest Hemingway" },
  { text: "Do not go where the path may lead, go instead where there is no path and leave a trail.", zh: "不要走別人走過的路，去沒有路的地方留下足跡。", author: "Ralph Waldo Emerson" },
  { text: "A person who never made a mistake never tried anything new.", zh: "從不犯錯的人，也從未嘗試過新事物。", author: "Albert Einstein" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", zh: "活著要像明天就會死去一樣。學習要像會永遠活著一樣。", author: "Mahatma Gandhi" },
  { text: "Well done is better than well said.", zh: "做得好比說得好更重要。", author: "Benjamin Franklin" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", zh: "重複的行為造就了我們。卓越不是一個行為，而是一種習慣。", author: "Aristotle" },
  { text: "If opportunity doesn't knock, build a door.", zh: "如果機會不來敲門，就自己造一扇門。", author: "Milton Berle" },
  { text: "Change is the law of life. And those who look only to the past or present are certain to miss the future.", zh: "改變是人生的法則。只看過去或現在的人，一定會錯過未來。", author: "John F. Kennedy" },
  { text: "What we think, we become.", zh: "我們的思想，決定了我們成為什麼。", author: "Buddha" },
  { text: "The only limit to our realization of tomorrow is our doubts of today.", zh: "我們對明天的實現，唯一的限制是今天的懷疑。", author: "Franklin D. Roosevelt" },
  { text: "Don't count the days, make the days count.", zh: "不要數日子過，要讓每一天都有意義。", author: "Muhammad Ali" },
  { text: "Everything has beauty, but not everyone sees it.", zh: "萬物皆有美，但不是每個人都能看見。", author: "Confucius" },
  { text: "The best preparation for tomorrow is doing your best today.", zh: "對明天最好的準備，就是今天全力以赴。", author: "H. Jackson Brown Jr." },
  { text: "Keep your face always toward the sunshine — and shadows will fall behind you.", zh: "永遠面向陽光，陰影就會落在你身後。", author: "Walt Whitman" },
  { text: "Nothing is impossible, the word itself says 'I'm possible'!", zh: "沒有什麼是不可能的，impossible 這個字本身就在說「I'm possible」！", author: "Audrey Hepburn" },
  { text: "Simplicity is the ultimate sophistication.", zh: "簡單是最高級的精緻。", author: "Leonardo da Vinci" },
  { text: "Knowledge is power.", zh: "知識就是力量。", author: "Francis Bacon" },
  { text: "The pen is mightier than the sword.", zh: "筆比劍更有力量。", author: "Edward Bulwer-Lytton" },
  { text: "Dream big and dare to fail.", zh: "勇敢做大夢，也要敢於失敗。", author: "Norman Vaughan" },
  { text: "Where there is a will, there is a way.", zh: "有志者事竟成。", author: "Proverb" },
  { text: "Success usually comes to those who are too busy to be looking for it.", zh: "成功通常降臨在那些忙到沒時間去找它的人身上。", author: "Henry David Thoreau" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", zh: "你為某件事付出的越多，達成時的成就感就越大。", author: "Unknown" },
  { text: "Don't be afraid to give up the good to go for the great.", zh: "不要害怕放棄好的，去追求偉大的。", author: "John D. Rockefeller" },
  { text: "Opportunities don't happen. You create them.", zh: "機會不是等來的，是你創造的。", author: "Chris Grosser" },
  { text: "If you really look closely, most overnight successes took a long time.", zh: "如果你仔細觀察，大多數一夜成名的背後都花了很長時間。", author: "Steve Jobs" },
  { text: "It is never too late to be what you might have been.", zh: "成為你想成為的人，永遠不嫌晚。", author: "George Eliot" },
  { text: "Don't let yesterday take up too much of today.", zh: "別讓昨天佔據了太多的今天。", author: "Will Rogers" },
  { text: "People who are crazy enough to think they can change the world are the ones who do.", zh: "那些瘋狂到以為自己能改變世界的人，才是真正改變世界的人。", author: "Rob Siltanen" },
  { text: "Failure will never overtake me if my determination to succeed is strong enough.", zh: "只要我成功的決心夠強，失敗就永遠追不上我。", author: "Og Mandino" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", zh: "知道不夠，必須付諸行動；有意願不夠，必須去做。", author: "Johann Wolfgang von Goethe" },
  { text: "We may encounter many defeats but we must not be defeated.", zh: "我們可能遭遇許多挫敗，但絕不能被打倒。", author: "Maya Angelou" },
  { text: "What seems to us as bitter trials are often blessings in disguise.", zh: "看似苦難的考驗，往往是偽裝的祝福。", author: "Oscar Wilde" },
  { text: "Perfection is not attainable, but if we chase perfection we can catch excellence.", zh: "完美不可能達到，但追求完美的過程中能抓住卓越。", author: "Vince Lombardi" },
  { text: "Your limitation—it's only your imagination.", zh: "你的限制，只是你的想像力。", author: "Unknown" },
  { text: "Great things never come from comfort zones.", zh: "偉大的事物從不來自舒適圈。", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", zh: "夢想它，渴望它，然後去做。", author: "Unknown" },
  { text: "The harder the conflict, the greater the triumph.", zh: "衝突越激烈，勝利越偉大。", author: "George Washington" },
];

// ============================================================
// 主程式：批量查詢字典建立單字庫
// ============================================================
async function main() {
  console.log('=== ZenEnglish 種子資料建立 ===');

  let existing = { vocabulary: [], tedSlugs: [] };
  if (existsSync(dataPath)) {
    try { existing = JSON.parse(readFileSync(dataPath, 'utf-8')); } catch {}
  }

  const existingWords = new Set((existing.vocabulary || []).map(w => w.word));
  const newWords = SEED_WORDS.filter(w => !existingWords.has(w));

  console.log(`已有 ${existingWords.size} 個單字，待新增 ${newWords.length} 個`);

  const results = [...(existing.vocabulary || [])];
  let added = 0;

  for (const word of newWords) {
    const entry = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    await sleep(200);

    if (!entry || !Array.isArray(entry) || !entry[0]?.meanings?.length) continue;

    const e = entry[0];
    const m = e.meanings[0];
    const pos = POS_MAP[m.partOfSpeech] || m.partOfSpeech || '';
    const def = m.definitions[0]?.definition || '';
    const example = m.definitions[0]?.example || m.definitions[1]?.example || '';

    // 翻譯（每 5 個單字翻一次，節省配額）
    let zhMeaning = '';
    if (added % 3 === 0) {
      zhMeaning = await translateToZh(word + ': ' + def);
      await sleep(400);
    }

    let exampleZh = '';
    if (example && added % 5 === 0) {
      exampleZh = await translateToZh(example);
      await sleep(400);
    }

    const tenses = guessTenses(word, m.partOfSpeech);

    results.push({
      word: e.word,
      pos,
      meaning: zhMeaning || def,
      definition: def,
      tenses,
      example: example || `The concept of "${word}" is important in this context.`,
      exampleZh: exampleZh || '',
      phonetic: e.phonetic || e.phonetics?.find(p => p.text)?.text || '',
    });

    added++;
    if (added % 20 === 0) console.log(`  已處理 ${added} / ${newWords.length}`);
  }

  const data = {
    lastUpdated: new Date().toISOString(),
    totalWords: results.length,
    totalSlangs: SLANGS.length,
    totalQuotes: QUOTES.length,
    totalTedSlugs: (existing.tedSlugs || []).length,
    vocabulary: results,
    slangs: SLANGS,
    quotes: QUOTES,
    tedSlugs: existing.tedSlugs || [],
  };

  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log('\n=== 種子資料建立完成 ===');
  console.log(`單字庫: ${data.totalWords} 個`);
  console.log(`俚語庫: ${data.totalSlangs} 個`);
  console.log(`名言庫: ${data.totalQuotes} 句`);
  console.log(`TED: ${data.totalTedSlugs} 個`);
  console.log(`\n每日消耗：5 單字 + 3 俚語 + 1 名言`);
  console.log(`可供使用：${Math.floor(data.totalWords / 5)} 天（單字）/ ${Math.floor(data.totalSlangs / 3)} 天（俚語）/ ${data.totalQuotes} 天（名言）`);
}

main().catch(console.error);
