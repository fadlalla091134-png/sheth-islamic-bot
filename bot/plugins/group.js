'use strict';

const { isFirebaseConfigured, getGroupSettings, setGroupAntilink } = require('../lib/firebase');
const { getLocalAntilink, setLocalAntilink } = require('../lib/database');
const { cleanPhoneNumber, getQuotedMessage, getMentionedJids } = require('../lib/helpers');

async function readAntilinkSetting(groupJid) {
  if (isFirebaseConfigured()) {
    const settings = await getGroupSettings(groupJid).catch(() => null);
    if (settings && typeof settings.antilink === 'boolean') return settings.antilink;
  }
  return getLocalAntilink(groupJid);
}

async function writeAntilinkSetting(groupJid, enabled) {
  setLocalAntilink(groupJid, enabled);
  if (isFirebaseConfigured()) {
    await setGroupAntilink(groupJid, enabled).catch(() => {});
  }
}

const LINK_REGEX = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[a-zA-Z0-9]+|wa\.me\/[0-9]+)/i;

async function getGroupAdminContext(sock, groupJid, senderJid) {
  const metadata = await sock.groupMetadata(groupJid);
  const participants = metadata.participants || [];
  const botNumber = cleanPhoneNumber(sock.user?.id);
  const senderNumber = cleanPhoneNumber(senderJid);

  const botParticipant = participants.find((p) => cleanPhoneNumber(p.id) === botNumber);
  const senderParticipant = participants.find((p) => cleanPhoneNumber(p.id) === senderNumber);

  const isBotAdmin = Boolean(botParticipant?.admin);
  const isSenderAdmin = Boolean(senderParticipant?.admin);

  return { metadata, participants, isBotAdmin, isSenderAdmin };
}

function resolveTargetJid(msg, args) {
  const mentioned = getMentionedJids(msg);
  if (mentioned.length > 0) return mentioned[0];
  const quoted = getQuotedMessage(msg);
  if (quoted?.participant) return quoted.participant;
  const digits = cleanPhoneNumber(args[0]);
  if (digits && digits.length >= 8) return `${digits}@s.whatsapp.net`;
  return null;
}

/**
 * Middleware called from index.js for every incoming group message.
 * Deletes links sent by non-admins when antilink is enabled for the group.
 */
async function handleAntilink(sock, msg, text, ownerNumber) {
  const from = msg.key.remoteJid;
  if (!from || !from.endsWith('@g.us') || !text || !LINK_REGEX.test(text)) {
    return false;
  }

  const antilinkEnabled = await readAntilinkSetting(from);
  if (!antilinkEnabled) return false;

  const sender = msg.key.participant || from;
  if (cleanPhoneNumber(sender) === ownerNumber) return false;

  try {
    const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
    if (isSenderAdmin || !isBotAdmin) return false;

    await sock.sendMessage(from, { delete: msg.key });
    await sock.sendMessage(from, {
      text: `🚫 يمنع إرسال الروابط في هذا القروب يا @${cleanPhoneNumber(sender)}.`,
      mentions: [sender],
    });
    return true;
  } catch (err) {
    console.error('[group:antilink] Failed to enforce:', err.message);
    return false;
  }
}

