"use client";


import React from "react";
import { Shield, Zap, RefreshCw, AlertTriangle, CheckCircle2, Flame } from "lucide-react";

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
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#070a13]/90 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">LedgerSync</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                AI Controller
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Autonomous Financial Settlement Reconciliation Engine
            </p>
          </div>
        </div>

        {/* Live Controls & Circuit Breaker Pill */}
        <div className="flex items-center gap-3">
          {/* Circuit Breaker Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Circuit Breaker:</span>
            {isClosed ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                CLOSED (Normal)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                OPEN (Degraded)
              </span>
            )}
          </div>

          {/* Interactive Demo Breaker Toggles */}
          {isClosed ? (
            <button
              onClick={onTripBreaker}
              className="text-xs px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 font-medium transition flex items-center gap-1.5"
              title="Simulate 5 consecutive Gemini 503 outage errors to trip the circuit breaker"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Trip Breaker
            </button>
          ) : (
            <button
              onClick={onResetBreaker}
              className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 font-medium transition flex items-center gap-1.5"
              title="Reset Circuit Breaker back to CLOSED"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Reset Breaker
            </button>
          )}

          {/* Run Batch Reconciliation Button */}
          <button
            onClick={onRunBatch}
            disabled={isRunningBatch}
            className="text-xs px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold transition flex items-center gap-2 shadow-md shadow-blue-600/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunningBatch ? "animate-spin" : ""}`} />
            {isRunningBatch ? "Reconciling 500 Deposits..." : "Run Reconcile Batch"}
          </button>
        </div>
      </div>
    </header>
  );
};
