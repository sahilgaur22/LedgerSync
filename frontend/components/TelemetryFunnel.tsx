"use client";

import React from "react";

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
    <div className="mb-6 border border-[#cce0ff] bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex flex-col justify-between gap-2 border-b border-[#cce0ff] pb-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#003366]">
            Reconciliation Engine Cascade Telemetry
          </h3>
          <p className="text-xs text-[#00509e]">
            Deterministic engine cascade dropoff to forensic AI routing (500 deposit population)
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-[#00509e]">
          <span>Intake: <strong className="font-semibold text-[#003366]">{total}</strong></span>
          <span className="text-[#cce0ff]">|</span>
          <span>Resolved: <strong className="font-semibold text-[#003366]">{matchedTotal} ({matchRate}%)</strong></span>
          <span className="text-[#cce0ff]">|</span>
          <span>Unresolved: <strong className="font-semibold text-[#007acc]">{unresolved} ({unresolvedPct}%)</strong></span>
        </div>
      </div>

      {/* 4 Clean Architectural Stages */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stage 1: Exact Match */}
        <div className="border border-[#cce0ff] bg-[#f4f8ff] p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#00509e]">Stage 1</span>
            <span className="font-mono text-[#003366] tabular-nums">{exactPct}%</span>
          </div>
          <div className="text-sm font-semibold text-[#003366]">Exact Match Engine</div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-[#003366] tabular-nums">
            {exact}
          </div>
          <p className="mt-1 text-[11px] text-[#00509e]">
            Exact net balance & verified UTR settlement
          </p>
          <div className="mt-3 flex justify-between border-t border-[#cce0ff] pt-2 font-mono text-[11px] tabular-nums text-[#00509e]">
            <span>Remaining:</span>
            <span className="font-medium text-[#003366]">{total - exact} deposits</span>
          </div>
        </div>

        {/* Stage 2: Fuzzy Text Match */}
        <div className="border border-[#cce0ff] bg-[#f4f8ff] p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#00509e]">Stage 2</span>
            <span className="font-mono text-[#003366] tabular-nums">{fuzzyPct}%</span>
          </div>
          <div className="text-sm font-semibold text-[#003366]">Fuzzy Text Matcher</div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-[#003366] tabular-nums">
            {fuzzy}
          </div>
          <p className="mt-1 text-[11px] text-[#00509e]">
            Noisy narrative character n-gram cosine matching
          </p>
          <div className="mt-3 flex justify-between border-t border-[#cce0ff] pt-2 font-mono text-[11px] tabular-nums text-[#00509e]">
            <span>Remaining:</span>
            <span className="font-medium text-[#003366]">{total - exact - fuzzy} deposits</span>
          </div>
        </div>

        {/* Stage 3: Subset-Sum DP */}
        <div className="border border-[#cce0ff] bg-[#f4f8ff] p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#00509e]">Stage 3</span>
            <span className="font-mono text-[#003366] tabular-nums">{subsetPct}%</span>
          </div>
          <div className="text-sm font-semibold text-[#003366]">Subset-Sum Solver</div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-[#003366] tabular-nums">
            {subset}
          </div>
          <p className="mt-1 text-[11px] text-[#00509e]">
            Bounded 2-payout batch knapsack (200ms budget)
          </p>
          <div className="mt-3 flex justify-between border-t border-[#cce0ff] pt-2 font-mono text-[11px] tabular-nums text-[#00509e]">
            <span>Unresolved:</span>
            <span className="font-medium text-[#003366]">{unresolved} deposits</span>
          </div>
        </div>

        {/* Stage 4: Unresolved AI Researched */}
        <div className="border border-[#003366] bg-white p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#007acc]">Stage 4</span>
            <span className="font-mono text-[#007acc] tabular-nums">{unresolvedPct}%</span>
          </div>
          <div className="text-sm font-semibold text-[#003366]">Forensic AI Research</div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-[#007acc] tabular-nums">
            {unresolved}
          </div>
          <p className="mt-1 text-[11px] text-[#00509e]">
            Ambiguous deposits routed to automated AI research agent
          </p>
          <div className="mt-3 flex justify-between border-t border-[#cce0ff] pt-2 font-mono text-[11px] tabular-nums text-[#00509e]">
            <span>Pipeline total:</span>
            <span className="font-medium text-[#003366]">425+50+10+15 = 500</span>
          </div>
        </div>
      </div>
    </div>
  );
};
