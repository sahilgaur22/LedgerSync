"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { LSLogo } from "./Logo";

interface NavbarProps {
  circuitState: string;
  onTripBreaker: () => void;
  onResetBreaker: () => void;
  onRunBatch: () => void;
  isRunningBatch: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  circuitState,
  onTripBreaker,
  onResetBreaker,
  onRunBatch,
  isRunningBatch,
}) => {
  const isClosed = circuitState === "CLOSED";

  return (
    <header className="sticky top-0 z-50 border-b border-[#cce0ff] bg-white px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand: Monogram + Wordmark + Subtitle */}
        <div className="flex items-center gap-3">
          <LSLogo size={32} />
          <div className="flex items-baseline gap-2.5">
            <span className="text-lg font-semibold tracking-tight text-[#003366]">
              LedgerSync
            </span>
            <span className="hidden text-xs text-[#00509e] sm:inline-block">
              Reconciliation & Audit Terminal
            </span>
          </div>
        </div>

        {/* Reorganized Controls on Right */}
        <div className="flex items-center gap-3">
          {/* Circuit Breaker Status: Quiet, restrained indicator (no pulsing neon) */}
          <div className="flex items-center gap-2 border border-[#cce0ff] bg-[#f4f8ff] px-2.5 py-1 text-xs text-[#003366]">
            <span className="text-[#00509e]">Circuit Breaker:</span>
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isClosed ? "bg-[#00509e]" : "bg-[#003366] ring-1 ring-[#cce0ff]"
                }`}
              />
              <span>{isClosed ? "Closed (Normal)" : "Open (Degraded)"}</span>
            </div>
          </div>

          {/* Interactive Trip/Reset Breaker Toggle: Restrained border button */}
          {isClosed ? (
            <button
              onClick={onTripBreaker}
              className="border border-[#cce0ff] px-2.5 py-1 text-xs font-medium text-[#00509e] transition hover:bg-[#f4f8ff] hover:text-[#003366]"
              title="Simulate 5 consecutive external AI service outage errors to trip the circuit breaker"
            >
              Trip Breaker
            </button>
          ) : (
            <button
              onClick={onResetBreaker}
              className="border border-[#00509e] bg-[#f4f8ff] px-2.5 py-1 text-xs font-medium text-[#003366] transition hover:bg-[#cce0ff]/50"
              title="Reset Circuit Breaker back to CLOSED"
            >
              Reset Breaker
            </button>
          )}

          {/* Primary CTA: Solid bright blue #007acc (used sparingly) */}
          <button
            onClick={onRunBatch}
            disabled={isRunningBatch}
            className="flex items-center gap-2 bg-[#007acc] px-3.5 py-1 text-xs font-medium text-white transition hover:bg-[#00509e] disabled:bg-[#cce0ff] disabled:text-[#00509e]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunningBatch ? "animate-spin" : ""}`} />
            {isRunningBatch ? "Reconciling 500 Deposits..." : "Run Reconcile Batch"}
          </button>
        </div>
      </div>
    </header>
  );
};
