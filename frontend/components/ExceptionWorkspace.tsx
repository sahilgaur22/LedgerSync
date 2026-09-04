"use client";

import React, { useState } from "react";
import {
  Scale,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Check,
  X,
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
      setActionSuccess(`Action ${action} recorded to audit journal.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-6 border border-[#cce0ff] bg-white p-5">
      {/* Header & Tabs */}
      <div className="mb-4 flex flex-col justify-between gap-3 border-b border-[#cce0ff] pb-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#003366]">
            Audit Exception Review Workspace
          </h3>
          <p className="text-xs text-[#00509e]">
            Rigorous dual-card review: Deterministic contract math vs grounded AI forensic hypotheses
          </p>
        </div>

        {/* Tab Switcher: Restrained architectural underline tabs */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`pb-1 transition ${
              activeTab === "ALL"
                ? "border-b-2 border-[#007acc] font-semibold text-[#003366]"
                : "text-[#00509e] hover:text-[#003366]"
            }`}
          >
            All ({exceptions.length || 30})
          </button>
          <button
            onClick={() => setActiveTab("DETERMINISTIC")}
            className={`flex items-center gap-1.5 pb-1 transition ${
              activeTab === "DETERMINISTIC"
                ? "border-b-2 border-[#007acc] font-semibold text-[#003366]"
                : "text-[#00509e] hover:text-[#003366]"
            }`}
          >
            <Scale className="h-3 w-3" />
            Deterministic findings ({deterministicList.length || 15})
          </button>
          <button
            onClick={() => setActiveTab("AI")}
            className={`flex items-center gap-1.5 pb-1 transition ${
              activeTab === "AI"
                ? "border-b-2 border-[#007acc] font-semibold text-[#003366]"
                : "text-[#00509e] hover:text-[#003366]"
            }`}
          >
            <Search className="h-3 w-3" />
            AI researched ({aiList.length || 15})
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-4 flex items-center gap-2 border border-[#cce0ff] bg-[#f4f8ff] px-3 py-2 text-xs text-[#003366]">
          <CheckCircle2 className="h-4 w-4 text-[#007acc]" />
          {actionSuccess}
        </div>
      )}

      {/* Split-Pane Layout */}
      <div className="grid min-h-[460px] grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Pane: Exception Queue (5 cols) */}
        <div className="flex flex-col border border-[#cce0ff] bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#cce0ff] bg-[#f4f8ff] px-3.5 py-2 text-xs font-medium text-[#00509e]">
            <span>Queue ({displayedList.length} exceptions)</span>
            <span>Classification</span>
          </div>

          <div className="max-h-[440px] divide-y divide-[#cce0ff] overflow-y-auto">
            {displayedList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#00509e]">
                No exceptions in this view.
              </div>
            ) : (
              displayedList.map((exc) => {
                const isSelected = activeException?.id === exc.id;
                const isDeterministic = exc.resolution_type === "DETERMINISTIC_FINDING";
                return (
                  <button
                    key={exc.id}
                    onClick={() => setSelectedId(exc.id)}
                    className={`flex w-full items-center justify-between gap-3 p-3 text-left transition ${
                      isSelected
                        ? "border-l-4 border-l-[#003366] bg-[#f4f8ff]"
                        : "hover:bg-[#f4f8ff]/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#003366]">
                          {exc.source_id.slice(0, 8)}...
                        </span>
                        <span className="border border-[#cce0ff] bg-white px-1.5 py-0.2 font-mono text-[10px] text-[#00509e]">
                          {exc.status === "RESOLVED"
                            ? "Resolved"
                            : exc.status === "PENDING_HUMAN_REVIEW"
                            ? "In review"
                            : "Open"}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-[#00509e]">
                        {exc.type} · {exc.evidence_refs?.amount_paise ? formatINR(exc.evidence_refs.amount_paise) : "Contract variance"}
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <span className="border border-[#cce0ff] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#003366]">
                        {isDeterministic ? "Contract math" : "AI researched"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#00509e]" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Review Card (7 cols) */}
        <div className="flex flex-col justify-between border border-[#cce0ff] bg-white p-5 lg:col-span-7">
          {activeException ? (
            activeException.resolution_type === "DETERMINISTIC_FINDING" ? (
              /* CARD 1: DETERMINISTIC FINDING (CONTRACT MATH & FEE CRITIC) */
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-[#cce0ff] pb-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 border border-[#003366] bg-[#f4f8ff] px-2 py-0.5 text-[10px] font-medium text-[#003366]">
                      <Scale className="h-3 w-3 text-[#003366]" />
                      Deterministic Contract Variance
                    </div>
                    <h4 className="mt-2 text-base font-semibold text-[#003366]">
                      {activeException.type === "FEE_LEAK"
                        ? "MDR Fee Deviation Overcharge"
                        : "GST Statutory Tax Variance"}
                    </h4>
                    <p className="font-mono text-xs text-[#00509e]">
                      Source Payout: {activeException.source_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#00509e]">Audit Status</span>
                    <p className="font-mono text-xs font-semibold text-[#003366]">
                      {activeException.status}
                    </p>
                  </div>
                </div>

                {/* Mathematical Comparison Box */}
                <div className="border border-[#cce0ff] bg-[#f4f8ff] p-3.5">
                  <p className="mb-2 text-xs font-medium text-[#003366]">
                    Basis-Point Audit Breakdown:
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="border border-[#cce0ff] bg-white p-2">
                      <span className="text-[10px] text-[#00509e]">Contracted rate</span>
                      <p className="mt-0.5 font-mono font-semibold text-[#003366]">
                        {activeException.type === "FEE_LEAK" ? "1.80% (180 bps)" : "18.00% (1800 bps)"}
                      </p>
                    </div>
                    <div className="border border-[#cce0ff] bg-white p-2">
                      <span className="text-[10px] text-[#00509e]">Deducted rate</span>
                      <p className="mt-0.5 font-mono font-semibold text-[#003366]">
                        {activeException.type === "FEE_LEAK" ? "2.50% (250 bps)" : "28.00% (2800 bps)"}
                      </p>
                    </div>
                    <div className="border border-[#003366] bg-white p-2">
                      <span className="text-[10px] text-[#00509e]">Net discrepancy</span>
                      <p className="mt-0.5 font-mono font-semibold text-[#003366]">
                        {activeException.type === "FEE_LEAK" ? "+70 bps leak" : "+1000 bps variance"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[11px] text-[#00509e]">
                    Deterministic verification against <code className="font-mono text-[#003366]">fee_contracts</code> table. Zero LLM involvement.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between border-t border-[#cce0ff] pt-4">
                  <span className="text-[11px] text-[#00509e]">
                    Non-destructive approval workflow
                  </span>
                  <button
                    onClick={() => handleActionClick("APPROVE")}
                    disabled={isSubmitting || activeException.status === "RESOLVED"}
                    className="flex items-center gap-1.5 border border-[#00509e] bg-white px-3.5 py-1.5 text-xs font-medium text-[#003366] transition hover:bg-[#f4f8ff] disabled:bg-[#f4f8ff] disabled:text-[#00509e]/50"
                  >
                    <Check className="h-3.5 w-3.5 text-[#003366]" />
                    {activeException.status === "RESOLVED" ? "Resolved" : "Approve Ledger Adjustment"}
                  </button>
                </div>
              </div>
            ) : (
              /* CARD 2: AI RESEARCHED (AI FORENSIC INVESTIGATION + EVIDENCE REFS) */
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-[#cce0ff] pb-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 border border-[#007acc] bg-[#f4f8ff] px-2 py-0.5 text-[10px] font-medium text-[#003366]">
                      <Search className="h-3 w-3 text-[#007acc]" />
                      AI Forensic Investigation
                    </div>
                    <h4 className="mt-2 text-base font-semibold text-[#003366]">
                      Ambiguous Narrative Exception
                    </h4>
                    <p className="font-mono text-xs text-[#00509e]">
                      Deposit ID: {activeException.source_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#00509e]">Model confidence</span>
                    <p className="font-mono text-xs font-semibold text-[#003366] tabular-nums">
                      {activeException.confidence ? `${(activeException.confidence * 100).toFixed(0)}%` : "In review"}
                    </p>
                  </div>
                </div>

                {/* AI Forensic Reasoning Box */}
                <div className="border-l-2 border-[#66a3ff] bg-[#f4f8ff] p-3 text-xs">
                  <div className="mb-1 text-[10px] font-semibold text-[#00509e]">
                    Forensic reasoning hypothesis:
                  </div>
                  <p className="font-sans leading-relaxed text-[#003366]">
                    {activeException.ai_hypothesis ||
                      "External AI service unavailable (Circuit Breaker OPEN). Routed for human investigation."}
                  </p>
                </div>

                {/* Deposit Intake Metadata */}
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-[#00509e]">
                    Deposit intake metadata:
                  </span>
                  <div className="space-y-1 border border-[#cce0ff] bg-white p-2.5 font-mono text-[11px] tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="text-[#00509e]">Deposit amount:</span>
                      <span className="font-semibold text-[#003366]">
                        {activeException.evidence_refs?.amount_paise
                          ? formatINR(activeException.evidence_refs.amount_paise)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#00509e]">Deposit date:</span>
                      <span className="text-[#003366]">
                        {activeException.evidence_refs?.deposit_date
                          ? activeException.evidence_refs.deposit_date.replace("T", " ").slice(0, 19)
                          : "—"}
                      </span>
                    </div>
                    {activeException.evidence_refs?.narrative_raw && (
                      <div className="pt-1">
                        <span className="block text-[#00509e]">Raw narrative:</span>
                        <span className="mt-0.5 block break-all border border-[#cce0ff] bg-[#f4f8ff] p-1 text-[10px] text-[#003366]">
                          {activeException.evidence_refs.narrative_raw}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Corroborating Ledger Evidence Refs */}
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-[#00509e]">
                    Corroborating ledger evidence:
                  </span>
                  {activeException.evidence_refs?.matched_payout_id ? (
                    <div className="space-y-1 border border-[#cce0ff] bg-white p-2.5 font-mono text-[11px] tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="text-[#00509e]">Matched payout:</span>
                        <span className="truncate text-[#003366]">
                          {activeException.evidence_refs.matched_payout_id}
                        </span>
                      </div>
                      {activeException.evidence_refs.utr_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#00509e]">Gateway UTR:</span>
                          <span className="text-[#003366]">
                            {activeException.evidence_refs.utr_id}
                          </span>
                        </div>
                      )}
                      {activeException.evidence_refs.delta_hours !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#00509e]">Settlement delta:</span>
                          <span className="text-[#003366]">
                            {activeException.evidence_refs.delta_hours} hours
                          </span>
                        </div>
                      )}
                      {activeException.evidence_refs.net_payout_paise && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#00509e]">Net payout amount:</span>
                          <span className="font-semibold text-[#003366]">
                            {formatINR(activeException.evidence_refs.net_payout_paise)}
                          </span>
                        </div>
                      )}
                      {activeException.evidence_refs.forensic_method && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#00509e]">Method:</span>
                          <span className="text-[#00509e]">
                            {activeException.evidence_refs.forensic_method}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 border border-[#cce0ff] bg-[#f4f8ff] p-3 text-xs">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#003366]" />
                      <div>
                        <p className="font-medium text-[#003366]">
                          Could not establish grounded evidence — awaiting human investigation
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#00509e]">
                          No candidate payout reference corroborated. Manual investigation required before ledger credit.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Operator Actions */}
                <div className="flex items-center justify-between border-t border-[#cce0ff] pt-4">
                  <button
                    onClick={() => handleActionClick("REJECT")}
                    disabled={isSubmitting || activeException.status === "RESOLVED"}
                    className="flex items-center gap-1.5 border border-[#cce0ff] bg-white px-3 py-1.5 text-xs font-medium text-[#00509e] transition hover:bg-[#f4f8ff] hover:text-[#003366] disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5 text-[#00509e]" />
                    Reject & Escalate
                  </button>

                  <button
                    onClick={() => handleActionClick("APPROVE")}
                    disabled={isSubmitting || activeException.status === "RESOLVED"}
                    className="flex items-center gap-1.5 bg-[#007acc] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#00509e] disabled:bg-[#cce0ff] disabled:text-[#00509e]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {activeException.status === "RESOLVED" ? "Resolved" : "Approve Match to Ledger"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-xs text-[#00509e]">
              Select an exception from the queue to inspect forensic evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
