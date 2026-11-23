'use strict';

const { isFirebaseConfigured, getBotConfig } = require('../lib/firebase');
const { getLocalBotImage } = require('../lib/database');
const { formatUptimeArabic } = require('../lib/helpers');

// Clean default cover image URL (can be overridden via BOT_IMAGE_URL env or .setbotimg)
const DEFAULT_BOT_IMAGE_URL =
  process.env.BOT_IMAGE_URL ||
  'https://images.pexels.com/photos/2233416/pexels-photo-2233416.jpeg?auto=compress&cs=tinysrgb&w=1200';

/**
 * Resolves the bot menu cover image from Firestore / local database (.setbotimg) or default URL.
 */
async function resolveBotImageMedia() {
  let saved = '';
  if (isFirebaseConfigured()) {
    const config = await getBotConfig().catch(() => ({}));
    saved = config?.bot_image || '';
  }
  if (!saved) {
    saved = getLocalBotImage();
  }

  if (typeof saved === 'string' && saved.startsWith('data:image/')) {
    const base64Part = saved.split(',')[1];
    if (base64Part) {
      return Buffer.from(base64Part, 'base64');
    }
  }

  if (typeof saved === 'string' && /^https?:\/\//i.test(saved)) {
    return { url: saved };
  }

  return { url: DEFAULT_BOT_IMAGE_URL };
}

function buildMenuCaption({ prefix, ownerName, ownerNumber, uptimeStr, totalCommands }) {
  const p = prefix;
  return `╭┈───〔 بوت شيث 〕┈───⊷
│ 👤 *المالك:* ${ownerName} (${ownerNumber})
│ ⏱️ *مدة التشغيل:* ${uptimeStr}
│ 💠 *البادئة:* [ ${p} ]
│ ⚙️ *إجمالي الأوامر:* ${totalCommands} أمر فعّال
╰┈────────────────────⊷

╭┈───〔 🤖 الذكاء الاصطناعي - شيث 〕┈───⊷
│ ✦ ${p}شيث | ${p}ai | ${p}gpt | ${p}gemini
│ ✦ ${p}ترجم <نص أو بالرد>
│ ✦ ${p}تلخيص <نص أو بالرد>
╰┈────────────────────⊷

╭┈───〔 🕌 القسم الإسلامي والقرآن والمسابقات 〕┈───⊷
│ ✦ ${p}ايه | ${p}ayah (آية + تفسير + سبب النزول)
│ ✦ ${p}تفعيل_اية | ${p}ايقاف_اية (آية تلقائية 6ص و 6م)
│ ✦ ${p}اذكار_الصباح
│ ✦ ${p}اذكار_المساء
│ ✦ ${p}سورة <رقم السورة 1-114>
│ ✦ ${p}مسابقة | ${p}quiz (بدء مسابقة استطلاعات إسلامية)
│ ✦ ${p}ايقاف_المسابقة | ${p}stopquiz (إيقاف المسابقة)
╰┈────────────────────⊷

╭┈───〔 📥 التحميل والوسائط 〕┈───⊷
│ ✦ ${p}تيك | ${p}tiktok <رابط>
│ ✦ ${p}انستا | ${p}ig <رابط>
│ ✦ ${p}فيس | ${p}fb <رابط>
│ ✦ ${p}صوت | ${p}ytmp3 <رابط يوتيوب>
│ ✦ ${p}يوتيوب | ${p}ytmp4 <رابط يوتيوب>
╰┈────────────────────⊷

╭┈───〔 🎧 فلاتر الصوت 〕┈───⊷
│ ✦ ${p}تضخيم | ${p}bass (بالرد على صوت)
│ ✦ ${p}روبوت | ${p}robot
│ ✦ ${p}سريع | ${p}fast
│ ✦ ${p}بطيء | ${p}slow
│ ✦ ${p}سنجاب | ${p}chipmunk
│ ✦ ${p}تحويل_صوت | ${p}tomp3
╰┈────────────────────⊷

╭┈───〔 👥 إدارة القروبات 〕┈───⊷
│ ✦ ${p}منشن | ${p}tagall
│ ✦ ${p}مخفي | ${p}hidetag <رسالة>
│ ✦ ${p}طرد | ${p}kick <بالرد أو منشن>
│ ✦ ${p}ترقية | ${p}promote
│ ✦ ${p}اعفاء | ${p}demote
│ ✦ ${p}منع_الروابط | ${p}antilink <on/off>
│ ✦ ${p}قفل | ${p}mute
│ ✦ ${p}فتح | ${p}unmute
│ ✦ ${p}رابط | ${p}link
╰┈────────────────────⊷

╭┈───〔 🎨 الملصقات والشعارات 〕┈───⊷
│ ✦ ${p}ملصق | ${p}sticker (بالرد على صورة/فيديو)
│ ✦ ${p}نص_ملصق | ${p}attp <نص>
│ ✦ ${p}شعار | ${p}logo <نص>
╰┈────────────────────⊷

╭┈───〔 🎲 الترفيه والألعاب 〕┈───⊷
│ ✦ ${p}توافق | ${p}ship
│ ✦ ${p}حظي | ${p}rate
│ ✦ ${p}سؤال | ${p}truth
│ ✦ ${p}تحدي | ${p}dare
│ ✦ ${p}نكتة | ${p}joke
│ ✦ ${p}حكمة | ${p}quote
╰┈────────────────────⊷

╭┈───〔 🛠️ الأدوات والمالك 〕┈───⊷
│ ✦ ${p}بينج | ${p}ping | ${p}id | ${p}المالك | ${p}owner
│ ✦ ${p}تفعيل_رقم | ${p}adduser <رقم> (للمالك)
│ ✦ ${p}حذف_رقم | ${p}deluser <رقم> (للمالك)
│ ✦ ${p}المفعلين | ${p}listusers (للمالك)
│ ✦ ${p}تثبيت_القروب | ${p}setgroup (للمالك)
│ ✦ ${p}تغيير_الصورة | ${p}setbotimg (للمالك)
│ ✦ ${p}اذاعة | ${p}broadcast <رسالة> (للمالك)
╰┈────────────────────⊷`;
}

const commands = [
  {
    name: 'menu',
    aliases: ['اوامر', 'القائمة', 'help'],
    category: 'menu',
    description: 'عرض قائمة أوامر بوت شيث مع الصورة الرسمية',
    async execute({ sock, msg, from, prefix, ownerNumber, totalCommands }) {
      const ownerName = process.env.OWNER_NAME || 'شيث';
      const uptimeStr = formatUptimeArabic(process.uptime());
      const caption = buildMenuCaption({
        prefix,
        ownerName,
        ownerNumber,
        uptimeStr,
        totalCommands,
      });

      const imageMedia = await resolveBotImageMedia();

      try {
        await sock.sendMessage(
          from,
          {
            image: imageMedia,
            caption,
          },
          { quoted: msg }
        );
      } catch (err) {
        // Fallback to text if the remote cover URL is temporarily unreachable
        console.error('[menu] Image send failed, falling back to text:', err.message);
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }
    },
  },
];

module.exports = {
  category: 'menu',
  commands,
  buildMenuCaption,
};
