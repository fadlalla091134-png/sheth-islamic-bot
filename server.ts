import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const BOT_DIR = path.resolve(__dirname, 'bot');
const OWNER_NUMBER = '249905358205';
const PREFIX = '.';

const SHETH_SYSTEM_INSTRUCTION = `
أنت مساعد ذكي اسمك "شيث" (Sheth).
القواعد الأساسية لشخصيتك:
1. تتحدث دائماً باللهجة السودانية الطبيعية المحترمة والودودة (مثل: يا زول، أبشر، تمام التمام، حبابك، ما في مشكلة) بدون مبالغة أو تصنّع.
2. تكون إجاباتك قصيرة ومختصرة جداً (من جملة واحدة إلى 3 جمل قصيرة كحد أقصى).
3. لا تشرح بالتفصيل إلا إذا طلب المستخدم ذلك صراحةً بعبارات مثل: "وضح أكثر"، "اشرح بالتفصيل"، "أكثر"، "بالتفصيل".
4. لا تستخدم مقدمات طويلة أو حشو غير ضروري، وادخل في صلب الإجابة مباشرة.
`.trim();

function getAiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in the server environment.');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface BotFileEntry {
  path: string;
  size: number;
  folder: string;
  content: string;
}

function collectBotFiles(dir: string, baseDir: string): BotFileEntry[] {
  const results: BotFileEntry[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.resolve(dir, entry.name);
    // Strict path confinement check
    if (!fullPath.startsWith(baseDir + path.sep)) continue;

    if (entry.isDirectory()) {
      results.push(...collectBotFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath, 'utf8');
      const folder = relPath.includes('/') ? relPath.split('/')[0] : 'root';
      results.push({
        path: relPath,
        size: Buffer.byteLength(content, 'utf8'),
        folder,
        content,
      });
    }
  }

  return results.sort((a, b) => {
    const order = (p: string) => {
      if (p === 'index.js') return 0;
      if (p === 'package.json') return 1;
      if (p === '.env.example') return 2;
      if (p === 'README.md') return 3;
      if (p.startsWith('lib/')) return 4;
      if (p.startsWith('plugins/')) return 5;
      return 6;
    };
    const diff = order(a.path) - order(b.path);
    return diff !== 0 ? diff : a.path.localeCompare(b.path);
  });
}

const SURAH_NAMES = [
  'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس',
  'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه',
  'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم',
  'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
  'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
  'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة',
  'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
  'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
  'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد',
  'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات',
  'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر',
  'المسد', 'الإخلاص', 'الفلق', 'الناس',
];

const ADHKAR_SABAH = `╭┈───〔 ☀️ أذكار الصباح 〕┈───⊷
1. *آية الكرسي:* ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾ (مرة واحدة).
2. *المعوذات:* الإخلاص والفلق والناس (3 مرات).
3. *أصبحنا وأصبح الملك لله*، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.
4. *سيد الاستغفار:* اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت...
5. *بسم الله الذي لا يضر مع اسمه شيء* في الأرض ولا في السماء وهو السميع العليم (3 مرات).
6. *سبحان الله وبحمده* (100 مرة).
╰┈────────────────────⊷`;

const ADHKAR_MASAA = `╭┈───〔 🌙 أذكار المساء 〕┈───⊷
1. *آية الكرسي:* ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾ (مرة واحدة).
2. *المعوذات:* الإخلاص والفلق والناس (3 مرات).
3. *أمسينا وأمسى الملك لله*، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.
4. *أعوذ بكلمات الله التامات* من شر ما خلق (3 مرات).
5. *اللهم بك أمسينا وبك أصبحنا* وبك نحيا وبك نموت وإليك المصير.
6. *اللهم صلّ وسلم وبارك على نبينا محمد* (10 مرات).
╰┈────────────────────⊷`;

const JOKES = [
  'واحد سأل صاحبه: ليه السمك دايماً ساكت؟ قال ليه: عشان لو فتح خشمو الموية بتخش!',
  'مسطول مشى للدكتور قال ليه: يا دكتور كل ما أشرب شاي عيني بتوجعني! الدكتور قال ليه: شيل الملعقة من الكباية أول!',
  'مبرمج دخل بقالة، زوجته قالت ليه: جيب لبن ولو لقيت بيض جيب ستة. رجع بستة علب لبن وقال ليها: لقيت بيض!',
];

