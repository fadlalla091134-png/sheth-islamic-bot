'use strict';

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'database.json');

const DEFAULT_DB = {
  target_groups: [],
  asked_questions: [],
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
      asked_questions: Array.isArray(parsed.asked_questions) ? parsed.asked_questions : [],
    };
  } catch (err) {
    console.error('[database] Failed to parse database.json, resetting structure:', err.message);
    return { ...DEFAULT_DB, target_groups: [], asked_questions: [] };
  }
}

function writeDatabase(data) {
  const safeData = {
    target_groups: Array.isArray(data.target_groups) ? data.target_groups : [],
    asked_questions: Array.isArray(data.asked_questions) ? data.asked_questions : [],
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

module.exports = {
  DB_PATH,
  readDatabase,
  writeDatabase,
  getTargetGroups,
  addTargetGroup,
  getAskedQuestions,
  addAskedQuestion,
};
