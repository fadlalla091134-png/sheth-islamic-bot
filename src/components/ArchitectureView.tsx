import { useState } from 'react';
import { Check, Copy, ArrowRight } from 'lucide-react';
import { BOT_COVER_IMAGE } from '../data/commands';

interface ArchitectureViewProps {
  onInspectFile: (filePath: string) => void;
  onOpenSandbox: () => void;
}

const ENV_TEMPLATE = `BOT_NUMBER=249905358205
OWNER_NUMBER=249905358205
OWNER_NAME=شيث
PREFIX=.
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
PORT=3000`;

export function ArchitectureView({ onInspectFile, onOpenSandbox }: ArchitectureViewProps) {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="space-y-8">
      {/* Split Architectural Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 border border-[#1E2A38] bg-[#111923] rounded-lg p-6 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="text-xs text-[#8B9BB0] font-mono">
              CommonJS · Baileys v6 · Gemini 2.5 Flash · Firebase Admin
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#F0F6FC] tracking-tight text-balance">
              Sheth WhatsApp Bot Backend Architecture
            </h1>
            <p className="text-sm text-[#9FB0C4] leading-relaxed max-w-2xl">
              Production-ready Node.js WhatsApp automation engine with Firestore cloud session persistence,
              8-digit pairing code onboarding, Sudanese Arabic AI persona, scheduled Khartoum Quran recitations,
              and zero-auto-reply owner & whitelist access control.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenSandbox}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Live Sandbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onInspectFile('index.js')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md border border-[#263547] bg-[#16202C] text-[#E6EDF3] hover:bg-[#1D2A3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Inspect index.js</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 border border-[#1E2A38] bg-[#111923] rounded-lg overflow-hidden relative min-h-[240px]">
          {!coverFailed ? (
            <img
              src={BOT_COVER_IMAGE}
              alt="Sheth Bot Geometric Architectural Cover"
              referrerPolicy="no-referrer"
              onError={() => setCoverFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0F241D] to-[#0B1117] text-emerald-300 text-sm font-medium">
              بوت شيث — Official Cover Asset
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1117]/90 via-[#0B1117]/30 to-transparent flex flex-col justify-end p-5">
            <div className="text-xs font-mono text-amber-300/90">Official .menu Cover Art</div>
            <div className="text-sm font-medium text-[#F0F6FC] mt-0.5">
              Custom thumbnail updatable anytime via .setbotimg
            </div>
          </div>
        </div>
      </div>

      {/* Key Configuration Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-4">
          <div className="text-xs text-[#7B8CA3]">Default Owner Number</div>
          <div className="mt-1.5 font-mono text-base font-semibold text-[#F0F6FC] tabular-nums">
            249905358205
          </div>
          <div className="mt-1 text-xs text-[#6E7F94]">Full admin + whitelist control</div>
        </div>
        <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-4">
          <div className="text-xs text-[#7B8CA3]">Auto-Join Invite Code</div>
          <div className="mt-1.5 font-mono text-sm font-semibold text-[#F0F6FC] truncate">
            HHJlcgXFOEoL2zdZLL7yCp
          </div>
          <div className="mt-1 text-xs text-[#6E7F94]">Saved to target_group_id on open</div>
        </div>
        <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-4">
          <div className="text-xs text-[#7B8CA3]">Scheduled Cron Jobs</div>
          <div className="mt-1.5 font-mono text-base font-semibold text-[#F0F6FC] tabular-nums">
            06:00 · 18:00 · 20:00
          </div>
          <div className="mt-1 text-xs text-[#6E7F94]">Quran (6/18) &amp; Quiz (20) Khartoum</div>
        </div>
        <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-4">
          <div className="text-xs text-[#7B8CA3]">Auth Session Store</div>
          <div className="mt-1.5 font-mono text-base font-semibold text-[#F0F6FC]">
            Firestore Cloud
          </div>
          <div className="mt-1 text-xs text-[#6E7F94]">8-digit Pairing Code (no QR)</div>
        </div>
      </div>

      {/* Core Subsystems Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#F0F6FC]">Firestore Collections Schema</h2>
          <div className="divide-y divide-[#1E2A38] text-xs">
            <div className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-emerald-300 font-medium">
                  baileys_auth / primary_session / state
                </div>
                <p className="text-[#8B9BB0] mt-1">
                  Persists Baileys <code className="text-[#D8E2EE]">creds</code> and all Signal keys serialized via{' '}
                  <code className="text-[#D8E2EE]">BufferJSON</code> so restarts never log out the bot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInspectFile('lib/authState.js')}
                className="font-mono text-[#7B8CA3] hover:text-emerald-300 shrink-0 cursor-pointer"
              >
                lib/authState.js
              </button>
            </div>
            <div className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-emerald-300 font-medium">allowed_users / &#123;digits&#125;</div>
                <p className="text-[#8B9BB0] mt-1">
                  Manual whitelist managed via <code className="text-[#D8E2EE]">.adduser</code> and{' '}
                  <code className="text-[#D8E2EE]">.deluser</code>. Non-whitelisted users receive zero replies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInspectFile('plugins/owner.js')}
                className="font-mono text-[#7B8CA3] hover:text-emerald-300 shrink-0 cursor-pointer"
              >
                plugins/owner.js
              </button>
            </div>
            <div className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-emerald-300 font-medium">bot_config / settings</div>
                <p className="text-[#8B9BB0] mt-1">
                  Stores <code className="text-[#D8E2EE]">target_group_id</code> for scheduled Quran posts and{' '}
                  <code className="text-[#D8E2EE]">bot_image</code> updated via <code className="text-[#D8E2EE]">.setbotimg</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInspectFile('lib/firebase.js')}
                className="font-mono text-[#7B8CA3] hover:text-emerald-300 shrink-0 cursor-pointer"
              >
                lib/firebase.js
              </button>
            </div>
            <div className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-emerald-300 font-medium">group_settings / &#123;groupJid&#125;</div>
                <p className="text-[#8B9BB0] mt-1">
                  Persists per-group <code className="text-[#D8E2EE]">antilink</code> enforcement flags toggled by admins.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInspectFile('plugins/group.js')}
                className="font-mono text-[#7B8CA3] hover:text-emerald-300 shrink-0 cursor-pointer"
              >
                plugins/group.js
              </button>
            </div>
            <div className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-amber-300 font-medium">
                  ./database.json (target_groups &amp; asked_questions)
                </div>
                <p className="text-[#8B9BB0] mt-1">
                  Tracks all groups scheduled for the 8:00 PM Islamic Poll Quiz and stores every asked question to guarantee zero repeats.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInspectFile('plugins/quiz.js')}
                className="font-mono text-[#7B8CA3] hover:text-emerald-300 shrink-0 cursor-pointer"
              >
                plugins/quiz.js
              </button>
            </div>
          </div>
        </div>

        {/* Deployment Checklist & .env Template */}
        <div className="border border-[#1E2A38] bg-[#111923] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[#F0F6FC]">Deployment Checklist</h2>
            <button
              type="button"
              onClick={copyEnv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#263547] bg-[#16202C] text-[#E6EDF3] hover:bg-[#1D2A3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedEnv ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied .env</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8B9BB0]" />
                  <span>Copy .env Template</span>
                </>
              )}
            </button>
          </div>

          <ol className="space-y-2 text-xs text-[#9FB0C4] list-decimal list-inside leading-relaxed">
            <li>Download the GitHub ZIP from the top bar and push it to a private GitHub repository.</li>
            <li>Deploy to Railway, Render, Koyeb, or a Linux VPS with Node.js 20+ and <code className="text-[#E6EDF3]">ffmpeg</code> installed.</li>
            <li>Configure the environment variables below (supports single-line JSON or Base64 for <code className="text-[#E6EDF3]">FIREBASE_SERVICE_ACCOUNT</code>).</li>
            <li>Run <code className="text-[#E6EDF3]">npm start</code> and enter the 8-digit Pairing Code printed in logs inside WhatsApp Linked Devices.</li>
          </ol>

          <pre className="bg-[#0B1117] border border-[#1E2A38] rounded-md p-4 font-mono text-xs text-[#C9D6E5] overflow-x-auto leading-6">
            {ENV_TEMPLATE}
          </pre>
        </div>
      </div>
    </div>
  );
}
