'use strict';

const axios = require('axios');
const { getAyahTafsirAndAsbab } = require('../lib/gemini');
const { isFirebaseConfigured, getBotConfig, setTargetGroupId } = require('../lib/firebase');
const { getAyahGroups, addAyahGroup, removeAyahGroup } = require('../lib/database');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
2. *المعوذات:* سورة الإخلاص والفلق والناس (3 مرات).
3. *أصبحنا وأصبح الملك لله*، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، رب أسألك خير ما في هذا اليوم وخير ما بعده، وأعوذ بك من شر ما في هذا اليوم وشر ما بعده.
4. *سيد الاستغفار:* اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي، وأبوء بذنبي فاغفر لي فإنه لا يغفر الذنوب إلا أنت.
5. *بسم الله الذي لا يضر مع اسمه شيء* في الأرض ولا في السماء وهو السميع العليم (3 مرات).
6. *رضيت بالله رباً*، وبالإسلام ديناً، وبمحمد ﷺ نبياً (3 مرات).
7. *حسبي الله لا إله إلا هو* عليه توكلت وهو رب العرش العظيم (7 مرات).
8. *سبحان الله وبحمده* (100 مرة).
╰┈────────────────────⊷`;

const ADHKAR_MASAA = `╭┈───〔 🌙 أذكار المساء 〕┈───⊷
1. *آية الكرسي:* ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾ (مرة واحدة).
2. *المعوذات:* سورة الإخلاص والفلق والناس (3 مرات).
3. *أمسينا وأمسى الملك لله*، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، رب أسألك خير ما في هذه الليلة وخير ما بعدها، وأعوذ بك من شر ما في هذه الليلة وشر ما بعدها.
4. *سيد الاستغفار:* اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي، وأبوء بذنبي فاغفر لي فإنه لا يغفر الذنوب إلا أنت.
5. *أعوذ بكلمات الله التامات* من شر ما خلق (3 مرات).
6. *بسم الله الذي لا يضر مع اسمه شيء* في الأرض ولا في السماء وهو السميع العليم (3 مرات).
7. *اللهم بك أمسينا وبك أصبحنا* وبك نحيا وبك نموت وإليك المصير.
8. *اللهم صلّ وسلم وبارك على نبينا محمد* (10 مرات).
╰┈────────────────────⊷`;

/**
 * Fetches a random Quran verse (1-6236) from AlQuran Cloud API
 * and enriches it with concise Tafsir & Asbab al-Nuzul from Gemini 2.5 Flash.
 */
async function buildRandomAyahMessage(headerTitle = 'آية اليوم') {
  const randomNumber = Math.floor(Math.random() * 6236) + 1;
  const { data } = await axios.get(
    `https://api.alquran.cloud/v1/ayah/${randomNumber}/ar.asad`,
    { timeout: 15000 }
  );

  const ayahData = data?.data;
  if (!ayahData || !ayahData.text) {
    throw new Error('Failed to fetch verse from AlQuran Cloud API');
  }

  const ayahText = ayahData.text;
  const surahName = ayahData.surah?.name || '';
  const numberInSurah = ayahData.numberInSurah || '';

  let explanation = '';
  try {
    explanation = await getAyahTafsirAndAsbab(ayahText, surahName, numberInSurah);
  } catch (err) {
    console.error('[quran] Gemini Tafsir error:', err.message);
    explanation = '📖 *التفسير:* تعذر جلب التفسير حالياً.';
  }

  return (
    `╭┈───〔 🕌 ${headerTitle} 〕┈───⊷\n\n` +
    `﴿ ${ayahText} ﴾\n` +
    `— *${surahName} | الآية ${numberInSurah}*\n\n` +
    `${explanation}\n\n` +
    `╰┈────────────────────⊷`
  );
}

/**
 * Scheduled job invoked by node-cron at 06:00 AM & 06:00 PM Africa/Khartoum.
 * Sends a random Quran verse + concise Tafsir + Asbab al-Nuzul to all chats/groups
 * activated via .تفعيل_اية (saved in ./database.json) and Firestore target_group_id.
 */
async function sendScheduledAyah(sock, label = 'الورد القرآني اليومي') {
  try {
    const targets = new Set(getAyahGroups());

    if (isFirebaseConfigured()) {
      const config = await getBotConfig().catch(() => ({}));
      if (config?.target_group_id) {
        targets.add(config.target_group_id);
      }
    }

    if (targets.size === 0) {
      console.warn('[cron:quran] No groups/chats activated via .تفعيل_اية or target_group_id. Skipping.');
      return;
    }

    const message = await buildRandomAyahMessage(label);
    let sent = 0;

    for (const jid of targets) {
      try {
        await sock.sendMessage(jid, { text: message });
        sent += 1;
        await sleep(1000);
      } catch (sendErr) {
        console.error(`[cron:quran] Failed sending to ${jid}:`, sendErr.message);
      }
    }

    console.log(`[cron:quran] Sent scheduled ayah (${label}) to ${sent}/${targets.size} chat(s).`);
  } catch (err) {
    console.error('[cron:quran] Failed to send scheduled ayah:', err.message);
  }
}

