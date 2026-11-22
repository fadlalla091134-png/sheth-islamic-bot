'use strict';

const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

/**
 * Encodes Baileys key identifiers so they are always valid Firestore document IDs.
 */
function encodeDocId(key) {
  return String(key).replace(/\//g, '__SLASH__').replace(/\./g, '__DOT__');
}

/**
 * Firestore-backed Baileys Authentication State.
 * Persists creds.json and Signal keys in the `baileys_auth` collection
 * so sessions survive ephemeral restarts on Render, Railway, or Docker.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} sessionId
 */
async function useFirestoreAuthState(db, sessionId = 'primary_session') {
  const sessionCollection = db
    .collection('baileys_auth')
    .doc(sessionId)
    .collection('state');

  const writeData = async (key, data) => {
    const docId = encodeDocId(key);
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await sessionCollection.doc(docId).set({
      payload: serialized,
      updatedAt: Date.now(),
    });
  };

  const readData = async (key) => {
    const docId = encodeDocId(key);
    const snap = await sessionCollection.doc(docId).get();
    if (!snap.exists) return null;
    const payload = snap.data()?.payload;
    if (!payload) return null;
    return JSON.parse(payload, BufferJSON.reviver);
  };

  const removeData = async (key) => {
    const docId = encodeDocId(key);
    await sessionCollection.doc(docId).delete();
  };

  const clearSession = async () => {
    const snap = await sessionCollection.get();
    const batchSize = 400;
    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const batch = db.batch();
      snap.docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  };

  let creds = await readData('creds');
  if (!creds) {
    creds = initAuthCreds();
    await writeData('creds', creds);
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const operations = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const docKey = `${category}-${id}`;
              if (value) {
                operations.push({ type: 'set', key: docKey, value });
              } else {
                operations.push({ type: 'delete', key: docKey });
              }
            }
          }

          // Commit in Firestore batches (max 500 ops per batch)
          const batchSize = 400;
          for (let i = 0; i < operations.length; i += batchSize) {
            const batch = db.batch();
            for (const op of operations.slice(i, i + batchSize)) {
              const ref = sessionCollection.doc(encodeDocId(op.key));
              if (op.type === 'set') {
                batch.set(ref, {
                  payload: JSON.stringify(op.value, BufferJSON.replacer),
                  updatedAt: Date.now(),
                });
              } else {
                batch.delete(ref);
              }
            }
            await batch.commit();
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
    clearSession,
  };
}

module.exports = { useFirestoreAuthState };
