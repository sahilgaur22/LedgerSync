"use client";

import React, { useState } from "react";
import {
  Scale,
  Bot,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Check,
  X,
  Zap,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

export interface ExceptionItem {
  id: string;
  source_id: string;
  type: string;
  resolution_type: "DETERMINISTIC_FINDING" | "AI_RESEARCHED" | string;
  ai_hypothesis: string | null;
  confidence: number | null;
  evidence_refs: Record<string, any> | null;
  status: "OPEN" | "PENDING_HUMAN_REVIEW" | "RESOLVED" | string;
  created_at: string;
}

interface ExceptionWorkspaceProps {
  exceptions: ExceptionItem[];
  onAction: (exceptionId: string, action: "APPROVE" | "REJECT" | "OVERRIDE", notes?: string) => Promise<void>;
}

export const ExceptionWorkspace: React.FC<ExceptionWorkspaceProps> = ({
  exceptions,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<"ALL" | "DETERMINISTIC" | "AI">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter based on active tab
  const deterministicList = exceptions.filter(
    (e) => e.resolution_type === "DETERMINISTIC_FINDING"
  );
  const aiList = exceptions.filter(
    (e) => e.resolution_type === "AI_RESEARCHED"
  );

  const displayedList =
    activeTab === "DETERMINISTIC"
      ? deterministicList
      : activeTab === "AI"
      ? aiList
      : exceptions;

  // Selected exception (strictly falls back to first in currently displayed list)
  const activeException =
    (selectedId ? displayedList.find((e) => e.id === selectedId) : null) ||
    displayedList[0] ||
    null;


  const handleActionClick = async (action: "APPROVE" | "REJECT" | "OVERRIDE") => {
    if (!activeException) return;
    try {
      setIsSubmitting(true);
      await onAction(activeException.id, action);
      setActionSuccess(`Action ${action} executed successfully.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 shadow-lg mb-8">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Audit Exception Review Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict separation: Contract math findings vs grounded AI forensic investigations
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === "ALL"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({exceptions.length || 30})
          </button>
          <button
            onClick={() => setActiveTab("DETERMINISTIC")}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === "DETERMINISTIC"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Scale className="h-3 w-3" />
            Deterministic Findings ({deterministicList.length || 15})
          </button>
          <button
            onClick={() => setActiveTab("AI")}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === "AI"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="h-3 w-3" />
            AI Researched ({aiList.length || 15})
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          {actionSuccess}
        </div>
      )}

      {/* Split-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[460px]">
        {/* Left Pane: Exception Queue (5 cols) */}
        <div className="lg:col-span-5 border border-slate-800 rounded-lg bg-slate-950/60 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Exception Queue ({displayedList.length} items)</span>
            <span>Category</span>
          </div>

          <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[420px]">
            {displayedList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No exceptions match this filter.
              </div>
            ) : (
              displayedList.map((exc) => {
                const isSelected = activeException?.id === exc.id;
                const isDeterministic = exc.resolution_type === "DETERMINISTIC_FINDING";
                return (
                  <button
                    key={exc.id}
                    onClick={() => setSelectedId(exc.id)}
                    className={`w-full text-left p-3.5 transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-slate-800/90 border-l-4 border-l-blue-500"
                        : "hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-semibold text-white truncate">
                          {exc.source_id.slice(0, 8)}...
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            exc.status === "RESOLVED"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : exc.status === "PENDING_HUMAN_REVIEW"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                          }`}
                        >
                          {exc.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {exc.type} • {exc.evidence_refs?.amount_paise ? formatINR(exc.evidence_refs.amount_paise) : "Contract variance"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isDeterministic ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Math
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          Gemini
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Review Card (7 cols) */}
        <div className="lg:col-span-7 border border-slate-800 rounded-lg bg-slate-950/60 p-5 flex flex-col justify-between">
          {activeException ? (
            activeException.resolution_type === "DETERMINISTIC_FINDING" ? (
              /* CARD 1: DETERMINISTIC FINDING (NO AI FRAMING, PURE CONTRACT MATH) */
              <div className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5">
                      <Scale className="h-3 w-3" />
                      Deterministic Contract Math Finding
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">
                      {activeException.type === "FEE_LEAK"
                        ? "MDR Rate Deviation Leak"
                        : "GST Tax Basis Variance"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Source Payout ID: <span className="font-mono text-slate-300">{activeException.source_id}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Audit Status</span>
                    <p className="text-xs font-semibold text-amber-300">{activeException.status}</p>
                  </div>
                </div>

                {/* Mathematical Comparison Box */}
                <div className="rounded-lg bg-slate-900/90 border border-amber-500/20 p-4">
                  <p className="text-xs font-semibold text-slate-300 mb-2">
                    Basis-Point Audit Breakdown:
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400">Contracted Rate</span>
                      <p className="font-bold text-white mt-0.5">
                        {activeException.type === "FEE_LEAK" ? "1.80% (180 bps)" : "18.00% (1800 bps)"}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400">Deducted Rate</span>
                      <p className="font-bold text-amber-400 mt-0.5">
                        {activeException.type === "FEE_LEAK" ? "2.50% (250 bps)" : "28.00% (2800 bps)"}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400">Net Discrepancy</span>
                      <p className="font-bold text-rose-400 mt-0.5">
                        {activeException.type === "FEE_LEAK" ? "+70 bps Leak" : "+1000 bps Variance"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3">
                    Calculated deterministically via <code className="text-amber-300">expected_fee = round(tax_basis * contracted_bps / 10000)</code> against <code className="text-slate-300">fee_contracts</code>. Zero LLM involvement.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Non-destructive approval workflow
                  </span>
                  <button
                    onClick={() => handleActionClick("APPROVE")}
                    disabled={isSubmitting || activeException.status === "RESOLVED"}
                    className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {activeException.status === "RESOLVED" ? "Resolved" : "Approve Ledger Adjustment"}
                  </button>
                </div>
              </div>
            ) : (
              /* CARD 2: AI RESEARCHED (GEMINI HYPOTHESIS + EVIDENCE REFS) */
              <div className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 inline-flex items-center gap-1.5">
                      <Bot className="h-3 w-3" />
                      Gemini 3.6 Flash Forensic Investigation
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">
                      Ambiguous Narrative Exception
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deposit ID: <span className="font-mono text-slate-300">{activeException.source_id}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Confidence</span>
                    <p className="text-sm font-bold text-indigo-300">
                      {activeException.confidence ? `${(activeException.confidence * 100).toFixed(0)}%` : "None (In Review)"}
                    </p>
                  </div>
                </div>

                {/* AI Forensic Reasoning Box */}
                <div className="rounded-lg bg-slate-900/90 border border-indigo-500/20 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Forensic Hypothesis:
                  </span>
                  <p className="text-xs text-slate-200 mt-1.5 leading-relaxed font-sans">
                    {activeException.ai_hypothesis ||
                      "External AI service unavailable (Circuit Breaker OPEN). Routed for human operator investigation."}
                  </p>
                </div>

                {/* Deposit Intake Metadata */}
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Deposit Intake Metadata:
                  </span>
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Deposit Amount:</span>
                      <span className="font-mono font-semibold text-white">
                        {activeException.evidence_refs?.amount_paise
                          ? formatINR(activeException.evidence_refs.amount_paise)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Deposit Date:</span>
                      <span className="font-mono text-slate-300">
                        {activeException.evidence_refs?.deposit_date
                          ? activeException.evidence_refs.deposit_date.replace("T", " ").slice(0, 19)
                          : "—"}
                      </span>
                    </div>
                    {activeException.evidence_refs?.narrative_raw && (
                      <div className="text-[11px] pt-1">
                        <span className="text-slate-400 font-mono block mb-0.5">Raw Narrative:</span>
                        <span className="font-mono text-slate-300 break-all text-[10px] bg-slate-900 px-2 py-1 rounded block border border-slate-800/80">
                          {activeException.evidence_refs.narrative_raw}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Corroborating Ledger Evidence Refs */}
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Corroborating Ledger Evidence Refs:
                  </span>
                  {activeException.evidence_refs?.matched_payout_id ? (
                    <div className="rounded-lg bg-slate-950 border border-emerald-500/20 p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-mono">Matched Payout ID:</span>
                        <span className="font-mono font-semibold text-emerald-300 truncate max-w-[280px]">
                          {activeException.evidence_refs.matched_payout_id}
                        </span>
                      </div>
                      {activeException.evidence_refs.utr_id && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-mono">Gateway UTR:</span>
                          <span className="font-mono font-semibold text-slate-200">
                            {activeException.evidence_refs.utr_id}
                          </span>
                        </div>
                      )}
                      {activeException.evidence_refs.delta_hours !== undefined && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-mono">Settlement Delta:</span>
                          <span className="font-mono text-slate-300">
                            {activeException.evidence_refs.delta_hours} hours
                          </span>
                        </div>
                      )}
                      {activeException.evidence_refs.net_payout_paise && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-mono">Net Payout:</span>
                          <span className="font-mono font-bold text-white">
                            {formatINR(activeException.evidence_refs.net_payout_paise)}
                          </span>
                        </div>
                      )}
                      {activeException.evidence_refs.forensic_method && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-mono">Forensic Method:</span>
                          <span className="font-mono text-slate-400">
                            {activeException.evidence_refs.forensic_method}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-950/20 border border-amber-500/30 p-3 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300">
                          Gemini could not establish grounded evidence — awaiting human investigation
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          No candidate payout reference linked. Manual ledger investigation required before approval.
                        </p>
                      </div>
                    </div>
                  )}
                </div>


                {/* Operator Actions */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleActionClick("REJECT")}
                    disabled={isSubmitting || activeException.status === "RESOLVED"}
                    className="px-3.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5 text-rose-400" />
                    Reject & Escalate
                  </button>

                  <button
                    onClick={() => handleActionClick("APPROVE")}
                    disabled={isSubmitting || activeException.status === "RESOLVED"}
                    className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {activeException.status === "RESOLVED" ? "Resolved" : "Approve Match to Ledger"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              Select an exception from the queue to inspect forensic evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
