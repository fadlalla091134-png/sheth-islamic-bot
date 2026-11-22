'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const pino = require('pino');
const cron = require('node-cron');
const { Boom } = require('@hapi/boom');
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const {
  initFirebase,
  isUserAllowed,
  getBotConfig,
  setTargetGroupId,
} = require('./lib/firebase');
const { useFirestoreAuthState } = require('./lib/authState');
const { cleanPhoneNumber, extractMessageText } = require('./lib/helpers');
const { addTargetGroup } = require('./lib/database');
const { sendScheduledAyah } = require('./plugins/quran');
const { handleAntilink } = require('./plugins/group');
const {
  startScheduledQuizzes,
  handlePollUpdateMessage,
  handleMessagesUpdatePollVotes,
  getStoredPollMessage,
} = require('./plugins/quiz');

// =========================================================
// Configuration
// =========================================================
const PORT = Number(process.env.PORT) || 3000;
const PREFIX = process.env.PREFIX || '.';
const OWNER_NUMBER = cleanPhoneNumber(process.env.OWNER_NUMBER || '249905358205');
const BOT_NUMBER = cleanPhoneNumber(process.env.BOT_NUMBER || OWNER_NUMBER);
const DEFAULT_GROUP_INVITE_CODE = 'HHJlcgXFOEoL2zdZLL7yCp';

// =========================================================
// Express Keep-Alive Server
// =========================================================
const app = express();

