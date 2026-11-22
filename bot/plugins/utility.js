'use strict';

const { formatUptimeArabic } = require('../lib/helpers');

const commands = [
  {
    name: 'id',
    aliases: ['معرف'],
    category: 'utility',
    description: 'عرض معرّف الدردشة أو القروب الحالي (JID)',
    async execute({ from, sender, isGroup, reply }) {
      const lines = [
        `🆔 *معرّف المحادثة:* \`${from}\``,
        `👤 *معرّفك:* \`${sender}\``,
        `📌 *النوع:* ${isGroup ? 'قروب (Group)' : 'محادثة خاصة (Private)'}`,
      ];
      return reply(lines.join('\n'));
    },
  },
  {
    name: 'ping',
    aliases: ['بينج'],
    category: 'utility',
    description: 'قياس سرعة استجابة البوت ومدة التشغيل',
    async execute({ msg, reply }) {
      const msgTimestamp = Number(msg.messageTimestamp || 0) * 1000;
      const latency = msgTimestamp ? Math.max(1, Date.now() - msgTimestamp) : 0;
      const uptime = formatUptimeArabic(process.uptime());
      const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

      return reply(
        `╭┈───〔 ⚡ حالة بوت شيث 〕┈───⊷\n` +
          `│ 🏓 *الاستجابة:* ${latency} ms\n` +
          `│ ⏱️ *مدة التشغيل:* ${uptime}\n` +
          `│ 💾 *الذاكرة:* ${memMb} MB\n` +
          `╰┈────────────────────⊷`
      );
    },
  },
  {
    name: 'owner',
    aliases: ['المالك'],
    category: 'utility',
    description: 'عرض بيانات مالك البوت',
    async execute({ sock, msg, from, ownerNumber }) {
      const ownerName = process.env.OWNER_NAME || 'شيث';
      const vcard =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${ownerName}\n` +
        `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
        'END:VCARD';

      await sock.sendMessage(
        from,
        {
          contacts: {
            displayName: ownerName,
            contacts: [{ vcard }],
          },
        },
        { quoted: msg }
      );
    },
  },
];

module.exports = {
  category: 'utility',
  commands,
};
