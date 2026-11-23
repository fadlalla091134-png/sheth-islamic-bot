# بوت شيث (Sheth WhatsApp Bot)

A production-ready CommonJS Node.js WhatsApp bot backend powered by `@whiskeysockets/baileys`, `@google/genai` (`gemini-2.5-flash`), `firebase-admin` (Firestore cloud session & whitelist), `node-cron`, `fluent-ffmpeg`, and `wa-sticker-formatter`.

## Features

- **Automatic `session_auth` Restore (`lib/sessionBootstrap.js`)**: On startup, if `./session_auth` does not exist, automatically parses `SESSION_BACKUP_JSON` (raw or Base64 JSON) or local `./session_backup.txt` and recreates all Baileys session files inside `./session_auth/` with strict filename validation, connecting immediately via `useMultiFileAuthState`.
- **Cloud Session Persistence**: Also supports storing Baileys `creds` and Signal `keys` in Firebase Firestore (`baileys_auth`) when `FIREBASE_SERVICE_ACCOUNT` is configured.
- **8-Digit Pairing Code Auth**: Links via `sock.requestPairingCode(BOT_NUMBER)` with zero QR scanning needed when starting fresh.
- **Strict Access Control**: Owner (`249905358205`) + manually whitelisted numbers in Firestore `allowed_users` / `./database.json`. Zero auto-replies to greetings, normal messages, or unknown commands.
- **Auto-Join Target Group**: Automatically accepts invite `HHJlcgXFOEoL2zdZLL7yCp` on first connect and saves `target_group_id`.
- **Daily Quran Verses (`Africa/Khartoum`)**: Activated in any chat/group via `.تفعيل_اية` (disable via `.ايقاف_اية`). Scheduled at `06:00 AM` and `06:00 PM` (`Africa/Khartoum`) with random verses from AlQuran Cloud API + concise Tafsir & Asbab al-Nuzul from Gemini 2.5 Flash.
- **Automated & Manual Islamic Poll Quiz (`plugins/quiz.js`)**: Scheduled daily at `08:00 PM` (`Africa/Khartoum`) for all `target_groups` in `./database.json`, plus `.مسابقة` / `.quiz` and `.ايقاف_المسابقة` / `.stopquiz`. Generates non-repeating Arabic Islamic trivia via Gemini 2.5 Flash (persisted in `asked_questions`), sends native WhatsApp Polls, decrypts votes in real time, awards `+1` to the first correct voter, announces the champion at 5 points, and auto-advances with 2-minute round timeouts.
- **Sudanese AI Persona ("شيث")**: Concise, natural, respectful Sudanese Arabic dialect responses via `.شيث` / `.ai` / `.gpt` / `.gemini`, plus `.ترجم` and `.تلخيص`.
- **Modular Plugins**: Owner controls, Arabic image menu, Quran & Adhkar, media downloaders, FFmpeg audio filters, group moderation & antilink, stickers/logos, Arabic fun games, and utilities.

## Quick Start

1. Install dependencies (ensure `ffmpeg` is installed on your host/container):
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values:
   - `BOT_NUMBER`: Phone number to link (e.g. `249905358205`, digits only).
   - `OWNER_NUMBER`: `249905358205`.
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `SESSION_BACKUP_JSON` *(recommended for cloud hosts)* or place your private `session_backup.txt` file in the bot root (already gitignored) to auto-restore `./session_auth/` on startup without re-pairing.
   - `FIREBASE_SERVICE_ACCOUNT` *(optional)*: Minified single-line JSON (or Base64-encoded JSON) of your Firebase Admin Service Account.
3. Start the bot:
   ```bash
   npm start
   ```
4. If no `session_auth` backup was provided, read the 8-digit pairing code printed in the console and enter it in WhatsApp under **Linked Devices -> Link with phone number**.
