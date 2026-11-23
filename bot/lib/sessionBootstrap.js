'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_AUTH_DIR = path.resolve(__dirname, '..', 'session_auth');

/**
 * Validates that a JSON key is a safe single filename inside targetDir
 * (prevents path traversal like "../" or nested arbitrary paths).
 */
function resolveSafeSessionFilePath(targetDir, rawKey) {
  if (typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.includes('\0') || trimmed.includes('/') || trimmed.includes('\\')) {
    return null;
  }
  if (trimmed === '.' || trimmed === '..' || trimmed.includes('..')) {
    return null;
  }

  const baseName = path.basename(trimmed);
  if (baseName !== trimmed) return null;

  const resolvedDir = path.resolve(targetDir);
  const fullPath = path.resolve(resolvedDir, baseName);
  if (!fullPath.startsWith(resolvedDir + path.sep)) {
    return null;
  }

  return fullPath;
}

/**
 * Parses a JSON backup string (supports raw JSON or Base64-encoded JSON).
 */
function parseSessionBackupPayload(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Session backup payload is empty.');
  }

  let jsonString = trimmed;
  if (!trimmed.startsWith('{')) {
    jsonString = Buffer.from(trimmed, 'base64').toString('utf8').trim();
  }

  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Session backup JSON must be a key-value object mapping filenames to file contents.');
  }
  return parsed;
}

/**
 * Locates the session backup source:
 * 1. process.env.SESSION_BACKUP_JSON (raw or Base64 JSON — recommended for cloud deployments)
 * 2. Explicit backupFilePath option or process.env.SESSION_BACKUP_PATH
 * 3. ./session_backup.txt inside the bot root directory
 * 4. Workspace attachment fallback (../public/assets/aistudio/session_backup_a59c3a1c.txt)
 */
function loadBackupJsonSource(explicitBackupPath) {
  if (process.env.SESSION_BACKUP_JSON && process.env.SESSION_BACKUP_JSON.trim()) {
    return {
      sourceLabel: 'env:SESSION_BACKUP_JSON',
      rawText: process.env.SESSION_BACKUP_JSON,
    };
  }

  const candidatePaths = [
    explicitBackupPath,
    process.env.SESSION_BACKUP_PATH,
    path.resolve(__dirname, '..', 'session_backup.txt'),
    path.resolve(__dirname, '..', '..', 'public', 'assets', 'aistudio', 'session_backup_a59c3a1c.txt'),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return {
        sourceLabel: resolved,
        rawText: fs.readFileSync(resolved, 'utf8'),
      };
    }
  }

  return null;
}

/**
 * Restores Baileys multi-file auth state into ./session_auth from session_backup.txt (or env)
 * automatically on startup if ./session_auth does not exist or lacks creds.json.
 *
 * @param {object} [options]
 * @param {string} [options.sessionDir] Override output directory (defaults to ./session_auth)
 * @param {string} [options.backupFilePath] Override path to session_backup.txt
 */
function ensureSessionAuthFromBackup(options = {}) {
  const sessionDir = path.resolve(options.sessionDir || SESSION_AUTH_DIR);
  const credsPath = path.join(sessionDir, 'creds.json');

  // Skip extraction if session_auth already exists with creds.json
  if (fs.existsSync(sessionDir) && fs.existsSync(credsPath)) {
    console.log(`[SessionBootstrap] Existing session_auth found at ${sessionDir}. Skipping backup restore.`);
    return {
      restored: false,
      hasLocalSession: true,
      fileCount: fs.readdirSync(sessionDir).length,
      dir: sessionDir,
      source: 'existing_session_auth',
    };
  }

  const loaded = loadBackupJsonSource(options.backupFilePath);
  if (!loaded) {
    return {
      restored: false,
      hasLocalSession: false,
      fileCount: 0,
      dir: sessionDir,
      source: null,
    };
  }

  try {
    const filesMap = parseSessionBackupPayload(loaded.rawText);
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });

    let written = 0;
    let skipped = 0;

    for (const [rawFilename, rawContent] of Object.entries(filesMap)) {
      const targetPath = resolveSafeSessionFilePath(sessionDir, rawFilename);
      if (!targetPath) {
        skipped += 1;
        console.warn(`[SessionBootstrap] Skipped unsafe filename key: "${rawFilename}"`);
        continue;
      }

      const fileContent =
        typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

      fs.writeFileSync(targetPath, fileContent, { encoding: 'utf8', mode: 0o600 });
      written += 1;
    }

    const hasCreds = fs.existsSync(credsPath);
    console.log(
      `[SessionBootstrap] Restored ${written} session files into ${sessionDir} (skipped=${skipped}, creds=${hasCreds}) from ${loaded.sourceLabel}.`
    );

    return {
      restored: true,
      hasLocalSession: hasCreds,
      fileCount: written,
      skippedCount: skipped,
      dir: sessionDir,
      source: loaded.sourceLabel,
    };
  } catch (err) {
    console.error('[SessionBootstrap] Failed to restore session_auth from backup:', err.message);
    return {
      restored: false,
      hasLocalSession: fs.existsSync(credsPath),
      fileCount: 0,
      dir: sessionDir,
      source: loaded.sourceLabel,
      error: err.message,
    };
  }
}

module.exports = {
  SESSION_AUTH_DIR,
  resolveSafeSessionFilePath,
  parseSessionBackupPayload,
  ensureSessionAuthFromBackup,
};
