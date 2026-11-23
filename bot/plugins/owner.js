'use strict';

const {
  isFirebaseConfigured,
  addAllowedUser,
  removeAllowedUser,
  listAllowedUsers,
  setTargetGroupId,
  setBotImage,
  getBotConfig,
} = require('../lib/firebase');
const {
  addTargetGroup,
  addAyahGroup,
  getAyahGroups,
  getLocalAllowedUsers,
  addLocalAllowedUser,
  removeLocalAllowedUser,
  setLocalBotImage,
} = require('../lib/database');
const {
  cleanPhoneNumber,
  getQuotedMessage,
  getMentionedJids,
  downloadMediaBuffer,
  isSafePublicUrl,
} = require('../lib/helpers');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const commands = [
  {
    name: 'adduser',
    aliases: ['تفعيل_رقم'],
    category: 'owner',
    ownerOnly: true,
    description: 'إضافة رقم إلى قائمة المفعلين لاستخدام البوت',
    async execute({ sock, msg, from, args, senderNumber, reply }) {
      const quoted = getQuotedMessage(msg);
      const mentioned = getMentionedJids(msg);

      let targetRaw = args[0];
      if (!targetRaw && mentioned.length > 0) targetRaw = mentioned[0];
      if (!targetRaw && quoted?.participant) targetRaw = quoted.participant;

      const targetNumber = cleanPhoneNumber(targetRaw);
      if (!targetNumber || targetNumber.length < 8) {
        return reply('❌ يرجى كتابة الرقم مع رمز الدولة أو الرد على رسالة العضو.\nمثال: `.adduser 249912345678`');
      }

      if (isFirebaseConfigured()) {
        await addAllowedUser(targetNumber, senderNumber);
      }
      addLocalAllowedUser(targetNumber);
      return reply(`✅ تم تفعيل الرقم بنجاح وإضافته إلى القائمة المسموحة:\n📱 \`${targetNumber}\``);
    },
  },
  {
    name: 'deluser',
    aliases: ['حذف_رقم'],
    category: 'owner',
    ownerOnly: true,
    description: 'حذف رقم من قائمة المفعلين',
    async execute({ msg, args, reply }) {
      const quoted = getQuotedMessage(msg);
      const mentioned = getMentionedJids(msg);

      let targetRaw = args[0];
      if (!targetRaw && mentioned.length > 0) targetRaw = mentioned[0];
      if (!targetRaw && quoted?.participant) targetRaw = quoted.participant;

      const targetNumber = cleanPhoneNumber(targetRaw);
      if (!targetNumber || targetNumber.length < 8) {
        return reply('❌ يرجى كتابة الرقم المراد حذفه.\nمثال: `.deluser 249912345678`');
      }

      let removed = removeLocalAllowedUser(targetNumber);
      if (isFirebaseConfigured()) {
        const fbRemoved = await removeAllowedUser(targetNumber);
        removed = removed || fbRemoved;
      }
      if (!removed) {
        return reply(`ℹ️ الرقم \`${targetNumber}\` غير موجود في قائمة المفعلين.`);
      }
      return reply(`🗑️ تم حذف الرقم \`${targetNumber}\` من قائمة المفعلين بنجاح.`);
    },
  },
  {
    name: 'listusers',
    aliases: ['المفعلين'],
    category: 'owner',
    ownerOnly: true,
    description: 'عرض جميع الأرقام المفعلة في البوت',
    async execute({ reply, ownerNumber }) {
      const merged = new Set(getLocalAllowedUsers());
      if (isFirebaseConfigured()) {
        const fbUsers = await listAllowedUsers().catch(() => []);
        for (const u of fbUsers) {
          const num = cleanPhoneNumber(u.number || u.id);
          if (num) merged.add(num);
        }
      }
      const users = Array.from(merged).sort();
      if (!users.length) {
        return reply(`📋 *قائمة المفعلين فارغة حالياً.*\n👑 المالك فقط: \`${ownerNumber}\``);
      }

      const lines = users.map((num, i) => `${i + 1}. \`${num}\``).join('\n');
      return reply(
        `╭┈───〔 قائمة المفعلين 〕┈───⊷\n` +
          `│ 👑 المالك: \`${ownerNumber}\`\n` +
          `│ 👥 عدد المفعلين: ${users.length}\n` +
          `├┈──────────────────⊷\n` +
          `${lines}\n` +
          `╰┈──────────────────⊷`
      );
    },
  },
  {
    name: 'setgroup',
    aliases: ['تثبيت_القروب'],
    category: 'owner',
    ownerOnly: true,
    description: 'تثبيت القروب الحالي لإرسال الآيات القرآنية اليومية',
    async execute({ from, isGroup, reply }) {
      if (!isGroup) {
        return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      }
      if (isFirebaseConfigured()) {
        await setTargetGroupId(from);
      }
      addTargetGroup(from);
      addAyahGroup(from);
      return reply(
        `✅ *تم تثبيت هذا القروب بنجاح!*\n` +
          `🕌 الآيات القرآنية اليومية: 6:00 صباحاً و 6:00 مساءً (Africa/Khartoum).\n` +
          `🏆 المسابقة الإسلامية التلقائية: 8:00 مساءً يومياً (Africa/Khartoum).\n` +
          `🆔 المعرّف: \`${from}\``
      );
    },
  },
  {
    name: 'setbotimg',
    aliases: ['تغيير_الصورة'],
    category: 'owner',
    ownerOnly: true,
    description: 'تغيير صورة القائمة الرسمية للبوت بالرد على صورة أو إرسال رابط مباشر',
    async execute({ msg, args, reply }) {
      const quoted = getQuotedMessage(msg);
      const imageNode = msg.message?.imageMessage || quoted?.message?.imageMessage;

      if (imageNode) {
        const buffer = await downloadMediaBuffer(imageNode, 'image');
        // Firestore document field safety check (keep under ~700KB raw => ~930KB base64)
        if (buffer.length > 700 * 1024) {
          return reply(
            '⚠️ حجم الصورة كبير جداً للتخزين المباشر (الحد الأقصى 700KB).\nيرجى إرسال صورة أخف حجماً أو إرسال رابط صورة مباشر بعد الأمر: `.setbotimg https://...`'
          );
        }
        const mimeType = imageNode.mimetype || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
        if (isFirebaseConfigured()) {
          await setBotImage(dataUri);
        }
        setLocalBotImage(dataUri);
        return reply('✅ تم تحديث صورة قائمة البوت الرسمية وحفظها في قاعدة البيانات بنجاح.');
      }

      const urlArg = args[0];
      if (urlArg && isSafePublicUrl(urlArg)) {
        if (isFirebaseConfigured()) {
          await setBotImage(urlArg);
        }
        setLocalBotImage(urlArg);
        return reply('✅ تم حفظ رابط صورة قائمة البوت الرسمية بنجاح.');
      }

      return reply('❌ يرجى الرد على صورة بالأمر `.setbotimg` أو إرفاق رابط صورة مباشر بعد الأمر.');
    },
  },
  {
    name: 'broadcast',
    aliases: ['اذاعة'],
    category: 'owner',
    ownerOnly: true,
    description: 'إرسال رسالة إذاعية لجميع المفعلين والقروب المثبت',
    async execute({ sock, text, reply }) {
      if (!text) {
        return reply('❌ يرجى كتابة نص الإذاعة بعد الأمر.\nمثال: `.اذاعة السلام عليكم ورحمة الله`');
      }

      const targets = new Set();
      for (const num of getLocalAllowedUsers()) {
        const cleaned = cleanPhoneNumber(num);
        if (cleaned) targets.add(`${cleaned}@s.whatsapp.net`);
      }
      for (const gid of getAyahGroups()) {
        if (gid) targets.add(gid);
      }

      if (isFirebaseConfigured()) {
        const users = await listAllowedUsers().catch(() => []);
        const config = await getBotConfig().catch(() => ({}));
        for (const u of users) {
          const num = cleanPhoneNumber(u.number || u.id);
          if (num) targets.add(`${num}@s.whatsapp.net`);
        }
        if (config.target_group_id) {
          targets.add(config.target_group_id);
        }
      }

      if (targets.size === 0) {
        return reply('⚠️ لا توجد أرقام مفعلة أو قروبات مثبتة لإرسال الإذاعة إليها.');
      }

      await reply(`📢 جاري إرسال الإذاعة إلى *${targets.size}* وجهة...`);

      const formattedMsg =
        `╭┈───〔 إعلان من بوت شيث 〕┈───⊷\n` +
        `${text}\n` +
        `╰┈────────────────────⊷`;

      let success = 0;
      let failed = 0;

      for (const jid of targets) {
        try {
          await sock.sendMessage(jid, { text: formattedMsg });
          success += 1;
          await sleep(1500);
        } catch {
          failed += 1;
        }
      }

      return reply(`✅ اكتملت الإذاعة.\n📤 تم الإرسال: ${success}\n❌ فشل: ${failed}`);
    },
  },
];

module.exports = {
  category: 'owner',
  commands,
};
