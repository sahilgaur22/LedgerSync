"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Filter,
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

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/deposits?${params.toString()}`);
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

  const renderBadge = (engine: string | null, status: string) => {
    const eng = engine?.toUpperCase();
    if (eng === "EXACT") {
      return (
        <span className="inline-block border border-[#cce0ff] bg-[#f4f8ff] px-2 py-0.5 text-[11px] font-medium text-[#003366]">
          Exact match
        </span>
      );
    }
    if (eng === "FUZZY") {
      return (
        <span className="inline-block border border-[#cce0ff] px-2 py-0.5 text-[11px] font-medium text-[#00509e]">
          Fuzzy text
        </span>
      );
    }
    if (eng === "SUBSET_SUM") {
      return (
        <span className="inline-block border border-[#cce0ff] bg-[#f4f8ff] px-2 py-0.5 text-[11px] font-medium text-[#003366]">
          Subset sum
        </span>
      );
    }
    return (
      <span className="inline-block border border-[#003366] bg-white px-2 py-0.5 text-[11px] font-medium text-[#003366]">
        {status === "UNMATCHED" ? "Unmatched" : status}
      </span>
    );
  };

  return (
    <div className="mb-6 border border-[#cce0ff] bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex flex-col justify-between gap-3 border-b border-[#cce0ff] pb-3 md:flex-row md:items-center">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#003366]">
            Master Bank Ledger (500 Statement Deposits)
          </h3>
          <p className="text-xs text-[#00509e]">
            Intake transactions, assigned reconciliation engines, and matched payout references
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status filter dropdown */}
          <div className="flex items-center gap-1.5 border border-[#cce0ff] bg-white px-2.5 py-1 text-xs text-[#003366]">
            <Filter className="h-3 w-3 text-[#00509e]" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent text-xs text-[#003366] focus:outline-none"
            >
              <option value="">All statuses (500)</option>
              <option value="EXACT_MATCHED">Exact matched (425)</option>
              <option value="FUZZY_MATCHED">Fuzzy matched (50)</option>
              <option value="SUBSET_MATCHED">Subset matched (10)</option>
              <option value="UNMATCHED">Unmatched exceptions (15)</option>
            </select>
          </div>

          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search narrative / UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 border border-[#cce0ff] bg-white py-1 pl-7 pr-2.5 text-xs text-[#003366] placeholder-[#00509e]/60 transition focus:border-[#007acc] focus:outline-none"
            />
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-[#00509e]" />
          </form>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-[#cce0ff]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#cce0ff] bg-[#f4f8ff] text-[11px] font-semibold text-[#00509e]">
              <th className="py-2.5 px-3.5">Deposit date (UTC)</th>
              <th className="py-2.5 px-3.5">Amount (INR)</th>
              <th className="py-2.5 px-3.5">Raw bank narrative</th>
              <th className="py-2.5 px-3.5">Reconciliation engine</th>
              <th className="py-2.5 px-3.5">Matched gateway UTR</th>
              <th className="py-2.5 px-3.5 text-right">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#cce0ff]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[#00509e]">
                  Loading ledger rows...
                </td>
              </tr>
            ) : deposits.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[#00509e]">
                  No deposits match the selected filter.
                </td>
              </tr>
            ) : (
              deposits.map((d) => (
                <tr key={d.id} className="transition hover:bg-[#f4f8ff]">
                  <td className="whitespace-nowrap py-2 px-3.5 font-mono text-[11px] text-[#00509e] tabular-nums">
                    {d.deposit_date.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3.5 font-mono text-xs font-semibold text-[#003366] tabular-nums">
                    {formatINR(d.deposit_amount_paise)}
                  </td>
                  <td className="max-w-xs py-2 px-3.5">
                    <span className="block truncate font-mono text-[11px] text-[#003366]">
                      {d.narrative_raw}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 px-3.5">
                    {renderBadge(d.engine, d.status)}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3.5 font-mono text-[11px] text-[#00509e]">
                    {d.matched_utr ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#003366]">{d.matched_utr}</span>
                        <button
                          onClick={() => handleCopy(d.matched_utr!, d.id)}
                          className="text-[#00509e] transition hover:text-[#003366]"
                          title="Copy UTR"
                        >
                          {copiedId === d.id ? (
                            <Check className="h-3 w-3 text-[#003366]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="italic text-[#00509e]/70">Unmatched</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 px-3.5 text-right font-mono font-medium text-[#003366] tabular-nums">
                    {d.confidence !== null ? `${(d.confidence * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-3.5 flex flex-col justify-between gap-2 text-xs text-[#00509e] sm:flex-row sm:items-center">
        <div>
          Showing <span className="font-mono font-semibold text-[#003366] tabular-nums">{startRow}</span> to{" "}
          <span className="font-mono font-semibold text-[#003366] tabular-nums">{endRow}</span> of{" "}
          <span className="font-mono font-semibold text-[#003366] tabular-nums">{total}</span> total deposits
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="flex items-center gap-1 border border-[#cce0ff] bg-white px-2 py-1 text-xs text-[#00509e] transition hover:bg-[#f4f8ff] hover:text-[#003366] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          <span className="border border-[#cce0ff] bg-[#f4f8ff] px-2.5 py-1 font-mono text-xs text-[#003366] tabular-nums">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="flex items-center gap-1 border border-[#cce0ff] bg-white px-2 py-1 text-xs text-[#00509e] transition hover:bg-[#f4f8ff] hover:text-[#003366] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