const commands = [
  {
    name: 'tagall',
    aliases: ['منشن'],
    category: 'group',
    description: 'عمل منشن لجميع أعضاء القروب',
    async execute({ sock, msg, from, isGroup, text, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const metadata = await sock.groupMetadata(from);
      const mentions = metadata.participants.map((p) => p.id);
      const header = text ? `📢 *${text}*\n\n` : '📢 *تنبيه لجميع الأعضاء:*\n\n';
      const body = mentions.map((jid) => `✦ @${cleanPhoneNumber(jid)}`).join('\n');

      await sock.sendMessage(from, { text: header + body, mentions }, { quoted: msg });
    },
  },
  {
    name: 'hidetag',
    aliases: ['مخفي'],
    category: 'group',
    description: 'إرسال منشن مخفي لجميع أعضاء القروب',
    async execute({ sock, from, isGroup, text, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const metadata = await sock.groupMetadata(from);
      const mentions = metadata.participants.map((p) => p.id);
      await sock.sendMessage(from, {
        text: text || '📢 تنبيه مهم لجميع أعضاء القروب',
        mentions,
      });
    },
  },
  {
    name: 'kick',
    aliases: ['طرد'],
    category: 'group',
    description: 'طرد عضو من القروب بالرد أو المنشن',
    async execute({ sock, msg, from, sender, isGroup, isOwner, args, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');
      if (!isBotAdmin) return reply('❌ يجب ترقية البوت كمشرف أولاً لتنفيذ هذا الأمر.');

      const target = resolveTargetJid(msg, args);
      if (!target) return reply('❌ يرجى الرد على رسالة العضو أو عمل منشن له.');

      await sock.groupParticipantsUpdate(from, [target], 'remove');
      return reply(`✅ تم طرد @${cleanPhoneNumber(target)} من القروب.`);
    },
  },
  {
    name: 'promote',
    aliases: ['ترقية'],
    category: 'group',
    description: 'ترقية عضو إلى مشرف في القروب',
    async execute({ sock, msg, from, sender, isGroup, isOwner, args, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');
      if (!isBotAdmin) return reply('❌ يجب ترقية البوت كمشرف أولاً.');

      const target = resolveTargetJid(msg, args);
      if (!target) return reply('❌ يرجى الرد على رسالة العضو أو عمل منشن له.');

      await sock.groupParticipantsUpdate(from, [target], 'promote');
      await sock.sendMessage(
        from,
        { text: `👑 تمت ترقية @${cleanPhoneNumber(target)} إلى مشرف.`, mentions: [target] },
        { quoted: msg }
      );
    },
  },
  {
    name: 'demote',
    aliases: ['اعفاء'],
    category: 'group',
    description: 'إعفاء مشرف وإعادته كعضو عادي',
    async execute({ sock, msg, from, sender, isGroup, isOwner, args, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');
      if (!isBotAdmin) return reply('❌ يجب ترقية البوت كمشرف أولاً.');

      const target = resolveTargetJid(msg, args);
      if (!target) return reply('❌ يرجى الرد على رسالة المشرف أو عمل منشن له.');

      await sock.groupParticipantsUpdate(from, [target], 'demote');
      await sock.sendMessage(
        from,
        { text: `⬇️ تم إعفاء @${cleanPhoneNumber(target)} من الإشراف.`, mentions: [target] },
        { quoted: msg }
      );
    },
  },
  {
    name: 'antilink',
    aliases: ['منع_الروابط'],
    category: 'group',
    description: 'تفعيل أو تعطيل منع الروابط في القروب',
    async execute({ sock, from, sender, isGroup, isOwner, args, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');

      const mode = (args[0] || '').toLowerCase();
      if (['on', 'تفعيل', 'تشغيل', '1'].includes(mode)) {
        await writeAntilinkSetting(from, true);
        return reply('🛡️ تم *تفعيل* نظام منع الروابط في هذا القروب.');
      }
      if (['off', 'تعطيل', 'ايقاف', '0'].includes(mode)) {
        await writeAntilinkSetting(from, false);
        return reply('🔓 تم *تعطيل* نظام منع الروابط في هذا القروب.');
      }

      const enabled = await readAntilinkSetting(from);
      return reply(
        `🛡️ حالة منع الروابط حالياً: *${enabled ? 'مفعّل ✅' : 'معطّل ❌'}*\n` +
          `للتغيير استخدم: \`.منع_الروابط تفعيل\` أو \`.منع_الروابط تعطيل\``
      );
    },
  },
  {
    name: 'mute',
    aliases: ['قفل'],
    category: 'group',
    description: 'قفل الدردشة في القروب (للمشرفين فقط)',
    async execute({ sock, from, sender, isGroup, isOwner, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');
      if (!isBotAdmin) return reply('❌ يجب ترقية البوت كمشرف أولاً.');

      await sock.groupSettingUpdate(from, 'announcement');
      return reply('🔒 تم قفل القروب بنجاح (الإرسال للمشرفين فقط).');
    },
  },
  {
    name: 'unmute',
    aliases: ['فتح'],
    category: 'group',
    description: 'فتح الدردشة لجميع أعضاء القروب',
    async execute({ sock, from, sender, isGroup, isOwner, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');
      if (!isBotAdmin) return reply('❌ يجب ترقية البوت كمشرف أولاً.');

      await sock.groupSettingUpdate(from, 'not_announcement');
      return reply('🔓 تم فتح القروب بنجاح (يمكن للجميع الإرسال الآن).');
    },
  },
  {
    name: 'link',
    aliases: ['رابط'],
    category: 'group',
    description: 'جلب رابط الدعوة الخاص بالقروب',
    async execute({ sock, from, sender, isGroup, isOwner, reply }) {
      if (!isGroup) return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      const { isBotAdmin, isSenderAdmin } = await getGroupAdminContext(sock, from, sender);
      if (!isSenderAdmin && !isOwner) return reply('❌ هذا الأمر مخصص لمشرفي القروب فقط.');
      if (!isBotAdmin) return reply('❌ يجب ترقية البوت كمشرف أولاً لجلب الرابط.');

      const code = await sock.groupInviteCode(from);
      return reply(`🔗 *رابط دعوة القروب:*\nhttps://chat.whatsapp.com/${code}`);
    },
  },
];

module.exports = {
  category: 'group',
  commands,
  handleAntilink,
};
