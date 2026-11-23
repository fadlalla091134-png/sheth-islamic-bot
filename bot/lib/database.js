'use strict';

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'database.json');

const DEFAULT_DB = {
  target_groups: [],
  ayah_groups: [],
  asked_questions: [],
  allowed_users: [],
  group_antilink: {},
  bot_image: '',
};

function ensureDatabaseFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
}

function readDatabase() {
  ensureDatabaseFile();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      target_groups: Array.isArray(parsed.target_groups) ? parsed.target_groups : [],
      ayah_groups: Array.isArray(parsed.ayah_groups) ? parsed.ayah_groups : [],
      asked_questions: Array.isArray(parsed.asked_questions) ? parsed.asked_questions : [],
      allowed_users: Array.isArray(parsed.allowed_users) ? parsed.allowed_users : [],
      group_antilink:
        parsed.group_antilink && typeof parsed.group_antilink === 'object' && !Array.isArray(parsed.group_antilink)
          ? parsed.group_antilink
          : {},
      bot_image: typeof parsed.bot_image === 'string' ? parsed.bot_image : '',
    };
  } catch (err) {
    console.error('[database] Failed to parse database.json, resetting structure:', err.message);
    return {
      target_groups: [],
      ayah_groups: [],
      asked_questions: [],
      allowed_users: [],
      group_antilink: {},
      bot_image: '',
    };
  }
}

function writeDatabase(data) {
  const safeData = {
    target_groups: Array.isArray(data.target_groups) ? data.target_groups : [],
    ayah_groups: Array.isArray(data.ayah_groups) ? data.ayah_groups : [],
    asked_questions: Array.isArray(data.asked_questions) ? data.asked_questions : [],
    allowed_users: Array.isArray(data.allowed_users) ? data.allowed_users : [],
    group_antilink:
      data.group_antilink && typeof data.group_antilink === 'object' && !Array.isArray(data.group_antilink)
        ? data.group_antilink
        : {},
    bot_image: typeof data.bot_image === 'string' ? data.bot_image : '',
  };
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(safeData, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

function getTargetGroups() {
  return readDatabase().target_groups;
}

function addTargetGroup(groupJid) {
  if (!groupJid || !String(groupJid).endsWith('@g.us')) return false;
  const db = readDatabase();
  if (!db.target_groups.includes(groupJid)) {
    db.target_groups.push(groupJid);
    writeDatabase(db);
    return true;
  }
  return false;
}

function getAyahGroups() {
  return readDatabase().ayah_groups;
}

function addAyahGroup(chatJid) {
  const cleaned = String(chatJid || '').trim();
  if (!cleaned) return false;
  const db = readDatabase();
  if (!db.ayah_groups.includes(cleaned)) {
    db.ayah_groups.push(cleaned);
    writeDatabase(db);
    return true;
  }
  return false;
}

function removeAyahGroup(chatJid) {
  const cleaned = String(chatJid || '').trim();
  if (!cleaned) return false;
  const db = readDatabase();
  const next = db.ayah_groups.filter((id) => id !== cleaned);
  if (next.length !== db.ayah_groups.length) {
    db.ayah_groups = next;
    writeDatabase(db);
    return true;
  }
  return false;
}

function getAskedQuestions() {
  return readDatabase().asked_questions;
}

function addAskedQuestion(questionText) {
  const cleaned = String(questionText || '').trim();
  if (!cleaned) return false;
  const db = readDatabase();
  if (!db.asked_questions.includes(cleaned)) {
    db.asked_questions.push(cleaned);
    writeDatabase(db);
    return true;
  }
  return false;
}

// ---- Local JSON fallback helpers (used seamlessly when Firestore is not configured) ----

function getLocalAllowedUsers() {
  return readDatabase().allowed_users;
}

function isLocalUserAllowed(phoneDigits) {
  const clean = String(phoneDigits || '').replace(/\D/g, '');
  if (!clean) return false;
  return readDatabase().allowed_users.includes(clean);
}

function addLocalAllowedUser(phoneDigits) {
  const clean = String(phoneDigits || '').replace(/\D/g, '');
  if (!clean) throw new Error('Invalid phone number');
  const db = readDatabase();
  if (!db.allowed_users.includes(clean)) {
    db.allowed_users.push(clean);
    writeDatabase(db);
  }
  return clean;
}

function removeLocalAllowedUser(phoneDigits) {
  const clean = String(phoneDigits || '').replace(/\D/g, '');
  if (!clean) throw new Error('Invalid phone number');
  const db = readDatabase();
  const next = db.allowed_users.filter((n) => n !== clean);
  if (next.length === db.allowed_users.length) return false;
  db.allowed_users = next;
  writeDatabase(db);
  return true;
}

function getLocalAntilink(groupJid) {
  if (!groupJid) return false;
  return Boolean(readDatabase().group_antilink[groupJid]);
}

function setLocalAntilink(groupJid, enabled) {
  if (!groupJid) return;
  const db = readDatabase();
  db.group_antilink[groupJid] = Boolean(enabled);
  writeDatabase(db);
}

function getLocalBotImage() {
  return readDatabase().bot_image || '';
}

function setLocalBotImage(imageData) {
  const db = readDatabase();
  db.bot_image = String(imageData || '');
  writeDatabase(db);
}

module.exports = {
  DB_PATH,
  readDatabase,
  writeDatabase,
  getTargetGroups,
  addTargetGroup,
  getAyahGroups,
  addAyahGroup,
  removeAyahGroup,
  getAskedQuestions,
  addAskedQuestion,
  getLocalAllowedUsers,
  isLocalUserAllowed,
  addLocalAllowedUser,
  removeLocalAllowedUser,
  getLocalAntilink,
  setLocalAntilink,
  getLocalBotImage,
  setLocalBotImage,
};
