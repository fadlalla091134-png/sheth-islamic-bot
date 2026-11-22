import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { BotCommandSpec, COMMAND_CATALOG } from '../data/commands';

interface CommandMatrixProps {
  onTestCommand: (example: string) => void;
  onInspectFile: (filePath: string) => void;
}

const CATEGORIES = [
  'All',
  'Owner',
  'Menu',
  'AI',
  'Quran',
  'Quiz',
  'Download',
  'Audio',
  'Group',
  'Sticker',
  'Fun',
  'Utility',
] as const;

export function CommandMatrix({ onTestCommand, onInspectFile }: CommandMatrixProps) {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return COMMAND_CATALOG.filter((cmd: BotCommandSpec) => {
      if (activeCategory !== 'All' && cmd.category !== activeCategory) return false;
      if (!q) return true;
      return (
        cmd.primary.toLowerCase().includes(q) ||
        cmd.aliases.some((a) => a.toLowerCase().includes(q)) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.pluginFile.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1E2A38] pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F6FC] tracking-tight">
            Command Matrix
          </h1>
          <p className="mt-1 text-sm text-[#8B9BB0]">
            All modular Arabic and English commands across 10 plugin files with strict access boundaries.
          </p>
        </div>
        <div className="text-xs font-mono text-[#8B9BB0] tabular-nums">
          {filtered.length} of {COMMAND_CATALOG.length} commands shown
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#111923] border border-[#1E2A38] rounded-lg overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-[#8B9BB0] hover:text-[#F0F6FC]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#6E7F94] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Arabic or English command..."
            className="w-full bg-[#111923] border border-[#1E2A38] rounded-md pl-8 pr-3 py-2 text-xs text-[#E6EDF3] placeholder:text-[#6E7F94] focus:outline-none focus:border-emerald-500/70 transition-colors"
          />
        </div>
      </div>

      {/* High-Density Data Table */}
      <div className="border border-[#1E2A38] bg-[#111923] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2A38] bg-[#0E151E] text-[11px] font-medium text-[#7B8CA3]">
                <th className="py-3 px-4">Command & Aliases</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Access</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Behavior</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2431] text-xs">
              {filtered.map((cmd) => (
                <tr key={cmd.id} className="hover:bg-[#15202D] transition-colors">
                  <td className="py-3 px-4 font-mono whitespace-nowrap">
                    <span className="text-[#F0F6FC] font-medium">{cmd.primary}</span>
                    {cmd.aliases.length > 0 && (
                      <span className="text-[#7B8CA3]"> · {cmd.aliases.join(' · ')}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[#A8B6C8] whitespace-nowrap">{cmd.category}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={
                        cmd.access === 'Owner Only'
                          ? 'text-amber-400 font-medium'
                          : 'text-emerald-400'
                      }
                    >
                      {cmd.access}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onInspectFile(cmd.pluginFile)}
                      className="font-mono text-[#8B9BB0] hover:text-emerald-300 underline-offset-4 hover:underline transition-colors cursor-pointer"
                    >
                      {cmd.pluginFile}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-[#B5C2D3] max-w-md">{cmd.description}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onTestCommand(cmd.example)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <span>Try</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#7B8CA3]">
                    No commands match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