const commands = [
  {
    name: 'ayah',
    aliases: ['ايه', 'آية'],
    category: 'quran',
    description: 'جلب آية عشوائية مع التفسير المختصر وسبب النزول',
    async execute({ reply }) {
      try {
        const message = await buildRandomAyahMessage('آية وتفسير');
        return reply(message);
      } catch (err) {
        console.error('[quran:ayah] Error:', err.message);
        return reply('⚠️ تعذر جلب الآية الكريمة حالياً، حاول بعد قليل.');
      }
    },
  },
  {
    name: 'تفعيل_اية',
    aliases: ['تفعيل_آية', 'enable_ayah', 'ayah_on'],
    category: 'quran',
    description: 'تفعيل إرسال آية وتفسيرها وسبب نزولها تلقائياً الساعة 6:00 صباحاً و 6:00 مساءً بتوقيت السودان',
    async execute({ from, isGroup, reply }) {
      const added = addAyahGroup(from);
      if (isGroup && isFirebaseConfigured()) {
        await setTargetGroupId(from).catch(() => {});
      }

      const statusLine = added
        ? '✅ *تم تفعيل ميزة الآية اليومية في هذه المحادثة بنجاح!*'
        : 'ℹ️ *ميزة الآية اليومية مفعّلة مسبقاً في هذه المحادثة!*';

      return reply(
        `${statusLine}\n\n` +
          `🕌 سيتم إرسال آية قرآنية مع *تفسيرها المختصر وسبب نزولها* تلقائياً:\n` +
          `☀️ *الساعة 6:00 صباحاً*\n` +
          `🌙 *الساعة 6:00 مساءً*\n` +
          `🇸🇩 *التوقيت:* السودان (Africa/Khartoum)\n\n` +
          `للإيقاف في أي وقت أرسل: \`.ايقاف_اية\``
      );
    },
  },
  {
    name: 'ايقاف_اية',
    aliases: ['تعطيل_اية', 'ايقاف_آية', 'disable_ayah', 'ayah_off'],
    category: 'quran',
    description: 'إيقاف الإرسال التلقائي للآية اليومية في المحادثة الحالية',
    async execute({ from, reply }) {
      const removed = removeAyahGroup(from);
      if (!removed) {
        return reply('ℹ️ ميزة الآية اليومية غير مفعّلة في هذه المحادثة.');
      }
      return reply('🛑 تم إيقاف الإرسال التلقائي للآية اليومية في هذه المحادثة بنجاح.');
    },
  },
  {
    name: 'اذكار_الصباح',
    aliases: ['morning_adhkar'],
    category: 'quran',
    description: 'عرض أذكار الصباح كاملة',
    async execute({ reply }) {
      return reply(ADHKAR_SABAH);
    },
  },
  {
    name: 'اذكار_المساء',
    aliases: ['evening_adhkar'],
    category: 'quran',
    description: 'عرض أذكار المساء كاملة',
    async execute({ reply }) {
      return reply(ADHKAR_MASAA);
    },
  },
  {
    name: 'سورة',
    aliases: ['surah'],
    category: 'quran',
    description: 'إرسال تلاوة صوتية لأي سورة برقمها (1 إلى 114)',
    async execute({ sock, msg, from, args, reply }) {
      const rawNum = parseInt(args[0], 10);
      if (Number.isNaN(rawNum) || rawNum < 1 || rawNum > 114) {
        return reply('❌ يرجى إدخال رقم سورة صحيح بين 1 و 114.\nمثال: `.سورة 18` (سورة الكهف)');
      }

      const padded = String(rawNum).padStart(3, '0');
      const surahName = SURAH_NAMES[rawNum - 1] || `رقم ${rawNum}`;
      const audioUrl = `https://server8.mp3quran.net/afs/${padded}.mp3`;

      await reply(`🕌 جاري تجهيز تلاوة *سورة ${surahName}* بصوت الشيخ مشاري العفاسي...`);

      try {
        await sock.sendMessage(
          from,
          {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `سورة_${surahName}.mp3`,
            ptt: false,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[quran:surah] Error:', err.message);
        return reply(`⚠️ تعذر إرسال الملف الصوتي مباشرة، يمكنك الاستماع عبر الرابط:\n${audioUrl}`);
      }
    },
  },
];

module.exports = {
  category: 'quran',
  commands,
  buildRandomAyahMessage,
  sendScheduledAyah,
};
