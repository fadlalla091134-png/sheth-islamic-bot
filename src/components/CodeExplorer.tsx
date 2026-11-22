import { useMemo, useState } from 'react';
import { Check, Copy, FileCode2, Folder, Search } from 'lucide-react';

export interface BotFileEntry {
  path: string;
  size: number;
  folder: string;
  content: string;
}

interface CodeExplorerProps {
  files: BotFileEntry[];
  loading: boolean;
  error: string | null;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function CodeExplorer({
  files,
  loading,
  error,
  selectedPath,
  onSelectPath,
}: CodeExplorerProps) {
  const [query, setQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)
    );
  }, [files, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, BotFileEntry[]> = {
      root: [],
      lib: [],
      plugins: [],
    };
    for (const file of filteredFiles) {
      const bucket = file.folder in groups ? file.folder : 'root';
      groups[bucket].push(file);
    }
    return groups;
  }, [filteredFiles]);

  const activeFile = useMemo(
    () => files.find((f) => f.path === selectedPath) || files[0] || null,
    [files, selectedPath]
  );

  const lines = useMemo(
    () => (activeFile ? activeFile.content.split('\n') : []),
    [activeFile]
  );

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedPath(activeFile.path);
      setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 border border-[#1E2A38] bg-[#111923] rounded-lg p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="h-8 bg-[#182230] rounded animate-pulse" />
          ))}
        </div>
        <div className="lg:col-span-9 border border-[#1E2A38] bg-[#111923] rounded-lg p-6 space-y-3">
          <div className="h-6 w-48 bg-[#182230] rounded animate-pulse" />
          {Array.from({ length: 14 }).map((_, idx) => (
            <div key={idx} className="h-4 bg-[#182230] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-900/60 bg-red-950/20 rounded-lg p-6 text-sm text-red-200">
        Failed to load repository files: {error}
      </div>
    );
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1E2A38] pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F6FC] tracking-tight">
            GitHub Repository Files
          </h1>
          <p className="mt-1 text-sm text-[#8B9BB0]">
            Complete CommonJS Node.js backend ready to copy into GitHub or deploy directly.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#8B9BB0] font-mono tabular-nums">
          <span>{files.length} files</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(totalBytes)}</span>
          <span aria-hidden="true">·</span>
          <span>CommonJS</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* File Tree */}
        <div className="lg:col-span-3 border border-[#1E2A38] bg-[#111923] rounded-lg overflow-hidden">
          <div className="p-3 border-b border-[#1E2A38]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6E7F94] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter files or code..."
                className="w-full bg-[#0B1117] border border-[#1E2A38] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#E6EDF3] placeholder:text-[#6E7F94] focus:outline-none focus:border-emerald-500/70 transition-colors"
              />
            </div>
          </div>

          <div className="p-2 max-h-[680px] overflow-y-auto space-y-4">
            {(['root', 'lib', 'plugins'] as const).map((groupKey) => {
              const items = grouped[groupKey];
              if (!items.length) return null;
              const label =
                groupKey === 'root'
                  ? 'Root'
                  : groupKey === 'lib'
                  ? 'lib/'
                  : 'plugins/';
              return (
                <div key={groupKey}>
                  <div className="px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-medium text-[#7B8CA3]">
                    <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                    <span>{label}</span>
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {items.map((file) => {
                      const isActive = activeFile?.path === file.path;
                      const displayName = file.path.includes('/')
                        ? file.path.split('/').slice(1).join('/')
                        : file.path;
                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => onSelectPath(file.path)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500/12 text-emerald-300 font-medium'
                              : 'text-[#B5C2D3] hover:bg-[#17212E] hover:text-[#F0F6FC]'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                            <span className="font-mono truncate">{displayName}</span>
                          </span>
                          <span className="text-[11px] font-mono text-[#6E7F94] shrink-0 tabular-nums">
                            {formatBytes(file.size)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredFiles.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-[#7B8CA3]">
                No matching files found.
              </div>
            )}
          </div>
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-9 border border-[#1E2A38] bg-[#111923] rounded-lg overflow-hidden">
          {activeFile ? (
            <>
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[#1E2A38] bg-[#0E151E]">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-medium text-[#F0F6FC] truncate">
                    {activeFile.path}
                  </span>
                  <span className="text-xs text-[#6E7F94] font-mono tabular-nums hidden sm:inline">
                    · {lines.length} lines · {formatBytes(activeFile.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#263547] bg-[#16202C] text-[#E6EDF3] hover:bg-[#1D2A3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedPath === activeFile.path ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#8B9BB0]" />
                      <span>Copy File</span>
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto max-h-[680px] overflow-y-auto bg-[#0B1117]">
                <table className="w-full border-collapse font-mono text-[12.5px] leading-6">
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-[#131C27]">
                        <td className="select-none text-right pr-4 pl-4 text-[#4B5C70] w-12 align-top tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="pr-6 text-[#D8E2EE] whitespace-pre align-top">
                          {line || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-sm text-[#7B8CA3]">
              Select a file from the tree to inspect its source code.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
