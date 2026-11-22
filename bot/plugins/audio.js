'use strict';

const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const {
  getQuotedMessage,
  downloadMediaBuffer,
  createTempPath,
  cleanupFiles,
} = require('../lib/helpers');

// Whitelisted FFmpeg audio filter graphs (never built from untrusted input)
const AUDIO_FILTERS = {
  bass: ['equalizer=f=54:width_type=o:width=2:g=16'],
  robot: [
    'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75',
  ],
  fast: ['atempo=1.5'],
  slow: ['atempo=0.72'],
  chipmunk: ['asetrate=44100*1.45', 'aresample=44100', 'atempo=0.95'],
  tomp3: [],
};

function runFfmpegAudio(inputPath, outputPath, filters = []) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath).noVideo().audioCodec('libmp3lame').audioBitrate('128k');
    if (filters.length > 0) {
      cmd.audioFilters(filters);
    }
    cmd
      .format('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

async function processAudioEffect({ sock, msg, from, reply }, effectKey, labelAr) {
  const quoted = getQuotedMessage(msg);
  const audioNode = msg.message?.audioMessage || quoted?.message?.audioMessage;
  const videoNode = msg.message?.videoMessage || quoted?.message?.videoMessage;

  if (!audioNode && !videoNode) {
    return reply(`❌ يرجى الرد على رسالة صوتية أو فيديو لاستخدام تأثير *${labelAr}*.`);
  }

  const inputExt = videoNode ? 'mp4' : 'ogg';
  const inputPath = createTempPath(inputExt);
  const outputPath = createTempPath('mp3');

  await reply(`🎧 جاري معالجة الصوت (${labelAr})...`);

  try {
    const buffer = videoNode
      ? await downloadMediaBuffer(videoNode, 'video')
      : await downloadMediaBuffer(audioNode, 'audio');

    fs.writeFileSync(inputPath, buffer);
    await runFfmpegAudio(inputPath, outputPath, AUDIO_FILTERS[effectKey] || []);

    const outBuffer = fs.readFileSync(outputPath);
    await sock.sendMessage(
      from,
      {
        audio: outBuffer,
        mimetype: 'audio/mpeg',
        ptt: effectKey !== 'tomp3',
        fileName: `sheth_${effectKey}.mp3`,
      },
      { quoted: msg }
    );
  } catch (err) {
    console.error(`[audio:${effectKey}] FFmpeg error:`, err.message);
    return reply('⚠️ تعذرت معالجة الصوت. تأكد من تثبيت FFmpeg على الخادم وأن الملف سليم.');
  } finally {
    cleanupFiles(inputPath, outputPath);
  }
}

const commands = [
  {
    name: 'bass',
    aliases: ['تضخيم'],
    category: 'audio',
    description: 'تضخيم صوت الباس (Bass Boost)',
    execute: (ctx) => processAudioEffect(ctx, 'bass', 'تضخيم الباس'),
  },
  {
    name: 'robot',
    aliases: ['روبوت'],
    category: 'audio',
    description: 'تحويل الصوت إلى صوت روبوت',
    execute: (ctx) => processAudioEffect(ctx, 'robot', 'صوت روبوت'),
  },
  {
    name: 'fast',
    aliases: ['سريع'],
    category: 'audio',
    description: 'تسريع المقطع الصوتي',
    execute: (ctx) => processAudioEffect(ctx, 'fast', 'تسريع الصوت'),
  },
  {
    name: 'slow',
    aliases: ['بطيء'],
    category: 'audio',
    description: 'تبطيء المقطع الصوتي',
    execute: (ctx) => processAudioEffect(ctx, 'slow', 'تبطيء الصوت'),
  },
  {
    name: 'chipmunk',
    aliases: ['سنجاب'],
    category: 'audio',
    description: 'تحويل الصوت إلى صوت سنجاب حاد',
    execute: (ctx) => processAudioEffect(ctx, 'chipmunk', 'صوت سنجاب'),
  },
  {
    name: 'tomp3',
    aliases: ['تحويل_صوت'],
    category: 'audio',
    description: 'تحويل فيديو أو بصمة صوتية إلى ملف MP3',
    execute: (ctx) => processAudioEffect(ctx, 'tomp3', 'تحويل إلى MP3'),
  },
];

module.exports = {
  category: 'audio',
  commands,
};