const QUOTES = [
  '«من سار على الدرب وصل، ومن جدّ وجد، ومن زرع حصد.»',
  '«الكلمة الطيبة صدقة، والأثر الجميل يبقى وإن غاب صاحبه.»',
  '«الهدوء قوة، وحسن الاستماع نصف الحكمة.»',
];

const TRUTHS = [
  'ما هو أكثر موقف محرج حصل لك وما زلت تتذكره حتى اليوم؟',
  'لو أُتيحت لك فرصة السفر إلى أي دولة غداً، أين ستذهب؟',
  'ما هي المهارة التي تتمنى لو كنت تتقنها منذ الصغر؟',
];

const DARES = [
  'أرسل رسالة صوتية تمدح فيها نفسك لمدة 10 ثوانٍ بجدية تامة!',
  'أرسل دعوة طيبة من قلبك لآخر شخص تحدثت معه على واتساب.',
  'اكتب رسالة كاملة بدون استخدام حرف الألف.',
];

const KNOWN_COMMANDS = new Set([
  'menu', 'اوامر', 'القائمة', 'help',
  'شيث', 'ai', 'gpt', 'gemini', 'ترجم', 'تلخيص',
  'ayah', 'ايه', 'آية', 'اذكار_الصباح', 'اذكار_المساء', 'سورة', 'surah',
  'مسابقة', 'quiz', 'ايقاف_المسابقة', 'stopquiz',
  'adduser', 'تفعيل_رقم', 'deluser', 'حذف_رقم', 'listusers', 'المفعلين',
  'setgroup', 'تثبيت_القروب', 'setbotimg', 'تغيير_الصورة', 'broadcast', 'اذاعة',
  'tiktok', 'تيك', 'ig', 'انستا', 'fb', 'فيس', 'ytmp3', 'صوت', 'ytmp4', 'يوتيوب',
  'bass', 'تضخيم', 'robot', 'روبوت', 'fast', 'سريع', 'slow', 'بطيء', 'chipmunk', 'سنجاب', 'tomp3', 'تحويل_صوت',
  'tagall', 'منشن', 'hidetag', 'مخفي', 'kick', 'طرد', 'promote', 'ترقية', 'demote', 'اعفاء', 'antilink', 'منع_الروابط', 'mute', 'قفل', 'unmute', 'فتح', 'link', 'رابط',
  'sticker', 'ملصق', 'attp', 'نص_ملصق', 'logo', 'شعار',
  'ship', 'توافق', 'rate', 'حظي', 'truth', 'سؤال', 'dare', 'تحدي', 'joke', 'نكتة', 'quote', 'حكمة',
  'id', 'ping', 'بينج', 'owner', 'المالك',
]);

const OWNER_ONLY_COMMANDS = new Set([
  'adduser', 'تفعيل_رقم', 'deluser', 'حذف_رقم', 'listusers', 'المفعلين',
  'setgroup', 'تثبيت_القروب', 'setbotimg', 'تغيير_الصورة', 'broadcast', 'اذاعة',
]);

