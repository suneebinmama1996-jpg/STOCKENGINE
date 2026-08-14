import React, { useState } from 'react';
import { Branch } from '../types';
import { generateEngineJsonOutput } from '../utils/stockCalculations';
import { FileCode, Copy, Download, Check, ShieldCheck } from 'lucide-react';

interface JsonEngineOutputViewProps {
  branches: Branch[];
}

export const JsonEngineOutputView: React.FC<JsonEngineOutputViewProps> = ({ branches }) => {
  const [copied, setCopied] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  // Filter branches if selected
  const targetBranches =
    selectedBranchFilter === 'ALL'
      ? branches
      : branches.filter((b) => b.id === selectedBranchFilter);

  const engineOutput = generateEngineJsonOutput(targetBranches);
  const jsonString = JSON.stringify(engineOutput, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_counting_engine_output_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Top Controls Header */}
      <div className="bg-slate-900 text-white rounded p-3 border border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase tracking-tight">Stock Counting Engine - Strict JSON Output</h2>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Schema Validated
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              คำนวณผลต่าง (Variance = Scanned - System) และกำหนดสถานะสี MATCH (GREEN), SHORTAGE (RED), OVER (YELLOW)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter Dropdown */}
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700 rounded px-2.5 py-1 focus:outline-none cursor-pointer"
          >
            <option value="ALL">🌐 ทุกสาขา ({branches.length} Branches)</option>
            {branches.map((b, idx) => (
              <option key={`${b.id}-${idx}`} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'คัดลอก JSON แล้ว!' : 'คัดลอก JSON'}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>ดาวน์โหลด .json</span>
          </button>
        </div>
      </div>

      {/* Constraints Validation Banner */}
      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded p-2.5 flex items-center justify-between text-[11px] text-emerald-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>กฎการประมวลผล:</strong> Variance = Scanned Qty - System Qty | Match = GREEN | Shortage = RED | Over = YELLOW
          </span>
        </div>
        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700">
          Timestamp: {engineOutput.timestamp}
        </span>
      </div>

      {/* Raw Syntax Highlighted / Pure JSON Code Container */}
      <div className="relative bg-slate-950 rounded border border-slate-800 shadow-2xl overflow-hidden font-mono text-[11px]">
        <div className="bg-slate-900/90 px-3.5 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="ml-1.5 font-bold text-slate-300">stock_counting_engine_output.json</span>
          </div>

          <span className="text-slate-500">ขนาดไฟล์ประมาณ {(jsonString.length / 1024).toFixed(1)} KB</span>
        </div>

        <pre className="p-3.5 sm:p-5 overflow-x-auto text-blue-300 selection:bg-blue-600 selection:text-white leading-relaxed max-h-[550px] overflow-y-auto">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};

