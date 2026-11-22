'use strict';

const {
  decryptPollVote,
  getAggregateVotesInPollMessage,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');

const { generateIslamicQuizQuestion } = require('../lib/gemini');
const {
  getTargetGroups,
  getAskedQuestions,
  addAskedQuestion,
} = require('../lib/database');
const { cleanPhoneNumber } = require('../lib/helpers');

const WIN_SCORE = 5;
const QUESTION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes per question
const NEXT_QUESTION_DELAY_MS = 5 * 1000; // 5 seconds before next question
const MAX_CONSECUTIVE_UNANSWERED = 3;

/**
 * Active quiz state per group:
 * groupId -> {
 *   groupId: string,
 *   scores: Record<string, number>,
 *   currentPollId: string | null,
 *   pollCreationMessage: object | null,
 *   pollCreatorJid: string | null,
 *   correctOptionText: string | null,
 *   explanation: string,
 *   roundAnswered: boolean,
 *   roundNumber: number,
 *   consecutiveUnanswered: number,
 *   roundTimer: NodeJS.Timeout | null,
 *   nextQuestionTimer: NodeJS.Timeout | null,
 * }
 */
const activeQuizzes = new Map();

/**
 * In-memory lookup for sent poll creation messages (used by Baileys getMessage & decryption).
 */
const pollMessageStore = new Map();

function getStoredPollMessage(messageId) {
  return pollMessageStore.get(messageId) || null;
}

function clearQuizTimers(quiz) {
  if (!quiz) return;
  if (quiz.roundTimer) {
    clearTimeout(quiz.roundTimer);
    quiz.roundTimer = null;
  }
  if (quiz.nextQuestionTimer) {
    clearTimeout(quiz.nextQuestionTimer);
    quiz.nextQuestionTimer = null;
  }
}

function normalizeQuestionKey(text) {
  return String(text || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[؟?!.,،\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Builds a clean Arabic scoreboard text + mention list sorted by highest score.
 */
function buildScoreboard(scores) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return { text: '— لم تُسجّل أي نقاط في هذه الجولة.', mentions: [] };
  }

  const medals = ['🥇', '🥈', '🥉'];
  const mentions = [];
  const lines = entries.map(([jid, pts], idx) => {
    mentions.push(jid);
    const badge = medals[idx] || `${idx + 1}.`;
    return `${badge} @${cleanPhoneNumber(jid)} — *${pts}/${WIN_SCORE}* نقطة`;
  });

  return {
    text: lines.join('\n'),
    mentions,
  };
}

/**
 * Generates a guaranteed non-repeating Islamic question and saves it to ./database.json.
 */
async function getFreshNonRepeatingQuestion() {
  const asked = getAskedQuestions();
  const normalizedSet = new Set(asked.map(normalizeQuestionKey));

  let candidate = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const generated = await generateIslamicQuizQuestion(asked);
    const key = normalizeQuestionKey(generated.question);
    const uniqueOptions = new Set(generated.options.map((o) => o.toLowerCase()));
    if (!normalizedSet.has(key) && uniqueOptions.size === 4) {
      candidate = generated;
      break;
    }
    // Keep last valid payload as fallback if Gemini paraphrases closely
    candidate = generated;
  }

  if (!candidate) {
    throw new Error('Could not generate a valid Islamic quiz question.');
  }

  addAskedQuestion(candidate.question);
  return candidate;
}

/**
 * Schedules the next poll question after a 5-second pause.
 */
function scheduleNextRound(sock, groupId) {
  const quiz = activeQuizzes.get(groupId);
  if (!quiz) return;

  if (quiz.nextQuestionTimer) clearTimeout(quiz.nextQuestionTimer);
  quiz.nextQuestionTimer = setTimeout(() => {
    if (activeQuizzes.has(groupId)) {
      sendNextQuizQuestion(sock, groupId);
    }
  }, NEXT_QUESTION_DELAY_MS);
}

/**
 * Generates and sends the next native WhatsApp Poll question for an active group quiz.
 */
async function sendNextQuizQuestion(sock, groupId) {
  const quiz = activeQuizzes.get(groupId);
  if (!quiz) return;

  clearQuizTimers(quiz);

  try {
    const qData = await getFreshNonRepeatingQuestion();
    // Re-check quiz is still active after async Gemini call
    if (!activeQuizzes.has(groupId)) return;

    quiz.roundNumber += 1;
    quiz.roundAnswered = false;
    quiz.correctOptionText = qData.options[qData.correctIndex];
    quiz.explanation = qData.explanation;

    const pollTitle = `🕌 السؤال ${quiz.roundNumber}: ${qData.question}`;
    const sentMsg = await sock.sendMessage(groupId, {
      poll: {
        name: pollTitle,
        values: qData.options,
        selectableCount: 1,
      },
    });

    const pollId = sentMsg?.key?.id;
    const creatorJid = jidNormalizedUser(sock.user?.id || '');

    quiz.currentPollId = pollId || null;
    quiz.pollCreationMessage = sentMsg?.message || null;
    quiz.pollCreatorJid = creatorJid;

    if (pollId && sentMsg?.message) {
      pollMessageStore.set(pollId, sentMsg.message);
      // Bound in-memory store size
      if (pollMessageStore.size > 200) {
        const oldestKey = pollMessageStore.keys().next().value;
        pollMessageStore.delete(oldestKey);
      }
    }

    // 2-minute timeout per question
    quiz.roundTimer = setTimeout(async () => {
      const active = activeQuizzes.get(groupId);
      if (!active || active.currentPollId !== pollId || active.roundAnswered) return;

      active.roundAnswered = true;
      active.consecutiveUnanswered += 1;

      try {
        await sock.sendMessage(groupId, {
          text:
            `⏰ *انتهى الوقت (دقيقتان) دون إجابة صحيحة!*\n` +
            `✅ *الإجابة الصحيحة:* ${active.correctOptionText}\n` +
            `💡 *توضيح:* ${active.explanation}`,
        });

        if (active.consecutiveUnanswered >= MAX_CONSECUTIVE_UNANSWERED) {
          const board = buildScoreboard(active.scores);
          clearQuizTimers(active);
          activeQuizzes.delete(groupId);

          await sock.sendMessage(groupId, {
            text:
              `🛑 *تم إيقاف المسابقة تلقائياً لعدم التفاعل في ${MAX_CONSECUTIVE_UNANSWERED} أسئلة متتالية.*\n\n` +
              `📊 *النتائج النهائية:*\n${board.text}`,
            mentions: board.mentions,
          });
          return;
        }

        scheduleNextRound(sock, groupId);
      } catch (err) {
        console.error('[quiz] Timeout handler error:', err.message);
      }
    }, QUESTION_TIMEOUT_MS);
  } catch (err) {
    console.error(`[quiz] Failed to generate/send question for ${groupId}:`, err.message);
    try {
      await sock.sendMessage(groupId, {
        text: '⚠️ تعذر توليد السؤال التالي حالياً، تم إيقاف المسابقة مؤقتاً.',
      });
    } catch {
      // Ignore send error
    }
    clearQuizTimers(quiz);
    activeQuizzes.delete(groupId);
  }
}

/**
 * Awards point to the FIRST correct respondent and checks 5-point win condition.
 */
async function processVoterSelection(sock, groupId, pollId, voterJid, selectedOptions) {
  const quiz = activeQuizzes.get(groupId);
  if (!quiz) return;
  if (!pollId || quiz.currentPollId !== pollId) return;
  if (quiz.roundAnswered) return;
  if (!Array.isArray(selectedOptions) || !selectedOptions.length) return;

  const isCorrect = selectedOptions.some(
    (opt) => String(opt).trim() === String(quiz.correctOptionText).trim()
  );
  if (!isCorrect) return;

  // Lock the round immediately so no second person gets points
  quiz.roundAnswered = true;
  quiz.consecutiveUnanswered = 0;
  clearQuizTimers(quiz);

  const normalizedVoter = jidNormalizedUser(voterJid);
  const currentScore = (quiz.scores[normalizedVoter] || 0) + 1;
  quiz.scores[normalizedVoter] = currentScore;

  const voterNumber = cleanPhoneNumber(normalizedVoter);

  await sock.sendMessage(groupId, {
    text:
      `🎉 إجابة صحيحة يا @${voterNumber}! لك نقطة (رصيدك: ${currentScore}/${WIN_SCORE})\n` +
      `💡 *توضيح:* ${quiz.explanation}`,
    mentions: [normalizedVoter],
  });

  // 5-Point Win Condition
  if (currentScore >= WIN_SCORE) {
    const board = buildScoreboard(quiz.scores);
    const allMentions = Array.from(new Set([normalizedVoter, ...board.mentions]));

    clearQuizTimers(quiz);
    activeQuizzes.delete(groupId);

    await sock.sendMessage(groupId, {
      text:
        `╭┈───〔 🏆 بطل المسابقة الإسلامية 〕┈───⊷\n` +
        `🎊 ألف مبروك للبطل @${voterNumber} بوصوله إلى *${WIN_SCORE} نقاط*!\n\n` +
        `📊 *جدول الترتيب النهائي:*\n` +
        `${board.text}\n` +
        `╰┈────────────────────────⊷`,
      mentions: allMentions,
    });
    return;
  }

  // Otherwise wait 5 seconds and automatically send the next non-repeating Poll question
  scheduleNextRound(sock, groupId);
}

/**
 * Handles raw `pollUpdateMessage` arriving in `sock.ev.on('messages.upsert')`.
 */
async function handlePollUpdateMessage(sock, msg) {
  try {
    const pollUpdate = msg?.message?.pollUpdateMessage;
    if (!pollUpdate) return false;

    const groupId = msg.key?.remoteJid;
    if (!groupId || !activeQuizzes.has(groupId)) return false;

    const quiz = activeQuizzes.get(groupId);
    const pollCreationKey = pollUpdate.pollCreationMessageKey;
    const pollId = pollCreationKey?.id;
    if (!pollId || quiz.currentPollId !== pollId) return false;
    if (quiz.roundAnswered) return true;

    const pollCreationMsg = quiz.pollCreationMessage || getStoredPollMessage(pollId);
    const pollEncKey =
      pollCreationMsg?.messageContextInfo?.messageSecret ||
      pollCreationMsg?.pollCreationMessage?.contextInfo?.messageSecret ||
      pollCreationMsg?.pollCreationMessageV3?.contextInfo?.messageSecret;

    if (!pollEncKey || !pollUpdate.vote) {
      return false;
    }

    const voterJid = jidNormalizedUser(
      msg.key?.fromMe ? sock.user?.id : msg.key?.participant || msg.key?.remoteJid
    );
    const pollCreatorJid = jidNormalizedUser(
      pollCreationKey?.participant || quiz.pollCreatorJid || sock.user?.id
    );

    const decrypted = decryptPollVote(pollUpdate.vote, {
      pollCreatorJid,
      pollMsgId: pollId,
      pollEncKey,
      voterJid,
    });

    // Map decrypted SHA-256 option hashes back to plain option strings via Baileys aggregator
    const aggregate = getAggregateVotesInPollMessage({
      message: pollCreationMsg,
      pollUpdates: [
        {
          pollUpdateMessageKey: msg.key,
          vote: decrypted,
        },
      ],
    });

    const selectedOptions = aggregate
      .filter((entry) => Array.isArray(entry.voters) && entry.voters.length > 0)
      .map((entry) => entry.name);

    await processVoterSelection(sock, groupId, pollId, voterJid, selectedOptions);
    return true;
  } catch (err) {
    console.error('[quiz] Poll vote decryption error:', err.message);
    return false;
  }
}

/**
 * Handles `messages.update` pollUpdates events (when Baileys emits decrypted updates directly).
 */
async function handleMessagesUpdatePollVotes(sock, updates) {
  if (!Array.isArray(updates)) return;
  for (const { key, update } of updates) {
    try {
      if (!update?.pollUpdates || !key?.remoteJid) continue;
      const groupId = key.remoteJid;
      const quiz = activeQuizzes.get(groupId);
      if (!quiz || quiz.currentPollId !== key.id || quiz.roundAnswered) continue;

      const pollCreationMsg = quiz.pollCreationMessage || getStoredPollMessage(key.id);
      if (!pollCreationMsg) continue;

      const aggregate = getAggregateVotesInPollMessage({
        message: pollCreationMsg,
        pollUpdates: update.pollUpdates,
      });

      const correctBucket = aggregate.find(
        (item) => String(item.name).trim() === String(quiz.correctOptionText).trim()
      );
      if (correctBucket && Array.isArray(correctBucket.voters) && correctBucket.voters.length > 0) {
        const firstVoter = correctBucket.voters[0];
        await processVoterSelection(sock, groupId, key.id, firstVoter, [correctBucket.name]);
      }
    } catch (err) {
      console.error('[quiz] messages.update poll handler error:', err.message);
    }
  }
}

/**
 * Starts a fresh Islamic Poll Quiz Competition in the given group.
 */
async function startQuizInGroup(sock, groupId, isScheduled = false) {
  if (!groupId || !groupId.endsWith('@g.us')) {
    return { started: false, reason: 'not_group' };
  }
  if (activeQuizzes.has(groupId)) {
    return { started: false, reason: 'already_active' };
  }

  activeQuizzes.set(groupId, {
    groupId,
    scores: {},
    currentPollId: null,
    pollCreationMessage: null,
    pollCreatorJid: jidNormalizedUser(sock.user?.id || ''),
    correctOptionText: null,
    explanation: '',
    roundAnswered: false,
    roundNumber: 0,
    consecutiveUnanswered: 0,
    roundTimer: null,
    nextQuestionTimer: null,
  });

  const introTitle = isScheduled
    ? '🕌 بدأت المسابقة الإسلامية اليومية (8:00 مساءً)!'
    : '🕌 بدأت المسابقة الإسلامية الثقافية!';

  await sock.sendMessage(groupId, {
    text:
      `╭┈───〔 🏆 مسابقة بوت شيث 〕┈───⊷\n` +
      `│ ${introTitle}\n` +
      `│ ⚡ أول من يختار الإجابة الصحيحة في الاستطلاع يكسب نقطة.\n` +
      `│ 🎯 الفائز هو أول من يصل إلى *${WIN_SCORE} نقاط*.\n` +
      `│ ⏱️ مهلة كل سؤال: دقيقتان.\n` +
      `╰┈────────────────────⊷`,
  });

  await sendNextQuizQuestion(sock, groupId);
  return { started: true };
}

/**
 * Stops an active quiz in the given group.
 */
async function stopQuizInGroup(sock, groupId) {
  const quiz = activeQuizzes.get(groupId);
  if (!quiz) return false;

  const board = buildScoreboard(quiz.scores);
  clearQuizTimers(quiz);
  activeQuizzes.delete(groupId);

  await sock.sendMessage(groupId, {
    text:
      `🛑 *تم إيقاف المسابقة الإسلامية في هذا القروب.*\n\n` +
      `📊 *النتائج حتى لحظة الإيقاف:*\n${board.text}`,
    mentions: board.mentions,
  });
  return true;
}

/**
 * Invoked daily at 08:00 PM (Africa/Khartoum) via node-cron.
 * Launches the quiz in every registered group inside ./database.json -> target_groups.
 */
async function startScheduledQuizzes(sock) {
  const groups = getTargetGroups();
  if (!groups.length) {
    console.warn('[cron:quiz] No target_groups found in ./database.json. Skipping 8:00 PM quiz.');
    return;
  }

  console.log(`[cron:quiz] Starting 8:00 PM Islamic Poll Quiz in ${groups.length} group(s)...`);
  for (const groupId of groups) {
    try {
      await startQuizInGroup(sock, groupId, true);
    } catch (err) {
      console.error(`[cron:quiz] Failed to start quiz in ${groupId}:`, err.message);
    }
  }
}

const commands = [
  {
    name: 'مسابقة',
    aliases: ['quiz'],
    category: 'quiz',
    description: 'بدء مسابقة إسلامية تفاعلية عبر استطلاعات واتساب (أول من يصل إلى 5 نقاط يفوز)',
    async execute({ sock, from, isGroup, reply }) {
      if (!isGroup) {
        return reply('❌ المسابقة الإسلامية تعمل داخل القروبات فقط.');
      }
      if (activeQuizzes.has(from)) {
        return reply('ℹ️ توجد مسابقة إسلامية نشطة بالفعل في هذا القروب! لإيقافها استخدم `.ايقاف_المسابقة`');
      }
      await startQuizInGroup(sock, from, false);
    },
  },
  {
    name: 'ايقاف_المسابقة',
    aliases: ['stopquiz'],
    category: 'quiz',
    description: 'إيقاف المسابقة الإسلامية النشطة في القروب الحالي',
    async execute({ sock, from, isGroup, reply }) {
      if (!isGroup) {
        return reply('❌ هذا الأمر يعمل داخل القروبات فقط.');
      }
      const stopped = await stopQuizInGroup(sock, from);
      if (!stopped) {
        return reply('ℹ️ لا توجد مسابقة نشطة حالياً في هذا القروب.');
      }
    },
  },
];

module.exports = {
  category: 'quiz',
  commands,
  activeQuizzes,
  getStoredPollMessage,
  startQuizInGroup,
  stopQuizInGroup,
  startScheduledQuizzes,
  handlePollUpdateMessage,
  handleMessagesUpdatePollVotes,
};
