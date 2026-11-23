'use strict';

const admin = require('firebase-admin');

let dbInstance = null;

/**
 * Returns true if FIREBASE_SERVICE_ACCOUNT is provided in environment variables.
 */
function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim());
}

/**
 * Parses FIREBASE_SERVICE_ACCOUNT from raw JSON or Base64-encoded JSON string.
 */
function parseServiceAccount(raw) {
  if (!raw || !raw.trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
  }

  const trimmed = raw.trim();
  let jsonString = trimmed;

  // Support Base64-encoded service account JSON (common on Render / Railway / Fly.io)
  if (!trimmed.startsWith('{')) {
    try {
      jsonString = Buffer.from(trimmed, 'base64').toString('utf8');
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is neither valid JSON nor Base64.');
    }
  }

  const parsed = JSON.parse(jsonString);
  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

/**
 * Initializes Firebase Admin SDK once and returns the Firestore client.
 */
function initFirebase() {
  if (dbInstance) return dbInstance;

  if (!admin.apps.length) {
    const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  dbInstance = admin.firestore();
  dbInstance.settings({ ignoreUndefinedProperties: true });
  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    return initFirebase();
  }
  return dbInstance;
}

const CONFIG_DOC = () => getDb().collection('bot_config').doc('settings');
const ALLOWED_USERS_COL = () => getDb().collection('allowed_users');
const GROUP_SETTINGS_COL = () => getDb().collection('group_settings');

// ---- Whitelist Management (allowed_users) ----

async function isUserAllowed(phoneDigits) {
  if (!phoneDigits) return false;
  const doc = await ALLOWED_USERS_COL().doc(String(phoneDigits)).get();
  return doc.exists;
}

async function addAllowedUser(phoneDigits, addedBy) {
  const clean = String(phoneDigits).replace(/\D/g, '');
  if (!clean) throw new Error('Invalid phone number');
  await ALLOWED_USERS_COL().doc(clean).set(
    {
      number: clean,
      jid: `${clean}@s.whatsapp.net`,
      addedBy: String(addedBy || ''),
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return clean;
}

async function removeAllowedUser(phoneDigits) {
  const clean = String(phoneDigits).replace(/\D/g, '');
  if (!clean) throw new Error('Invalid phone number');
  const ref = ALLOWED_USERS_COL().doc(clean);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

async function listAllowedUsers() {
  const snap = await ALLOWED_USERS_COL().orderBy('number').get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// ---- Global Bot Config (target_group_id, bot_image) ----

async function getBotConfig() {
  const snap = await CONFIG_DOC().get();
  return snap.exists ? snap.data() : {};
}

async function setTargetGroupId(groupJid) {
  await CONFIG_DOC().set(
    {
      target_group_id: groupJid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function setBotImage(imageData) {
  await CONFIG_DOC().set(
    {
      bot_image: imageData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// ---- Per-Group Settings (Antilink) ----

async function getGroupSettings(groupJid) {
  if (!groupJid) return { antilink: false };
  const snap = await GROUP_SETTINGS_COL().doc(groupJid).get();
  return snap.exists ? snap.data() : { antilink: false };
}

async function setGroupAntilink(groupJid, enabled) {
  await GROUP_SETTINGS_COL().doc(groupJid).set(
    {
      antilink: Boolean(enabled),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

module.exports = {
  isFirebaseConfigured,
  initFirebase,
  getDb,
  isUserAllowed,
  addAllowedUser,
  removeAllowedUser,
  listAllowedUsers,
  getBotConfig,
  setTargetGroupId,
  setBotImage,
  getGroupSettings,
  setGroupAntilink,
};