function buildMenuPreview(uptimeSec: number): string {
  const mins = Math.floor(uptimeSec / 60);
  const secs = Math.floor(uptimeSec % 60);
  return `╭┈───〔 بوت شيث 〕┈───⊷
│ 👤 *المالك:* شيث (${OWNER_NUMBER})
│ ⏱️ *مدة التشغيل:* ${mins} دقيقة و ${secs} ثانية
│ 💠 *البادئة:* [ . ]
│ ⚙️ *إجمالي الأوامر:* 48 أمر فعّال
╰┈────────────────────⊷

╭┈───〔 🤖 الذكاء الاصطناعي - شيث 〕┈───⊷
│ ✦ .شيث | .ai | .gpt | .gemini
│ ✦ .ترجم <نص> | .تلخيص <نص>
╰┈────────────────────⊷

╭┈───〔 🕌 القسم الإسلامي والقرآن والمسابقات 〕┈───⊷
│ ✦ .ايه | .ayah (آية + تفسير + سبب النزول)
│ ✦ .اذكار_الصباح | .اذكار_المساء
│ ✦ .سورة <رقم السورة 1-114>
│ ✦ .مسابقة | .quiz | .ايقاف_المسابقة | .stopquiz
╰┈────────────────────⊷

╭┈───〔 📥 التحميل وفلاتر الصوت 〕┈───⊷
│ ✦ .تيك | .انستا | .فيس | .صوت | .يوتيوب
│ ✦ .تضخيم | .روبوت | .سريع | .بطيء | .سنجاب | .تحويل_صوت
╰┈────────────────────⊷

╭┈───〔 👥 القروبات والملصقات والترفيه 〕┈───⊷
│ ✦ .منشن | .مخفي | .طرد | .ترقية | .اعفاء | .منع_الروابط | .قفل | .فتح | .رابط
│ ✦ .ملصق | .نص_ملصق | .شعار
│ ✦ .توافق | .حظي | .سؤال | .تحدي | .نكتة | .حكمة
╰┈────────────────────⊷

╭┈───〔 🛠️ الأدوات وأوامر المالك 〕┈───⊷
│ ✦ .بينج | .id | .المالك
│ ✦ .تفعيل_رقم | .حذف_رقم | .المفعلين | .تثبيت_القروب | .تغيير_الصورة | .اذاعة
╰┈────────────────────⊷`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.floor(process.uptime()) });
  });

  app.get('/api/bot-files', (_req, res) => {
    try {
      const files = collectBotFiles(BOT_DIR, BOT_DIR);
      res.json({ files });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read bot files';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/sandbox/execute', async (req, res) => {
    const started = Date.now();
    try {
      const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      const senderNumber = String(req.body?.senderNumber || '').replace(/\D/g, '');
      const allowedUsers: string[] = Array.isArray(req.body?.allowedUsers)
        ? req.body.allowedUsers.map((n: unknown) => String(n).replace(/\D/g, '')).filter(Boolean)
        : [];
      const targetGroupId =
        typeof req.body?.targetGroupId === 'string'
          ? req.body.targetGroupId
          : '120363398120445512@g.us';
      const askedQuestions: string[] = Array.isArray(req.body?.askedQuestions)
        ? req.body.askedQuestions.map((q: unknown) => String(q)).filter(Boolean)
        : [];

      if (!rawMessage) {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      // 1. Zero Auto-Reply: must start with prefix
      if (!rawMessage.startsWith(PREFIX)) {
        return res.json({
          ignored: true,
          reason: 'Zero Auto-Reply: Message does not start with prefix "." — bot stays silent.',
        });
      }

      const withoutPrefix = rawMessage.slice(PREFIX.length).trim();
      const parts = withoutPrefix.split(/\s+/);
      const cmd = (parts.shift() || '').toLowerCase();
      const argText = parts.join(' ').trim();

      // 2. Zero Auto-Reply: unknown commands are silently ignored
      if (!KNOWN_COMMANDS.has(cmd)) {
        return res.json({
          ignored: true,
          reason: `Zero Auto-Reply: Unknown command ".${cmd}" — bot stays silent.`,
        });
      }

      // 3. Strict Access Control: Owner or Firestore allowed_users only
      const isOwner = senderNumber === OWNER_NUMBER;
      const isAllowed = isOwner || allowedUsers.includes(senderNumber);
      if (!isAllowed) {
        return res.json({
          ignored: true,
          reason: `Strict Lock: Number ${senderNumber || 'unknown'} is neither Owner (${OWNER_NUMBER}) nor in Firestore allowed_users — command ignored.`,
        });
      }

      if (OWNER_ONLY_COMMANDS.has(cmd) && !isOwner) {
        return res.json({
          ignored: true,
          reason: `Owner-Only Guard: ".${cmd}" is restricted strictly to Owner (${OWNER_NUMBER}) — command ignored.`,
        });
      }

      // 4. Execute Command
      if (['menu', 'اوامر', 'القائمة', 'help'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'image',
          caption: buildMenuPreview(process.uptime()),
          latencyMs: Date.now() - started,
        });
      }

      if (['شيث', 'ai', 'gpt', 'gemini'].includes(cmd)) {
        if (!argText) {
          return res.json({
            ignored: false,
            type: 'text',
            text: 'حبابك يا زول! اكتب سؤالك بعد الأمر، مثال:\n`.شيث كيف أتعلم البرمجة؟`',
            latencyMs: Date.now() - started,
          });
        }
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: argText,
          config: {
            systemInstruction: SHETH_SYSTEM_INSTRUCTION,
          },
        });
        return res.json({
          ignored: false,
          type: 'text',
          text: (response.text || '').trim(),
          latencyMs: Date.now() - started,
        });
      }

      if (cmd === 'ترجم') {
        if (!argText) {
          return res.json({
            ignored: false,
            type: 'text',
            text: '❌ اكتب النص المراد ترجمته بعد الأمر `.ترجم`',
            latencyMs: Date.now() - started,
          });
        }
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: argText,
          config: {
            systemInstruction:
              'أنت مترجم محترف. إذا كان النص بالعربية ترجمه إلى الإنجليزية، وإذا كان بأي لغة أخرى ترجمه إلى العربية الفصحى السليمة. أعد الترجمة فقط بدون أي مقدمات.',
          },
        });
        return res.json({
          ignored: false,
          type: 'text',
          text: `🌐 *الترجمة:*\n${(response.text || '').trim()}`,
          latencyMs: Date.now() - started,
        });
      }

      if (cmd === 'تلخيص') {
        if (!argText) {
          return res.json({
            ignored: false,
            type: 'text',
            text: '❌ أرسل النص المراد تلخيصه بعد الأمر `.تلخيص`',
            latencyMs: Date.now() - started,
          });
        }
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: argText,
          config: {
            systemInstruction:
              'لخّص النص التالي باللغة العربية الفصحى في نقاط مختصرة جداً وواضحة (3 إلى 5 نقاط كحد أقصى) بدون مقدمات.',
          },
        });
        return res.json({
          ignored: false,
          type: 'text',
          text: `📝 *الملخص المختصر:*\n${(response.text || '').trim()}`,
          latencyMs: Date.now() - started,
        });
      }

      if (['ayah', 'ايه', 'آية'].includes(cmd)) {
        const randomNum = Math.floor(Math.random() * 6236) + 1;
        const apiRes = await fetch(`https://api.alquran.cloud/v1/ayah/${randomNum}/ar.asad`);
        if (!apiRes.ok) {
          throw new Error(`AlQuran Cloud API responded with status ${apiRes.status}`);
        }
        const json = (await apiRes.json()) as {
          data?: { text?: string; numberInSurah?: number; surah?: { name?: string } };
        };
        const ayahText = json.data?.text || '';
        const surahName = json.data?.surah?.name || '';
        const numberInSurah = json.data?.numberInSurah || 1;

        const ai = getAiClient();
        const prompt = `الآية الكريمة: "${ayahText}" (سورة ${surahName}، الآية ${numberInSurah}).
اكتب بالضبط بهذا التنسيق دون أي مقدمات أو حشو:
📖 *التفسير المختصر:*
(سطران قصيران واضحان ودقيقان فقط)

📜 *سبب النزول:*
(سطران قصيران فقط؛ وإن لم يرد سبب نزول خاص صحيح فاذكر ذلك بإيجاز مع السياق العام).`;

        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction:
              'أنت باحث متخصص في التفسير وعلوم القرآن. التزم بالدقة العلمية، العربية الفصحى النقية، والإيجاز الشديد بدون أي حشو.',
          },
        });

        const formatted =
          `╭┈───〔 🕌 آية وتفسير 〕┈───⊷\n\n` +
          `﴿ ${ayahText} ﴾\n` +
          `— *${surahName} | الآية ${numberInSurah}*\n\n` +
          `${(geminiRes.text || '').trim()}\n\n` +
          `╰┈────────────────────⊷`;

        return res.json({
          ignored: false,
          type: 'text',
          text: formatted,
          latencyMs: Date.now() - started,
        });
      }

      if (cmd === 'اذكار_الصباح') {
        return res.json({ ignored: false, type: 'text', text: ADHKAR_SABAH, latencyMs: Date.now() - started });
      }
      if (cmd === 'اذكار_المساء') {
        return res.json({ ignored: false, type: 'text', text: ADHKAR_MASAA, latencyMs: Date.now() - started });
      }
      if (['سورة', 'surah'].includes(cmd)) {
        const num = parseInt(parts[0] || '', 10);
        if (Number.isNaN(num) || num < 1 || num > 114) {
          return res.json({
            ignored: false,
            type: 'text',
            text: '❌ يرجى إدخال رقم سورة صحيح بين 1 و 114.\nمثال: `.سورة 18`',
            latencyMs: Date.now() - started,
          });
        }
        const padded = String(num).padStart(3, '0');
        const surahName = SURAH_NAMES[num - 1];
        const audioUrl = `https://server8.mp3quran.net/afs/${padded}.mp3`;
        return res.json({
          ignored: false,
          type: 'audio',
          text: `🕌 تلاوة *سورة ${surahName}* بصوت الشيخ مشاري العفاسي`,
          audioUrl,
          latencyMs: Date.now() - started,
        });
      }

      if (['مسابقة', 'quiz'].includes(cmd)) {
        const ai = getAiClient();
        const categories = [
          'القرآن الكريم وعلومه',
          'السيرة النبوية الشريفة',
          'قصص الأنبياء والمرسلين',
          'الصحابة والتابعين',
          'التاريخ الإسلامي',
        ];
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const historyBlock = askedQuestions.length
          ? `\nتجنب تماماً تكرار هذه الأسئلة السابقة:\n- ${askedQuestions.slice(-100).join('\n- ')}`
          : '';

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `أنشئ سؤالاً ثقافياً إسلامياً دقيقاً وممتعاً بالعربية في مجال "${cat}" مع 4 خيارات مميزة، وإجابة واحدة صحيحة (correctIndex من 0 إلى 3)، وشرح مختصر في سطر أو سطرين فقط.${historyBlock}`,
          config: {
            systemInstruction:
              'أنت متخصص في الثقافة الإسلامية. أعد JSON صارماً يحتوي على question, options (4 خيارات), correctIndex (0-3), explanation (سطر أو سطرين).',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ['question', 'options', 'correctIndex', 'explanation'],
            },
          },
        });

        const parsed = JSON.parse((response.text || '{}').trim()) as {
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
        };

        return res.json({
          ignored: false,
          type: 'poll',
          poll: {
            question: parsed.question,
            options: parsed.options.slice(0, 4),
            correctIndex: parsed.correctIndex,
            explanation: parsed.explanation,
          },
          latencyMs: Date.now() - started,
        });
      }

      if (['ايقاف_المسابقة', 'stopquiz'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: '🛑 *تم إيقاف المسابقة الإسلامية في القروب.*',
          mutation: { action: 'stopquiz' },
          latencyMs: Date.now() - started,
        });
      }

      if (['adduser', 'تفعيل_رقم'].includes(cmd)) {
        const target = (parts[0] || '').replace(/\D/g, '');
        if (!target || target.length < 8) {
          return res.json({
            ignored: false,
            type: 'text',
            text: '❌ يرجى كتابة الرقم مع رمز الدولة.\nمثال: `.adduser 249912345678`',
            latencyMs: Date.now() - started,
          });
        }
        return res.json({
          ignored: false,
          type: 'text',
          text: `✅ تم تفعيل الرقم بنجاح وإضافته إلى القائمة المسموحة:\n📱 \`${target}\``,
          mutation: { action: 'adduser', number: target },
          latencyMs: Date.now() - started,
        });
      }

      if (['deluser', 'حذف_رقم'].includes(cmd)) {
        const target = (parts[0] || '').replace(/\D/g, '');
        if (!target || target.length < 8) {
          return res.json({
            ignored: false,
            type: 'text',
            text: '❌ يرجى كتابة الرقم المراد حذفه.\nمثال: `.deluser 249912345678`',
            latencyMs: Date.now() - started,
          });
        }
        return res.json({
          ignored: false,
          type: 'text',
          text: `🗑️ تم حذف الرقم \`${target}\` من قائمة المفعلين بنجاح.`,
          mutation: { action: 'deluser', number: target },
          latencyMs: Date.now() - started,
        });
      }

      if (['listusers', 'المفعلين'].includes(cmd)) {
        const listLines = allowedUsers.length
          ? allowedUsers.map((n, idx) => `${idx + 1}. \`${n}\``).join('\n')
          : '— لا توجد أرقام إضافية مفعلة حالياً.';
        return res.json({
          ignored: false,
          type: 'text',
          text:
            `╭┈───〔 قائمة المفعلين 〕┈───⊷\n` +
            `│ 👑 المالك: \`${OWNER_NUMBER}\`\n` +
            `│ 👥 عدد المفعلين: ${allowedUsers.length}\n` +
            `├┈──────────────────⊷\n` +
            `${listLines}\n` +
            `╰┈──────────────────⊷`,
          latencyMs: Date.now() - started,
        });
      }

      if (['setgroup', 'تثبيت_القروب'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: `✅ *تم تثبيت القروب في Firestore!*\n🕌 الآيات اليومية: 06:00 AM و 06:00 PM (Africa/Khartoum)\n🆔 المعرّف: \`${targetGroupId}\``,
          latencyMs: Date.now() - started,
        });
      }

      if (['ping', 'بينج'].includes(cmd)) {
        const ms = Math.max(4, Date.now() - started);
        return res.json({
          ignored: false,
          type: 'text',
          text: `╭┈───〔 ⚡ حالة بوت شيث 〕┈───⊷\n│ 🏓 *الاستجابة:* ${ms} ms\n│ ⏱️ *مدة التشغيل:* ${Math.floor(process.uptime())} ثانية\n╰┈────────────────────⊷`,
          latencyMs: ms,
        });
      }

      if (cmd === 'id') {
        return res.json({
          ignored: false,
          type: 'text',
          text: `🆔 *معرّف المحادثة:* \`${targetGroupId}\`\n👤 *معرّفك:* \`${senderNumber}@s.whatsapp.net\``,
          latencyMs: Date.now() - started,
        });
      }

      if (['owner', 'المالك'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: `👑 *مالك البوت:* شيث\n📱 *الرقم:* +${OWNER_NUMBER}`,
          latencyMs: Date.now() - started,
        });
      }

      if (['joke', 'نكتة'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: `😂 *نكتة:*\n${JOKES[Math.floor(Math.random() * JOKES.length)]}`,
          latencyMs: Date.now() - started,
        });
      }

      if (['quote', 'حكمة'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: `✨ *حكمة اليوم:*\n${QUOTES[Math.floor(Math.random() * QUOTES.length)]}`,
          latencyMs: Date.now() - started,
        });
      }

      if (['truth', 'سؤال'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: `❓ *سؤال صراحة:*\n${TRUTHS[Math.floor(Math.random() * TRUTHS.length)]}`,
          latencyMs: Date.now() - started,
        });
      }

      if (['dare', 'تحدي'].includes(cmd)) {
        return res.json({
          ignored: false,
          type: 'text',
          text: `🔥 *تحدي اليوم:*\n${DARES[Math.floor(Math.random() * DARES.length)]}`,
          latencyMs: Date.now() - started,
        });
      }

      if (['rate', 'حظي'].includes(cmd)) {
        const score = Math.floor(Math.random() * 101);
        return res.json({
          ignored: false,
          type: 'text',
          text: `🎲 تقييم ${argText || 'حظك اليوم'}: *${score}%*`,
          latencyMs: Date.now() - started,
        });
      }

      if (['ship', 'توافق'].includes(cmd)) {
        const p1 = parts[0] || `@${senderNumber}`;
        const p2 = parts[1] || 'الشخص المميز';
        const score = Math.floor(Math.random() * 101);
        const bars = Math.round(score / 10);
        return res.json({
          ignored: false,
          type: 'text',
          text: `╭┈───〔 💫 مقياس التوافق 〕┈───⊷\n│ ${p1} ❤️ ${p2}\n│ النسبة: *${score}%*\n│ [${'█'.repeat(bars)}${'░'.repeat(10 - bars)}]\n╰┈────────────────────⊷`,
          latencyMs: Date.now() - started,
        });
      }

      return res.json({
        ignored: false,
        type: 'text',
        text: `✅ الأمر \`.${cmd}\` مسجّل وجاهز للعمل على اتصال WhatsApp الحقيقي (يتطلب وسائط أو جلسة Baileys نشطة على الخادم).`,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected server error';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sheth Bot Studio running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
