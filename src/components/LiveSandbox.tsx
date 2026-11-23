import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, Send, ShieldAlert, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { BOT_COVER_IMAGE } from '../data/commands';

interface PollData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  answered: boolean;
  selectedOptionIndex?: number;
  winnerLabel?: string;
}

interface ChatMessage {
  id: string;
  direction: 'outgoing' | 'incoming' | 'system';
  senderLabel: string;
  timestamp: string;
  text?: string;
  caption?: string;
  mediaType?: 'image' | 'audio' | 'poll';
  audioUrl?: string;
  poll?: PollData;
  latencyMs?: number;
}

interface LiveSandboxProps {
  initialCommand?: string;
  onConsumeInitialCommand?: () => void;
}

const OWNER_NUMBER = '249905358205';

const PRESET_SENDERS = [
  { id: 'owner', label: 'Owner', number: OWNER_NUMBER, role: 'Full Admin' },
  { id: 'whitelisted', label: 'Whitelisted', number: '249912345678', role: 'Firestore Allowed' },
  { id: 'blocked', label: 'Unauthorized', number: '249999000111', role: 'Blocked by Lock' },
];

const QUICK_COMMANDS = [
  { label: '.تفعيل_اية (6AM/6PM Quran)', cmd: '.تفعيل_اية' },
  { label: '.مسابقة (Poll Quiz)', cmd: '.مسابقة' },
  { label: '.اوامر (Menu)', cmd: '.اوامر' },
  { label: '.شيث (Sudanese AI)', cmd: '.شيث كيف أطور مهاراتي في البرمجة؟' },
  { label: '.ايه (Live Quran + Tafsir)', cmd: '.ايه' },
  { label: '.اذكار_الصباح', cmd: '.اذكار_الصباح' },
  { label: '.سورة 18', cmd: '.سورة 18' },
  { label: '.المفعلين', cmd: '.المفعلين' },
  { label: 'Test Zero Auto-Reply', cmd: 'السلام عليكم كيف الحال؟' },
];

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LiveSandbox({ initialCommand, onConsumeInitialCommand }: LiveSandboxProps) {
  const [selectedSender, setSelectedSender] = useState(PRESET_SENDERS[0]);
  const [allowedUsers, setAllowedUsers] = useState<string[]>(['249912345678']);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [quizScores, setQuizScores] = useState<Record<string, number>>({});
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      direction: 'system',
      senderLabel: 'Router Ready',
      timestamp: nowTime(),
      text: 'Connected to live Gemini 2.5 Flash & AlQuran Cloud API. Test .مسابقة (Islamic Poll Quiz), .شيث, .ايه, .اوامر, .تفعيل_رقم, or switch sender identity to verify strict Zero Auto-Reply lock.',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const askedQuestionsRef = useRef<string[]>([]);
  askedQuestionsRef.current = askedQuestions;

  useEffect(() => {
    if (initialCommand) {
      setInput(initialCommand);
      onConsumeInitialCommand?.();
    }
  }, [initialCommand, onConsumeInitialCommand]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const executeMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;

    const outgoingId = `out_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: outgoingId,
        direction: 'outgoing',
        senderLabel: `${selectedSender.label} (${selectedSender.number})`,
        timestamp: nowTime(),
        text: trimmed,
      },
    ]);
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          senderNumber: selectedSender.number,
          allowedUsers,
          askedQuestions: askedQuestionsRef.current,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server returned an error');
      }

      if (data.ignored) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            direction: 'system',
            senderLabel: 'Silently Ignored',
            timestamp: nowTime(),
            text: data.reason,
          },
        ]);
      } else {
        if (data.mutation?.action === 'adduser' && data.mutation?.number) {
          setAllowedUsers((prev) =>
            prev.includes(data.mutation.number) ? prev : [...prev, data.mutation.number]
          );
        } else if (data.mutation?.action === 'deluser' && data.mutation?.number) {
          setAllowedUsers((prev) => prev.filter((n) => n !== data.mutation.number));
        } else if (data.mutation?.action === 'stopquiz') {
          setQuizScores({});
        }

        if (data.type === 'poll' && data.poll) {
          setAskedQuestions((prev) => [...prev, data.poll.question]);
          setMessages((prev) => [
            ...prev,
            {
              id: `poll_${Date.now()}`,
              direction: 'incoming',
              senderLabel: 'بوت شيث · WhatsApp Poll',
              timestamp: nowTime(),
              mediaType: 'poll',
              poll: {
                question: data.poll.question,
                options: data.poll.options,
                correctIndex: data.poll.correctIndex,
                explanation: data.poll.explanation,
                answered: false,
              },
              latencyMs: data.latencyMs,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `in_${Date.now()}`,
              direction: 'incoming',
              senderLabel: 'بوت شيث',
              timestamp: nowTime(),
              text: data.text,
              caption: data.caption,
              mediaType:
                data.type === 'image' ? 'image' : data.type === 'audio' ? 'audio' : undefined,
              audioUrl: data.audioUrl,
              latencyMs: data.latencyMs,
            },
          ]);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Request failed';
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          direction: 'system',
          senderLabel: 'Execution Error',
          timestamp: nowTime(),
          text: errMsg,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handlePollVote = (messageId: string, optionIndex: number) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg?.poll || targetMsg.poll.answered) return;

    const isCorrect = optionIndex === targetMsg.poll.correctIndex;
    const voterNum = selectedSender.number;

    if (!isCorrect) {
      setMessages((prev) => [
        ...prev,
        {
          id: `vote_wrong_${Date.now()}`,
          direction: 'system',
          senderLabel: 'Poll Vote',
          timestamp: nowTime(),
          text: `@${voterNum} selected "${targetMsg.poll!.options[optionIndex]}" — incorrect. Waiting for first correct vote.`,
        },
      ]);
      return;
    }

    const nextScore = (quizScores[voterNum] || 0) + 1;
    const updatedScores = { ...quizScores, [voterNum]: nextScore };
    setQuizScores(updatedScores);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.poll
          ? {
              ...m,
              poll: {
                ...m.poll,
                answered: true,
                selectedOptionIndex: optionIndex,
                winnerLabel: `@${voterNum}`,
              },
            }
          : m
      )
    );

    const correctReply: ChatMessage = {
      id: `quiz_ok_${Date.now()}`,
      direction: 'incoming',
      senderLabel: 'بوت شيث',
      timestamp: nowTime(),
      text: `🎉 إجابة صحيحة يا @${voterNum}! لك نقطة (رصيدك: ${nextScore}/5)\n💡 *توضيح:* ${targetMsg.poll.explanation}`,
    };

    if (nextScore >= 5) {
      const sortedBoard = Object.entries(updatedScores)
        .sort((a, b) => b[1] - a[1])
        .map(([num, pts], i) => `${i + 1}. @${num} — *${pts}/5* نقطة`)
        .join('\n');

      const winMsg: ChatMessage = {
        id: `quiz_win_${Date.now() + 1}`,
        direction: 'incoming',
        senderLabel: 'بوت شيث',
        timestamp: nowTime(),
        text:
          `╭┈───〔 🏆 بطل المسابقة الإسلامية 〕┈───⊷\n` +
          `🎊 ألف مبروك للبطل @${voterNum} بوصوله إلى *5 نقاط*!\n\n` +
          `📊 *جدول الترتيب النهائي:*\n${sortedBoard}\n` +
          `╰┈────────────────────────⊷`,
      };
      setMessages((prev) => [...prev, correctReply, winMsg]);
      setQuizScores({});
      return;
    }

    setMessages((prev) => [...prev, correctReply]);
    setTimeout(() => {
      executeMessage('.مسابقة');
    }, 1500);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    executeMessage(input);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1E2A38] pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F6FC] tracking-tight">
            Live Command Sandbox
          </h1>
          <p className="mt-1 text-sm text-[#8B9BB0]">
            Exercises real server-side Gemini 2.5 Flash Sudanese AI, AlQuran Cloud verses, and strict Owner/Whitelist enforcement.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setMessages([
              {
                id: 'cleared',
                direction: 'system',
                senderLabel: 'Session Cleared',
                timestamp: nowTime(),
                text: 'Sandbox transcript cleared. Ready for commands.',
              },
            ])
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#263547] bg-[#16202C] text-[#C9D6E5] hover:bg-[#1D2A3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Sender Identity Switcher */}
          <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#F0F6FC]">Simulated Sender Identity</h2>
              <p className="text-xs text-[#7B8CA3] mt-1">
                Switch sender to verify Owner-only commands and Zero Auto-Reply lock.
              </p>
            </div>
            <div className="space-y-2">
              {PRESET_SENDERS.map((sender) => {
                const active = selectedSender.id === sender.id;
                const isAuthorized =
                  sender.number === OWNER_NUMBER || allowedUsers.includes(sender.number);
                return (
                  <button
                    key={sender.id}
                    type="button"
                    onClick={() => setSelectedSender(sender)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-emerald-500/70 bg-emerald-500/10 text-[#F0F6FC]'
                        : 'border-[#1E2A38] bg-[#0B1117] text-[#A8B6C8] hover:border-[#2C3C50]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium flex items-center gap-2">
                        <span>{sender.label}</span>
                        <span className="text-[#6E7F94] font-normal">· {sender.role}</span>
                      </div>
                      <div className="font-mono text-xs text-[#8B9BB0] mt-0.5 tabular-nums">
                        {sender.number}
                      </div>
                    </div>
                    {isAuthorized ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sandbox Whitelist State */}
          <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F0F6FC]">Firestore allowed_users</h2>
              <span className="font-mono text-xs text-[#7B8CA3] tabular-nums">
                {allowedUsers.length} active
              </span>
            </div>
            <p className="text-xs text-[#7B8CA3]">
              Try running <code className="text-emerald-300">.adduser 249999000111</code> as Owner to authorize the blocked sender live.
            </p>
            <div className="divide-y divide-[#1E2A38] border-t border-[#1E2A38]">
              <div className="py-2 flex items-center justify-between text-xs">
                <span className="font-mono text-[#E6EDF3] tabular-nums">{OWNER_NUMBER}</span>
                <span className="text-emerald-400 font-medium">Owner</span>
              </div>
              {allowedUsers.map((num) => (
                <div key={num} className="py-2 flex items-center justify-between text-xs">
                  <span className="font-mono text-[#C9D6E5] tabular-nums">{num}</span>
                  <button
                    type="button"
                    onClick={() => setAllowedUsers((prev) => prev.filter((n) => n !== num))}
                    className="text-[#7B8CA3] hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {allowedUsers.length === 0 && (
                <div className="py-3 text-xs text-[#6E7F94]">
                  No extra whitelisted numbers. Only Owner can execute commands.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => executeMessage('.adduser 249999000111')}
              disabled={sending || selectedSender.number !== OWNER_NUMBER}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#263547] bg-[#16202C] text-[#E6EDF3] hover:bg-[#1D2A3A] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Run .adduser 249999000111</span>
            </button>
          </div>
        </div>

        {/* Chat Simulator Column */}
        <div className="lg:col-span-8 border border-[#1E2A38] bg-[#111923] rounded-lg overflow-hidden flex flex-col h-[680px]">
          {/* Quick Command Strip */}
          <div className="px-4 py-3 border-b border-[#1E2A38] bg-[#0E151E] flex items-center gap-2 overflow-x-auto">
            {QUICK_COMMANDS.map((item) => (
              <button
                key={item.cmd}
                type="button"
                disabled={sending}
                onClick={() => executeMessage(item.cmd)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#243244] bg-[#141E2B] text-[#D8E2EE] hover:border-emerald-500/60 hover:text-emerald-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages Viewport */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0B1117]"
          >
            {messages.map((m) => {
              if (m.direction === 'system') {
                return (
                  <div
                    key={m.id}
                    className="mx-auto max-w-xl border border-[#223042] bg-[#101822] rounded-md px-4 py-2.5 text-xs text-[#9BB0C8]"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#6E7F94] mb-1">
                      <span className="font-medium text-amber-300/90">{m.senderLabel}</span>
                      <span className="font-mono tabular-nums">{m.timestamp}</span>
                    </div>
                    <p className="leading-relaxed">{m.text}</p>
                  </div>
                );
              }

              const isOutgoing = m.direction === 'outgoing';
              return (
                <div
                  key={m.id}
                  className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg border px-4 py-3 space-y-2.5 ${
                      isOutgoing
                        ? 'bg-[#122922] border-emerald-900/70 text-[#E8F5EF]'
                        : 'bg-[#131C27] border-[#223042] text-[#E6EDF3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[11px] text-[#7D91A8]">
                      <span className="font-medium">{m.senderLabel}</span>
                      <span className="font-mono tabular-nums">
                        {m.timestamp}
                        {m.latencyMs ? ` · ${m.latencyMs}ms` : ''}
                      </span>
                    </div>

                    {m.mediaType === 'image' && (
                      <div className="overflow-hidden rounded-md border border-[#223042] bg-[#0B1117]">
                        {!imgFailed ? (
                          <img
                            src={BOT_COVER_IMAGE}
                            alt="Sheth Bot Official Menu Cover"
                            referrerPolicy="no-referrer"
                            onError={() => setImgFailed(true)}
                            className="w-full h-44 object-cover"
                          />
                        ) : (
                          <div className="w-full h-44 flex items-center justify-center bg-gradient-to-br from-[#0F241D] to-[#0B1117] text-sm font-medium text-emerald-300">
                            بوت شيث — Official Bot Cover
                          </div>
                        )}
                      </div>
                    )}

                    {m.mediaType === 'audio' && m.audioUrl && (
                      <div className="space-y-2">
                        <p dir="rtl" className="text-sm leading-relaxed whitespace-pre-wrap text-right">
                          {m.text}
                        </p>
                        <audio controls src={m.audioUrl} className="w-full h-9" />
                      </div>
                    )}

                    {m.mediaType === 'poll' && m.poll && (
                      <div dir="rtl" className="space-y-3 text-right">
                        <div className="text-sm font-semibold text-[#F0F6FC] leading-relaxed">
                          🕌 {m.poll.question}
                        </div>
                        <div className="text-[11px] text-[#7B8CA3]">
                          اختر إجابة واحدة (أول إجابة صحيحة تكسب نقطة)
                        </div>
                        <div className="space-y-2">
                          {m.poll.options.map((opt, idx) => {
                            const isWinnerOpt =
                              m.poll!.answered && idx === m.poll!.correctIndex;
                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={m.poll!.answered}
                                onClick={() => handlePollVote(m.id, idx)}
                                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border text-right text-xs transition-colors ${
                                  isWinnerOpt
                                    ? 'border-emerald-500/80 bg-emerald-500/15 text-emerald-200 font-medium'
                                    : m.poll!.answered
                                    ? 'border-[#1E2A38] bg-[#0E151E] text-[#6E7F94] cursor-default'
                                    : 'border-[#263547] bg-[#0B1117] text-[#E6EDF3] hover:border-emerald-500/70 hover:bg-[#14222B] cursor-pointer'
                                }`}
                              >
                                <span>{opt}</span>
                                {isWinnerOpt && (
                                  <span className="font-mono text-[11px] text-emerald-300 shrink-0">
                                    ✓ {m.poll!.winnerLabel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(m.caption || (m.text && m.mediaType !== 'audio' && m.mediaType !== 'poll')) && (
                      <div
                        dir="auto"
                        className="text-[13.5px] leading-relaxed whitespace-pre-wrap font-normal"
                      >
                        {m.caption || m.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 border border-[#223042] bg-[#131C27] rounded-lg px-4 py-2.5 text-xs text-[#8B9BB0]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Processing via server router...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-3.5 border-t border-[#1E2A38] bg-[#0E151E] flex items-center gap-3"
          >
            <input
              type="text"
              dir="auto"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command like .شيث كيف حالك؟ or .ايه or .اوامر"
              className="flex-1 bg-[#0B1117] border border-[#223042] rounded-md px-3.5 py-2 text-sm text-[#F0F6FC] placeholder:text-[#637488] focus:outline-none focus:border-emerald-500/70 transition-colors"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
