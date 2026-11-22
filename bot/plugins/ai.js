'use strict';

const { askSheth, translateText, summarizeText } = require('../lib/gemini');
const { getQuotedMessage, extractMessageText } = require('../lib/helpers');

function resolveInputText(text, msg) {
  if (text && text.trim()) return text.trim();
  const quoted = getQuotedMessage(msg);
  if (quoted?.message) {
    return extractMessageText({ message: quoted.message }).trim();
  }
  return '';
}

const commands = [
  {
    name: 'شيث',
    aliases: ['ai', 'gpt', 'gemini'],
    category: 'ai',
    description: 'التحدث مع الذكاء الاصطناعي شيث باللهجة السودانية وبشكل مختصر',
    async execute({ msg, text, reply }) {
      const input = resolveInputText(text, msg);
      if (!input) {
        return reply('حبابك يا زول! اكتب سؤالك بعد الأمر، مثال:\n`.شيث كيف أتعلم البرمجة؟`');
      }

      try {
        const answer = await askSheth(input);
        return reply(answer || 'معليش يا زول، ما قدرت أجهز رد هسي، جرب تاني.');
      } catch (err) {
        console.error('[ai] Gemini error:', err.message);
        return reply('⚠️ حصلت مشكلة مؤقتة في الاتصال بالذكاء الاصطناعي، جرب بعد شوية يا زول.');
      }
    },
  },
  {
    name: 'ترجم',
    aliases: ['translate'],
    category: 'ai',
    description: 'ترجمة النصوص بدقة بين العربية واللغات الأخرى',
    async execute({ msg, text, reply }) {
      const input = resolveInputText(text, msg);
      if (!input) {
        return reply('❌ اكتب النص المراد ترجمته أو رد على رسالة بالأمر `.ترجم`');
      }

      try {
        const translated = await translateText(input);
        return reply(`🌐 *الترجمة:*\n${translated}`);
      } catch (err) {
        console.error('[ai:translate] Error:', err.message);
        return reply('⚠️ تعذرت الترجمة حالياً، حاول مرة أخرى.');
      }
    },
  },
  {
    name: 'تلخيص',
    aliases: ['summarize'],
    category: 'ai',
    description: 'تلخيص النصوص الطويلة في نقاط مختصرة',
    async execute({ msg, text, reply }) {
      const input = resolveInputText(text, msg);
      if (!input) {
        return reply('❌ أرسل النص المراد تلخيصه أو رد على رسالة طويلة بالأمر `.تلخيص`');
      }

      try {
        const summary = await summarizeText(input);
        return reply(`📝 *الملخص المختصر:*\n${summary}`);
      } catch (err) {
        console.error('[ai:summarize] Error:', err.message);
        return reply('⚠️ تعذر تلخيص النص حالياً، حاول مرة أخرى.');
      }
    },
  },
];

module.exports = {
  category: 'ai',
  commands,
};
