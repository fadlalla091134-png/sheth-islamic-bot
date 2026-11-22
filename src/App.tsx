import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import {
  Code2,
  Download,
  Layers,
  Menu as MenuIcon,
  SquareTerminal,
  Table2,
  X,
} from 'lucide-react';
import { BotFileEntry, CodeExplorer } from './components/CodeExplorer';
import { LiveSandbox } from './components/LiveSandbox';
import { CommandMatrix } from './components/CommandMatrix';
import { ArchitectureView } from './components/ArchitectureView';

type TabKey = 'repository' | 'sandbox' | 'commands' | 'architecture';

const NAV_ITEMS: { key: TabKey; label: string; icon: typeof Code2 }[] = [
  { key: 'repository', label: 'Repository & Code', icon: Code2 },
  { key: 'sandbox', label: 'Live Sandbox', icon: SquareTerminal },
  { key: 'commands', label: 'Command Matrix', icon: Table2 },
  { key: 'architecture', label: 'Architecture & Deploy', icon: Layers },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('repository');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [files, setFiles] = useState<BotFileEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState('index.js');
  const [sandboxCommand, setSandboxCommand] = useState<string | undefined>(undefined);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/bot-files')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { files: BotFileEntry[] }) => {
        if (!active) return;
        setFiles(data.files || []);
        if (data.files?.length && !data.files.some((f) => f.path === 'index.js')) {
          setSelectedFilePath(data.files[0].path);
        }
        setLoadingFiles(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setFilesError(err instanceof Error ? err.message : 'Unable to fetch bot files');
        setLoadingFiles(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDownloadZip = async () => {
    if (!files.length || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.path, file.content);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'sheth-whatsapp-bot.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleInspectFile = (filePath: string) => {
    setSelectedFilePath(filePath);
    setActiveTab('repository');
  };

  const handleTestCommand = (example: string) => {
    setSandboxCommand(example);
    setActiveTab('sandbox');
  };

  const activeNav = NAV_ITEMS.find((n) => n.key === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#0B1117] text-[#E6EDF3] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-[#1E2A38] bg-[#0E151E]">
        <div className="h-16 px-5 flex items-center border-b border-[#1E2A38]">
          <span className="text-base font-semibold tracking-tight text-[#F0F6FC] whitespace-nowrap shrink-0">
            Sheth Bot · بوت شيث
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/12 text-emerald-300'
                    : 'text-[#8B9BB0] hover:bg-[#151F2B] hover:text-[#F0F6FC]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1E2A38] text-xs text-[#6E7F94] space-y-1">
          <div className="font-mono text-[#9FB0C4] tabular-nums">Owner · 249905358205</div>
          <div>Baileys · Gemini 2.5 Flash · Firestore</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-[#0E151E] border-r border-[#1E2A38] flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#1E2A38]">
              <span className="text-sm font-semibold text-[#F0F6FC]">Sheth Bot · بوت شيث</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-[#8B9BB0] hover:text-[#F0F6FC] cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/12 text-emerald-300'
                        : 'text-[#8B9BB0] hover:bg-[#151F2B] hover:text-[#F0F6FC]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="h-16 px-4 sm:px-8 border-b border-[#1E2A38] bg-[#0B1117] flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#8B9BB0] hover:text-[#F0F6FC] cursor-pointer"
              aria-label="Open navigation"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-[#7B8CA3] whitespace-nowrap">Sheth Bot</span>
              <span className="text-[#4B5C70]" aria-hidden="true">/</span>
              <span className="text-[#F0F6FC] font-medium truncate">{activeNav.label}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloadingZip || files.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingZip ? 'Preparing ZIP...' : 'Download GitHub ZIP'}</span>
          </button>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'repository' && (
            <CodeExplorer
              files={files}
              loading={loadingFiles}
              error={filesError}
              selectedPath={selectedFilePath}
              onSelectPath={setSelectedFilePath}
            />
          )}

          {activeTab === 'sandbox' && (
            <LiveSandbox
              initialCommand={sandboxCommand}
              onConsumeInitialCommand={() => setSandboxCommand(undefined)}
            />
          )}

          {activeTab === 'commands' && (
            <CommandMatrix
              onTestCommand={handleTestCommand}
              onInspectFile={handleInspectFile}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitectureView
              onInspectFile={handleInspectFile}
              onOpenSandbox={() => setActiveTab('sandbox')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
