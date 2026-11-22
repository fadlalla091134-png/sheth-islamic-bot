'use strict';

const { cleanPhoneNumber, getMentionedJids } = require('../lib/helpers');

const TRUTHS = [
  'ما هو أكثر موقف محرج حصل لك وما زلت تتذكره حتى اليوم؟',
  'لو أُتيحت لك فرصة السفر إلى أي دولة غداً، أين ستذهب؟',
  'ما هي العادة التي تتمنى التخلص منها هذه السنة؟',
  'من هو أكثر شخص تلجأ إليه عندما تكون متضايقاً؟',
  'ما هو أجمل حلم تتمنى تحقيقه في حياتك؟',
  'هل سبق وأرسلت رسالة للشخص الخطأ؟ وماذا حدث؟',
  'ما هي المهارة التي تتمنى لو كنت تتقنها منذ الصغر؟',
];

const DARES = [
  'أرسل رسالة صوتية تمدح فيها نفسك لمدة 10 ثوانٍ بجدية تامة!',
  'غيّر صورتك الشخصية إلى صورة قطة لمدة ساعة.',
  'اكتب آخر جملة قلتها في حياتك الواقعية قبل دقيقة هنا في القروب.',
  'أرسل دعوة طيبة من قلبك لآخر شخص تحدثت معه على واتساب.',
  'اكتب رسالة كاملة بدون استخدام حرف الألف (أ/ا).',
  'امدح العضو الذي أرسل قبلك بثلاث صفات جميلة.',
];

const JOKES = [
  'واحد سأل صاحبه: ليه السمك دايماً ساكت؟ قال ليه: عشان لو فتح خشمو الموية بتخش!',
  'مسطول مشى للدكتور قال ليه: يا دكتور كل ما أشرب شاي عيني بتوجعني! الدكتور قال ليه: شيل الملعقة من الكباية أول!',
  'أستاذ سأل طالب: ما هي عاصمة فرنسا؟ قال ليه: باريس. قال ليه: ممتاز، ومن يحكمها؟ قال ليه: الباريسيين!',
  'واحد اشترى ساعة ذكية، سألوه: كيف الساعة معاك؟ قال: والله ذكية شديد، كل ما أنوم بتقول لي قوم اشتغل!',
  'مبرمج دخل بقالة، زوجته قالت ليه: جيب لبن ولو لقيت بيض جيب ستة. رجع بستة علب لبن وقال ليها: لقيت بيض!',
];

const QUOTES = [
  '«من سار على الدرب وصل، ومن جدّ وجد، ومن زرع حصد.»',
  '«لا تؤجل عمل اليوم إلى الغد، فالوقت هو أثمن ما تملك.»',
  '«الكلمة الطيبة صدقة، والأثر الجميل يبقى وإن غاب صاحبه.»',
  '«النجاح ليس عدم الفشل، بل القدرة على النهوض بعد كل تعثر.»',
  '«الهدوء قوة، وحسن الاستماع نصف الحكمة.»',
  '«اصنع من كل تحدٍّ سلّماً ترتقي به نحو هدفك.»',
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const commands = [
  {
    name: 'ship',
    aliases: ['توافق'],
    category: 'fun',
    description: 'حساب نسبة التوافق بين شخصين',
    async execute({ sock, msg, from, sender, args, reply }) {
      const mentioned = getMentionedJids(msg);
      let first = mentioned[0] ? `@${cleanPhoneNumber(mentioned[0])}` : args[0] || `@${cleanPhoneNumber(sender)}`;
      let second = mentioned[1] ? `@${cleanPhoneNumber(mentioned[1])}` : args[1] || 'الشخص المميز';

      if (mentioned.length === 1) {
        first = `@${cleanPhoneNumber(sender)}`;
        second = `@${cleanPhoneNumber(mentioned[0])}`;
      }

      const percent = Math.floor(Math.random() * 101);
      const bars = Math.round(percent / 10);
      const barStr = '█'.repeat(bars) + '░'.repeat(10 - bars);

      let comment = 'توافق جميل جداً! ✨';
      if (percent < 35) comment = 'تحتاجان لبعض التفاهم الإضافي 😄';
      else if (percent < 70) comment = 'بداية موفقة وتناغم لطيف 👍';

      const mentions = mentioned.length ? [sender, ...mentioned] : [sender];
      await sock.sendMessage(
        from,
        {
          text:
            `╭┈───〔 💫 مقياس التوافق 〕┈───⊷\n` +
            `│ ${first} ❤️ ${second}\n` +
            `│ النسبة: *${percent}%*\n` +
            `│ [${barStr}]\n` +
            `│ ${comment}\n` +
            `╰┈────────────────────⊷`,
          mentions,
        },
        { quoted: msg }
      );
    },
  },
  {
    name: 'rate',
    aliases: ['حظي'],
    category: 'fun',
    description: 'قياس نسبة حظك اليوم',
    async execute({ reply, text }) {
      const score = Math.floor(Math.random() * 101);
      const subject = text ? `*${text}*` : '*حظك اليوم*';
      let note = 'يوم استثنائي بإذن الله! 🌟';
      if (score < 35) note = 'خليك هادي اليوم وخذها ببساطة ☕';
      else if (score < 70) note = 'أمورك ماشة تمام يا زول 👍';

      return reply(`🎲 تقييم ${subject}: *${score}%*\n${note}`);
    },
  },
  {
    name: 'truth',
    aliases: ['سؤال'],
    category: 'fun',
    description: 'سؤال صراحة عشوائي',
    async execute({ reply }) {
      return reply(`❓ *سؤال صراحة:*\n${pickRandom(TRUTHS)}`);
    },
  },
  {
    name: 'dare',
    aliases: ['تحدي'],
    category: 'fun',
    description: 'تحدي ممتع عشوائي',
    async execute({ reply }) {
      return reply(`🔥 *تحدي اليوم:*\n${pickRandom(DARES)}`);
    },
  },
  {
    name: 'joke',
    aliases: ['نكتة'],
    category: 'fun',
    description: 'نكتة عربية لطيفة',
    async execute({ reply }) {
      return reply(`😂 *نكتة:*\n${pickRandom(JOKES)}`);
    },
  },
  {
    name: 'quote',
    aliases: ['حكمة'],
    category: 'fun',
    description: 'حكمة ومقولة ملهمة',
    async execute({ reply }) {
      return reply(`✨ *حكمة اليوم:*\n${pickRandom(QUOTES)}`);
    },
  },
];

module.exports = {
  category: 'fun',
  commands,
};