app.get('/', (_req, res) => {
  res.json({
    bot: 'Sheth WhatsApp Bot (بوت شيث)',
    status: 'running',
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Keep-alive server listening on port ${PORT}`);
});

// =========================================================
// Dynamic Plugin Loader
// =========================================================
const commandMap = new Map();
const uniqueCommands = new Set();

function loadPlugins() {
  const pluginsDir = path.join(__dirname, 'plugins');
  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const mod = require(path.join(pluginsDir, file));
    const list = Array.isArray(mod.commands) ? mod.commands : [];
    for (const cmd of list) {
      uniqueCommands.add(cmd.name);
      commandMap.set(cmd.name.toLowerCase(), cmd);
      if (Array.isArray(cmd.aliases)) {
        for (const alias of cmd.aliases) {
          commandMap.set(alias.toLowerCase(), cmd);
        }
      }
    }
  }

  console.log(
    `[Plugins] Loaded ${uniqueCommands.size} commands (${commandMap.size} triggers including aliases).`
  );
}

// =========================================================
// Scheduled Quran Jobs (Africa/Khartoum - 06:00 & 18:00)
// =========================================================
let activeSock = null;
let cronInitialized = false;

function initQuranCronJobs() {
  if (cronInitialized) return;
  cronInitialized = true;

  cron.schedule(
    '0 6 * * *',
    () => {
      if (activeSock) {
        sendScheduledAyah(activeSock, 'آية الصباح اليومية');
      }
    },
    { timezone: 'Africa/Khartoum' }
  );

  cron.schedule(
    '0 18 * * *',
    () => {
      if (activeSock) {
        sendScheduledAyah(activeSock, 'آية المساء اليومية');
      }
    },
    { timezone: 'Africa/Khartoum' }
  );

  cron.schedule(
    '0 20 * * *',
    () => {
      if (activeSock) {
        startScheduledQuizzes(activeSock);
      }
    },
    { timezone: 'Africa/Khartoum' }
  );

  console.log(
    '[Cron] Scheduled daily Quran (06:00 & 18:00) and Islamic Poll Quiz (20:00) in Africa/Khartoum.'
  );
}

// =========================================================
// Auto-Join Target Group on First Connection
// =========================================================
async function ensureTargetGroupJoined(sock) {
  try {
    const config = await getBotConfig();
    if (config?.target_group_id) {
      addTargetGroup(config.target_group_id);
      console.log(`[Group] Target group already configured: ${config.target_group_id}`);
      return;
    }

    console.log(`[Group] No target_group_id found. Accepting invite ${DEFAULT_GROUP_INVITE_CODE}...`);
    let groupJid = null;
    try {
      groupJid = await sock.groupAcceptInvite(DEFAULT_GROUP_INVITE_CODE);
    } catch (acceptErr) {
      // If bot is already in the group, resolve JID via invite metadata
      console.warn('[Group] groupAcceptInvite notice:', acceptErr.message);
      const info = await sock.groupGetInviteInfo(DEFAULT_GROUP_INVITE_CODE).catch(() => null);
      if (info?.id) {
        groupJid = info.id;
      }
    }

    if (groupJid) {
      await setTargetGroupId(groupJid);
      addTargetGroup(groupJid);
      console.log(`[Group] Saved target_group_id to Firestore & database.json: ${groupJid}`);
    }
  } catch (err) {
    console.error('[Group] Auto-join target group failed:', err.message);
  }
}

// =========================================================
// Main Baileys Connection Lifecycle
// =========================================================
let pairingRequested = false;

async function startBot() {
  const db = initFirebase();
  const { state, saveCreds, clearSession } = await useFirestoreAuthState(db);
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // Pairing Code ONLY (no QR code)
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async (key) => {
      if (key?.id) {
        return getStoredPollMessage(key.id) || undefined;
      }
      return undefined;
    },
  });

  activeSock = sock;

  // Request 8-digit Pairing Code when not registered yet
  if (!sock.authState.creds.registered && !pairingRequested) {
    if (!BOT_NUMBER) {
      console.error('[Pairing] BOT_NUMBER is required in .env to request a pairing code.');
    } else {
      pairingRequested = true;
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(BOT_NUMBER);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log('\n╔══════════════════════════════════════════════╗');
          console.log('║        WHATSAPP PAIRING CODE (بوت شيث)       ║');
          console.log(`║              CODE:  ${formatted}                ║`);
          console.log('║  WhatsApp -> Linked Devices -> Phone Number  ║');
          console.log('╚══════════════════════════════════════════════╝\n');
        } catch (err) {
          pairingRequested = false;
          console.error('[Pairing] Failed to request pairing code:', err.message);
        }
      }, 3000);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      pairingRequested = false;
      console.log(`[WhatsApp] Connected as ${cleanPhoneNumber(sock.user?.id)} — بوت شيث جاهز!`);
      await ensureTargetGroupJoined(sock);
      initQuranCronJobs();
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      console.warn(`[WhatsApp] Connection closed (code=${statusCode}, loggedOut=${loggedOut}).`);

      if (loggedOut) {
        console.warn('[WhatsApp] Session logged out. Clearing Firestore auth state...');
        await clearSession().catch(() => {});
        pairingRequested = false;
      }

      setTimeout(() => startBot(), 4000);
    }
  });

  // =========================================================
  // Poll Vote Updates Listener (messages.update)
  // =========================================================
  sock.ev.on('messages.update', async (updates) => {
    try {
      await handleMessagesUpdatePollVotes(sock, updates);
    } catch (err) {
      console.error('[Router] Poll messages.update error:', err.message);
    }
  });

  // =========================================================
  // Strict Message Router (Zero Auto-Reply & Strict Whitelist)
  // =========================================================
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        const from = msg.key.remoteJid;
        if (!from || from === 'status@broadcast') continue;

        // Forward native WhatsApp Poll votes immediately to plugins/quiz.js
        if (msg.message.pollUpdateMessage) {
          await handlePollUpdateMessage(sock, msg);
          continue;
        }

        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : from;
        const senderNumber = cleanPhoneNumber(sender);
        const body = extractMessageText(msg).trim();

        // Enforce Antilink in groups where enabled (before command check)
        if (isGroup && !msg.key.fromMe && body) {
          const blocked = await handleAntilink(sock, msg, body, OWNER_NUMBER);
          if (blocked) continue;
        }

        // ZERO AUTO-REPLY: Ignore any message that does not start with the command prefix
        if (!body.startsWith(PREFIX)) continue;

        const withoutPrefix = body.slice(PREFIX.length).trim();
        if (!withoutPrefix) continue;

        const parts = withoutPrefix.split(/\s+/);
        const commandName = parts.shift().toLowerCase();
        const text = parts.join(' ').trim();

        // ZERO AUTO-REPLY: Silently ignore unknown commands
        const command = commandMap.get(commandName);
        if (!command) continue;

        // Ignore bot's own outgoing replies unless sent by the owner's linked phone
        const isOwner = senderNumber === OWNER_NUMBER || (msg.key.fromMe && BOT_NUMBER === OWNER_NUMBER);

        // STRICT COMMAND LOCK: Only Owner or Firestore `allowed_users` may execute commands
        if (!isOwner) {
          const allowed = await isUserAllowed(senderNumber).catch(() => false);
          if (!allowed) continue;
        }

        // Owner-only commands are strictly restricted to the Owner
        if (command.ownerOnly && !isOwner) continue;

        const reply = (replyText) =>
          sock.sendMessage(from, { text: String(replyText) }, { quoted: msg });

        await command.execute({
          sock,
          msg,
          from,
          sender,
          senderNumber,
          isGroup,
          isOwner,
          args: parts,
          text,
          prefix: PREFIX,
          ownerNumber: OWNER_NUMBER,
          totalCommands: uniqueCommands.size,
          reply,
        });
      } catch (err) {
        console.error('[Router] Command execution error:', err);
      }
    }
  });
}

// =========================================================
// Bootstrap
// =========================================================
loadPlugins();
startBot().catch((err) => {
  console.error('[Fatal] Failed to start Sheth Bot:', err);
  process.exit(1);
});
