# بوت شيث (Sheth WhatsApp Bot)

A production-ready CommonJS Node.js WhatsApp bot backend powered by `@whiskeysockets/baileys`, `@google/genai` (`gemini-2.5-flash`), `firebase-admin` (Firestore cloud session & whitelist), `node-cron`, `fluent-ffmpeg`, and `wa-sticker-formatter`.

## Features

- **Cloud Session Persistence**: Baileys `creds` and Signal `keys` stored directly in Firebase Firestore (`baileys_auth`), surviving Render, Railway, Koyeb, and Docker restarts.
- **8-Digit Pairing Code Auth**: Links via `sock.requestPairingCode(BOT_NUMBER)` with zero QR scanning needed.
- **Strict Access Control**: Owner (`249905358205`) + manually whitelisted numbers in Firestore `allowed_users`. Zero auto-replies to greetings, normal messages, or unknown commands.
- **Auto-Join Target Group**: Automatically accepts invite `HHJlcgXFOEoL2zdZLL7yCp` on first connect and saves `target_group_id` to Firestore.
- **Daily Quran Verses (`Africa/Khartoum`)**: Scheduled at `06:00 AM` and `06:00 PM` with random verses from AlQuran Cloud API + concise Tafsir & Asbab al-Nuzul from Gemini 2.5 Flash.
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
   - `FIREBASE_SERVICE_ACCOUNT`: Minified single-line JSON (or Base64-encoded JSON) of your Firebase Admin Service Account.
3. Start the bot:
   ```bash
   npm start
   ```
4. Read the 8-digit pairing code printed in the console and enter it in WhatsApp under **Linked Devices -> Link with phone number**.
