"use client";


import React from "react";
import { Filter, ArrowDown, Check, Bot, Zap, Calculator } from "lucide-react";

interface TelemetryFunnelProps {
  total?: number;
  exact?: number;
  fuzzy?: number;
  subset?: number;
  unresolved?: number;
}

export const TelemetryFunnel: React.FC<TelemetryFunnelProps> = ({
  total = 500,
  exact = 425,
  fuzzy = 50,
  subset = 10,
  unresolved = 15,
}) => {
  const exactPct = ((exact / total) * 100).toFixed(1);
  const fuzzyPct = ((fuzzy / total) * 100).toFixed(1);
  const subsetPct = ((subset / total) * 100).toFixed(1);
  const unresolvedPct = ((unresolved / total) * 100).toFixed(1);

  const matchedTotal = exact + fuzzy + subset;
  const matchRate = ((matchedTotal / total) * 100).toFixed(1);

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 shadow-lg mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-400" />
            Reconciliation Engine Cascade Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Progressive stage dropoff across deterministic engines to forensic AI routing
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            Total Intake: <strong className="text-white">{total}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Resolved: <strong className="text-emerald-400">{matchedTotal} ({matchRate}%)</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Unresolved: <strong className="text-amber-400">{unresolved} ({unresolvedPct}%)</strong>
          </span>
        </div>
      </div>

      {/* Funnel Stage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {/* Stage 1: Exact Match */}
        <div className="relative rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-4 transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Stage 1
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {exactPct}%
            </span>
          </div>
          <p className="text-sm font-semibold text-white">Exact Match Engine</p>
          <p className="text-2xl font-black text-emerald-400 mt-2">{exact}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Clean UTRs & exact settlement balances
          </p>
          <div className="mt-3 pt-2 border-t border-emerald-500/10 text-[10px] text-slate-400 flex justify-between">
            <span>Left for downstream:</span>
            <span className="font-semibold text-slate-300">{total - exact} deposits</span>
          </div>
        </div>

        {/* Stage 2: TF-IDF Fuzzy Match */}
        <div className="relative rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-4 transition hover:border-cyan-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              Stage 2
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {fuzzyPct}%
            </span>
          </div>
          <p className="text-sm font-semibold text-white">TF-IDF Fuzzy Matcher</p>
          <p className="text-2xl font-black text-cyan-400 mt-2">{fuzzy}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Noisy narratives fitted on UTR n-grams (τ=0.40)
          </p>
          <div className="mt-3 pt-2 border-t border-cyan-500/10 text-[10px] text-slate-400 flex justify-between">
            <span>Left for downstream:</span>
            <span className="font-semibold text-slate-300">{total - exact - fuzzy} deposits</span>
          </div>
        </div>

        {/* Stage 3: Bounded Subset-Sum DP */}
        <div className="relative rounded-lg border border-indigo-500/20 bg-indigo-950/10 p-4 transition hover:border-indigo-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
              Stage 3
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {subsetPct}%
            </span>
          </div>
          <p className="text-sm font-semibold text-white">Subset-Sum DP Knapsack</p>
          <p className="text-2xl font-black text-indigo-400 mt-2">{subset}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Settlement window multi-order batches (200ms cap)
          </p>
          <div className="mt-3 pt-2 border-t border-indigo-500/10 text-[10px] text-slate-400 flex justify-between">
            <span>Unresolved exceptions:</span>
            <span className="font-semibold text-amber-400">{unresolved} deposits</span>
          </div>
        </div>

        {/* Stage 4: Unresolved AI Researched */}
        <div className="relative rounded-lg border border-amber-500/20 bg-amber-950/10 p-4 transition hover:border-amber-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              Stage 4
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {unresolvedPct}%
            </span>
          </div>
          <p className="text-sm font-semibold text-white">Forensic AI Research</p>
          <p className="text-2xl font-black text-amber-400 mt-2">{unresolved}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Ambiguous truncated batches routed to Gemini agent
          </p>
          <div className="mt-3 pt-2 border-t border-amber-500/10 text-[10px] text-slate-400 flex justify-between">
            <span>Pipeline Audit Gate:</span>
            <span className="font-semibold text-emerald-400">425+50+10+15 = 500</span>
          </div>
        </div>
      </div>
    </div>
  );
};
