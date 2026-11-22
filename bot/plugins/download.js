'use strict';

const axios = require('axios');
const { isSafePublicUrl } = require('../lib/helpers');

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

/**
 * Queries Cobalt-compatible public downloaders for IG / FB / YouTube with graceful fallback.
 */
async function fetchViaCobalt(targetUrl, options = {}) {
  const endpoints = [
    process.env.COBALT_API_URL,
    'https://api.cobalt.tools/',
  ].filter(Boolean);

  for (const endpoint of endpoints) {
    try {
      const { data } = await axios.post(
        endpoint,
        {
          url: targetUrl,
          downloadMode: options.audioOnly ? 'audio' : 'auto',
          audioFormat: 'mp3',
          videoQuality: '720',
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      if (data?.url && isSafePublicUrl(data.url)) {
        return { url: data.url, filename: data.filename || null };
      }
      if (Array.isArray(data?.picker) && data.picker[0]?.url && isSafePublicUrl(data.picker[0].url)) {
        return { url: data.picker[0].url, filename: null };
      }
    } catch {
      // Try next fallback
    }
  }
  return null;
}

const commands = [
  {
    name: 'tiktok',
    aliases: ['تيك'],
    category: 'download',
    description: 'تحميل فيديو تيك توك بدون علامة مائية',
    async execute({ sock, msg, from, args, reply }) {
      const url = args[0];
      if (
        !url ||
        !isSafePublicUrl(url, [/(^|\.)tiktok\.com$/i, /(^|\.)vm\.tiktok\.com$/i, /(^|\.)vt\.tiktok\.com$/i])
      ) {
        return reply('❌ يرجى إرسال رابط تيك توك صحيح بعد الأمر.\nمثال: `.تيك https://vm.tiktok.com/...`');
      }

      await reply('⏳ جاري تحميل فيديو تيك توك بدون علامة مائية...');

      try {
        const { data } = await axios.get('https://www.tikwm.com/api/', {
          params: { url, hd: 1 },
          headers: HTTP_HEADERS,
          timeout: 20000,
        });

        const videoUrl = data?.data?.hdplay || data?.data?.play;
        if (!videoUrl || !isSafePublicUrl(videoUrl)) {
          throw new Error('No playable TikTok stream returned');
        }

        const title = data?.data?.title ? `🎵 ${data.data.title}` : '✅ تم التحميل بواسطة بوت شيث';
        await sock.sendMessage(
          from,
          {
            video: { url: videoUrl },
            caption: title,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[download:tiktok] Error:', err.message);
        return reply('⚠️ تعذر تحميل فيديو تيك توك حالياً، تأكد من أن الرابط عام وحاول مجدداً.');
      }
    },
  },
  {
    name: 'ig',
    aliases: ['انستا'],
    category: 'download',
    description: 'تحميل ريلز أو فيديو أو صورة من إنستغرام',
    async execute({ sock, msg, from, args, reply }) {
      const url = args[0];
      if (!url || !isSafePublicUrl(url, [/(^|\.)instagram\.com$/i, /(^|\.)instagr\.am$/i])) {
        return reply('❌ يرجى إرسال رابط إنستغرام صحيح.\nمثال: `.انستا https://www.instagram.com/reel/...`');
      }

      await reply('⏳ جاري تحميل الوسائط من إنستغرام...');

      try {
        let mediaUrl = null;
        const cobaltResult = await fetchViaCobalt(url);
        if (cobaltResult?.url) {
          mediaUrl = cobaltResult.url;
        } else {
          const { data } = await axios.get('https://api.ryzendesu.vip/api/downloader/igdl', {
            params: { url },
            headers: HTTP_HEADERS,
            timeout: 20000,
          });
          const first = Array.isArray(data?.data) ? data.data[0] : null;
          if (first?.url && isSafePublicUrl(first.url)) {
            mediaUrl = first.url;
          }
        }

        if (!mediaUrl) {
          throw new Error('Instagram media not found');
        }

        await sock.sendMessage(
          from,
          {
            video: { url: mediaUrl },
            caption: '✅ تم التحميل من إنستغرام بواسطة بوت شيث',
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[download:ig] Error:', err.message);
        return reply('⚠️ تعذر التحميل من إنستغرام حالياً، تأكد أن الحساب عام وليس خاصاً.');
      }
    },
  },
  {
    name: 'fb',
    aliases: ['فيس'],
    category: 'download',
    description: 'تحميل فيديو من فيسبوك',
    async execute({ sock, msg, from, args, reply }) {
      const url = args[0];
      if (
        !url ||
        !isSafePublicUrl(url, [/(^|\.)facebook\.com$/i, /(^|\.)fb\.watch$/i, /(^|\.)fb\.com$/i])
      ) {
        return reply('❌ يرجى إرسال رابط فيسبوك صحيح.\nمثال: `.فيس https://fb.watch/...`');
      }

      await reply('⏳ جاري تحميل الفيديو من فيسبوك...');

      try {
        let videoUrl = null;
        const cobaltResult = await fetchViaCobalt(url);
        if (cobaltResult?.url) {
          videoUrl = cobaltResult.url;
        } else {
          const { data } = await axios.get('https://api.ryzendesu.vip/api/downloader/fbdl', {
            params: { url },
            headers: HTTP_HEADERS,
            timeout: 20000,
          });
          const candidate =
            data?.data?.[0]?.url || data?.hd || data?.sd || data?.url;
          if (candidate && isSafePublicUrl(candidate)) {
            videoUrl = candidate;
          }
        }

        if (!videoUrl) {
          throw new Error('Facebook video URL unavailable');
        }

        await sock.sendMessage(
          from,
          {
            video: { url: videoUrl },
            caption: '✅ تم التحميل من فيسبوك بواسطة بوت شيث',
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[download:fb] Error:', err.message);
        return reply('⚠️ تعذر تحميل فيديو فيسبوك حالياً، تأكد من أن الفيديو عام وحاول مجدداً.');
      }
    },
  },
  {
    name: 'ytmp3',
    aliases: ['صوت'],
    category: 'download',
    description: 'تحميل الصوت MP3 من رابط يوتيوب',
    async execute({ sock, msg, from, args, reply }) {
      const url = args[0];
      if (!url || !isSafePublicUrl(url, [/(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i])) {
        return reply('❌ يرجى إرسال رابط يوتيوب صحيح.\nمثال: `.صوت https://youtu.be/...`');
      }

      await reply('⏳ جاري استخراج الصوت من يوتيوب...');

      try {
        let audioUrl = null;
        let title = 'audio';

        const cobaltResult = await fetchViaCobalt(url, { audioOnly: true });
        if (cobaltResult?.url) {
          audioUrl = cobaltResult.url;
          title = cobaltResult.filename || title;
        } else {
          const { data } = await axios.get('https://api.ryzendesu.vip/api/downloader/ytmp3', {
            params: { url },
            headers: HTTP_HEADERS,
            timeout: 25000,
          });
          if (data?.url && isSafePublicUrl(data.url)) {
            audioUrl = data.url;
            title = data?.title || title;
          }
        }

        if (!audioUrl) {
          throw new Error('YouTube audio unavailable');
        }

        await sock.sendMessage(
          from,
          {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[download:ytmp3] Error:', err.message);
        return reply('⚠️ تعذر تحميل الصوت من يوتيوب حالياً، حاول برابط آخر أو بعد قليل.');
      }
    },
  },
  {
    name: 'ytmp4',
    aliases: ['يوتيوب'],
    category: 'download',
    description: 'تحميل فيديو من رابط يوتيوب',
    async execute({ sock, msg, from, args, reply }) {
      const url = args[0];
      if (!url || !isSafePublicUrl(url, [/(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i])) {
        return reply('❌ يرجى إرسال رابط يوتيوب صحيح.\nمثال: `.يوتيوب https://youtu.be/...`');
      }

      await reply('⏳ جاري تحميل الفيديو من يوتيوب...');

      try {
        let videoUrl = null;
        let title = '✅ تم التحميل من يوتيوب بواسطة بوت شيث';

        const cobaltResult = await fetchViaCobalt(url, { audioOnly: false });
        if (cobaltResult?.url) {
          videoUrl = cobaltResult.url;
        } else {
          const { data } = await axios.get('https://api.ryzendesu.vip/api/downloader/ytmp4', {
            params: { url },
            headers: HTTP_HEADERS,
            timeout: 25000,
          });
          if (data?.url && isSafePublicUrl(data.url)) {
            videoUrl = data.url;
            if (data?.title) title = `🎬 ${data.title}`;
          }
        }

        if (!videoUrl) {
          throw new Error('YouTube video unavailable');
        }

        await sock.sendMessage(
          from,
          {
            video: { url: videoUrl },
            caption: title,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('[download:ytmp4] Error:', err.message);
        return reply('⚠️ تعذر تحميل الفيديو من يوتيوب حالياً، حاول بعد قليل.');
      }
    },
  },
];

module.exports = {
  category: 'download',
  commands,
};
