'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

/**
 * Strips non-digit characters from a phone number or JID.
 */
function cleanPhoneNumber(input) {
  if (!input) return '';
  const withoutDomain = String(input).split('@')[0].split(':')[0];
  return withoutDomain.replace(/\D/g, '');
}

/**
 * Extracts readable text content from a Baileys WAMessage.
 */
function extractMessageText(msg) {
  const m = msg?.message;
  if (!m) return '';
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.documentMessage?.caption) return m.documentMessage.caption;
  if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
  if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return m.listResponseMessage.singleSelectReply.selectedRowId;
  }
  if (m.ephemeralMessage?.message) {
    return extractMessageText({ message: m.ephemeralMessage.message });
  }
  if (m.viewOnceMessage?.message) {
    return extractMessageText({ message: m.viewOnceMessage.message });
  }
  if (m.viewOnceMessageV2?.message) {
    return extractMessageText({ message: m.viewOnceMessageV2.message });
  }
  return '';
}

/**
 * Returns the quoted message object if the current message replies to another message.
 */
function getQuotedMessage(msg) {
  const m = msg?.message;
  if (!m) return null;
  const ctx =
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.audioMessage?.contextInfo ||
    m.stickerMessage?.contextInfo ||
    m.documentMessage?.contextInfo;
  if (!ctx || !ctx.quotedMessage) return null;
  return {
    message: ctx.quotedMessage,
    participant: ctx.participant,
    stanzaId: ctx.stanzaId,
    mentionedJid: ctx.mentionedJid || [],
  };
}

/**
 * Returns mentioned JIDs in a message.
 */
function getMentionedJids(msg) {
  const m = msg?.message;
  if (!m) return [];
  return (
    m.extendedTextMessage?.contextInfo?.mentionedJid ||
    m.imageMessage?.contextInfo?.mentionedJid ||
    m.videoMessage?.contextInfo?.mentionedJid ||
    []
  );
}

/**
 * Downloads media buffer from a Baileys media message node.
 */
async function downloadMediaBuffer(mediaNode, mediaType) {
  const stream = await downloadContentFromMessage(mediaNode, mediaType);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Formats process uptime in readable Arabic.
 */
function formatUptimeArabic(seconds) {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  parts.push(`${secs} ثانية`);
  return parts.join(' و ');
}

/**
 * Validates that a user-supplied URL is a public http/https URL and does not point to
 * loopback, private RFC1918, or link-local metadata addresses.
 */
function isSafePublicUrl(rawUrl, allowedHostPatterns = []) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const blockedHosts = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^::1$/,
      /^\[::1\]$/,
      /^172\.(1[6-9]|2\d|3[0-1])\./,
      /^fc00:/i,
      /^fe80:/i,
    ];
    if (blockedHosts.some((re) => re.test(host))) {
      return false;
    }
    if (allowedHostPatterns.length > 0) {
      return allowedHostPatterns.some((pattern) => pattern.test(host));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a safe temporary file path inside os.tmpdir().
 */
function createTempPath(extension) {
  const safeExt = String(extension || 'tmp').replace(/[^a-zA-Z0-9]/g, '');
  const filename = `sheth_${crypto.randomBytes(10).toString('hex')}.${safeExt}`;
  return path.join(os.tmpdir(), filename);
}

/**
 * Safely deletes temporary files if they exist.
 */
function cleanupFiles(...paths) {
  for (const filePath of paths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

module.exports = {
  cleanPhoneNumber,
  extractMessageText,
  getQuotedMessage,
  getMentionedJids,
  downloadMediaBuffer,
  formatUptimeArabic,
  isSafePublicUrl,
  createTempPath,
  cleanupFiles,
};
