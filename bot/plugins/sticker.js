'use strict';

const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { getQuotedMessage, downloadMediaBuffer } = require('../lib/helpers');

const PACK_NAME = 'بوت شيث';
const AUTHOR_NAME = 'Sheth Bot';

const commands = [
  {
    name: 'sticker',
    aliases: ['ملصق'],
    category: 'sticker',
    description: 'تحويل صورة أو فيديو قصير إلى ملصق واتساب',
    async execute({ sock, msg, from, reply }) {
      const quoted = getQuotedMessage(msg);
      const imageNode = msg.message?.imageMessage || quoted?.message?.imageMessage;
      const videoNode = msg.message?.videoMessage || quoted?.message?.videoMessage;

      if (!imageNode && !videoNode) {
        return reply('❌ يرجى الرد على صورة أو فيديو قصير (أقل من 8 ثوانٍ) بالأمر `.ملصق`');
      }

      if (videoNode && Number(videoNode.seconds || 0) > 10) {
        return reply('⚠️ الفيديو طويل جداً، يرجى استخدام فيديو مدته 10 ثوانٍ أو أقل.');
      }

      try {
        const buffer = imageNode
          ? await downloadMediaBuffer(imageNode, 'image')
          : await downloadMediaBuffer(videoNode, 'video');

        const sticker = new Sticker(buffer, {
          pack: PACK_NAME,
          author: AUTHOR_NAME,
          type: StickerTypes.FULL,
          quality: 75,
        });

        const webpBuffer = await sticker.toBuffer();
        await sock.sendMessage(from, { sticker: webpBuffer }, { quoted: msg });
      } catch (err) {
        console.error('[sticker] Error:', err.message);
        return reply('⚠️ تعذر إنشاء الملصق حالياً، جرب صورة أخرى.');
      }
    },
  },
  {
    name: 'attp',
    aliases: ['نص_ملصق'],
    category: 'sticker',
    description: 'إنشاء ملصق نصي ملون',
    async execute({ sock, msg, from, text, reply }) {
      if (!text) {
        return reply('❌ يرجى كتابة النص بعد الأمر.\nمثال: `.نص_ملصق حبابك يا زول`');
      }

      const safeText = text.slice(0, 60);

      try {
        // Generate stylized text PNG via public text-render API, then package as WhatsApp sticker
        const apiUrl = `https://api.akuari.my.id/canvas/attp?text=${encodeURIComponent(safeText)}`;
        const fallbackUrl = `https://dummyimage.com/512x512/0f172a/fbbf24.png&text=${encodeURIComponent(safeText)}`;

        let imgBuffer;
        try {
          const res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 12000 });
          imgBuffer = Buffer.from(res.data);
        } catch {
          const res = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 12000 });
          imgBuffer = Buffer.from(res.data);
        }

        const sticker = new Sticker(imgBuffer, {
          pack: PACK_NAME,
          author: AUTHOR_NAME,
          type: StickerTypes.FULL,
          quality: 80,
        });

        const webpBuffer = await sticker.toBuffer();
        await sock.sendMessage(from, { sticker: webpBuffer }, { quoted: msg });
      } catch (err) {
        console.error('[sticker:attp] Error:', err.message);
        return reply('⚠️ تعذر توليد الملصق النصي حالياً، حاول مرة أخرى.');
      }
    },
  },
  {
    name: 'logo',
    aliases: ['شعار'],
    category: 'sticker',
    description: 'تصميم شعار نصي مزخرف',
    async execute({ sock, msg, from, text, reply }) {
      if (!text) {
        return reply('❌ يرجى كتابة الاسم أو النص المطلوب للشعار.\nمثال: `.شعار شيث`');
      }

      const safeText = text.slice(0, 40);
      await reply('🎨 جاري تصميم الشعار...');

      try {
        const endpoints = [
          `https://api.ryzendesu.vip/api/ephoto/luxurygold?text=${encodeURIComponent(safeText)}`,
          `https://api.akuari.my.id/ephoto/luxurygold?text=${encodeURIComponent(safeText)}`,
        ];

        let imageBuffer = null;
        for (const endpoint of endpoints) {
          try {
            const res = await axios.get(endpoint, {
              responseType: 'arraybuffer',
              timeout: 15000,
            });
            const contentType = res.headers['content-type'] || '';
            if (contentType.startsWith('image/')) {
              imageBuffer = Buffer.from(res.data);
              break;
            }
          } catch {
            // Try next endpoint
          }
        }

        if (!imageBuffer) {
          const fallback = await axios.get(
            `https://dummyimage.com/1024x512/0b132b/eab308.png&text=${encodeURIComponent(safeText)}`,
            { responseType: 'arraybuffer', timeout: 12000 }
          );
          imageBuffer = Buffer.from(fallback.data);
        }

        await sock.sendMessage(
          from,
          {
            image: imageBuffer,
            caption: `✨ *شعار:* ${safeText}`,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[sticker:logo] Error:', err.message);
        return reply('⚠️ تعذر إنشاء الشعار حالياً، حاول بعد قليل.');
      }
    },
  },
];

module.exports = {
  category: 'sticker',
  commands,
};
