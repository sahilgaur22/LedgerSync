"use client";


import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

export interface DepositRow {
  id: string;
  deposit_date: string;
  deposit_amount_paise: number;
  deposit_amount_inr: number;
  narrative_raw: string;
  status: string;
  engine: string | null;
  matched_utr: string | null;
  matched_payout_id: string | null;
  confidence: number | null;
}

interface MasterLedgerTableProps {
  initialDeposits?: DepositRow[];
  totalDeposits?: number;
}

export const MasterLedgerTable: React.FC<MasterLedgerTableProps> = () => {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [total, setTotal] = useState<number>(500);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDeposits = useCallback(async (p: number, st: string, srch: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(pageSize),
      });
      if (st) params.append("status", st);
      if (srch) params.append("search", srch);

      const res = await fetch(`http://127.0.0.1:8000/api/deposits?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch deposits");
      const data = await res.json();
      setDeposits(data.deposits || []);
      setTotal(data.total || 500);
    } catch (err) {
      console.error("Deposits fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchDeposits(page, statusFilter, searchTerm);
  }, [fetchDeposits, page, statusFilter, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDeposits(1, statusFilter, searchTerm);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.ceil(total / pageSize) || 1;
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  const getBadgeStyle = (engine: string | null, status: string) => {
    const eng = engine?.toUpperCase();
    if (eng === "EXACT") {
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    }
    if (eng === "FUZZY") {
      return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
    }
    if (eng === "SUBSET_SUM") {
      return "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
    }
    if (eng === "AI_ASSISTED" || eng === "HUMAN_OVERRIDE") {
      return "bg-purple-500/10 text-purple-300 border-purple-500/30";
    }
    return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 shadow-lg mb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Table className="h-4 w-4 text-blue-400" />
            Master Bank Ledger (500 Statement Deposits)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete transaction intake with settlement amounts, assigned engine badges, and matched UTR references
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-white">All Statuses</option>
              <option value="EXACT_MATCHED" className="bg-slate-900 text-white">Exact Matched (425)</option>
              <option value="FUZZY_MATCHED" className="bg-slate-900 text-white">Fuzzy Matched (50)</option>
              <option value="SUBSET_MATCHED" className="bg-slate-900 text-white">Subset Matched (10)</option>
              <option value="UNMATCHED" className="bg-slate-900 text-white">Unmatched (15)</option>
            </select>
          </div>

          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search narrative / UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 transition"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
          </form>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Deposit Date (UTC)</th>
              <th className="py-3 px-4">Amount (INR)</th>
              <th className="py-3 px-4">Raw Bank Narrative</th>
              <th className="py-3 px-4">Engine / Status</th>
              <th className="py-3 px-4">Matched Gateway UTR</th>
              <th className="py-3 px-4 text-right">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                  Loading ledger rows...
                </td>
              </tr>
            ) : deposits.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                  No deposits match the selected filter.
                </td>
              </tr>
            ) : (
              deposits.map((d) => (
                <tr key={d.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {d.deposit_date.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                    {formatINR(d.deposit_amount_paise)}
                  </td>
                  <td className="py-2.5 px-4 max-w-xs">
                    <span className="font-mono text-[11px] text-slate-300 truncate block">
                      {d.narrative_raw}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${getBadgeStyle(
                        d.engine,
                        d.status
                      )}`}
                    >
                      {d.engine ? `${d.engine} MATCH` : d.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                    {d.matched_utr ? (
                      <div className="flex items-center gap-1.5">
                        <span>{d.matched_utr}</span>
                        <button
                          onClick={() => handleCopy(d.matched_utr!, d.id)}
                          className="text-slate-500 hover:text-slate-300 transition"
                          title="Copy UTR"
                        >
                          {copiedId === d.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600 italic">None (Unmatched)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-300">
                    {d.confidence !== null ? `${(d.confidence * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
        <div>
          Showing <span className="font-semibold text-white">{startRow}</span> to{" "}
          <span className="font-semibold text-white">{endRow}</span> of{" "}
          <span className="font-semibold text-white">{total}</span> total deposits
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          <span className="px-3 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
