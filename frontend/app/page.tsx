"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { BatchScorecard } from "@/components/BatchScorecard";
import { TelemetryFunnel } from "@/components/TelemetryFunnel";
import { ExceptionWorkspace, ExceptionItem } from "@/components/ExceptionWorkspace";
import { MasterLedgerTable } from "@/components/MasterLedgerTable";

const API_BASE = "http://127.0.0.1:8000";

export default function DashboardPage() {
  const [circuitState, setCircuitState] = useState<string>("CLOSED");
  const [isRunningBatch, setIsRunningBatch] = useState<boolean>(false);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [feeCriticData, setFeeCriticData] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch all core dashboard telemetry
  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Scorecard & Circuit Breaker
      const scRes = await fetch(`${API_BASE}/api/scorecard`);
      if (scRes.ok) {
        const data = await scRes.json();
        setScorecardData(data.scorecard || null);
        setFeeCriticData(data.fee_critic || null);
        if (data.circuit_breaker?.state) {
          setCircuitState(data.circuit_breaker.state);
        }
      }

      // 2. ROC Metrics
      const mRes = await fetch(`${API_BASE}/api/metrics`);
      if (mRes.ok) {
        const data = await mRes.json();
        setMetricsData(data);
      }

      // 3. Exceptions
      const exRes = await fetch(`${API_BASE}/api/exceptions`);
      if (exRes.ok) {
        const data = await exRes.json();
        setExceptions(data);
      }
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Circuit breaker trip simulation
  const handleTripBreaker = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/circuit-breaker/trip`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error("Trip breaker error:", err);
    }
  };

  // Circuit breaker manual reset
  const handleResetBreaker = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/circuit-breaker/reset`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error("Reset breaker error:", err);
    }
  };

  // Run full batch reconciliation
  const handleRunBatch = async () => {
    try {
      setIsRunningBatch(true);
      const res = await fetch(`${API_BASE}/api/batches/ingest`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error("Run batch error:", err);
    } finally {
      setIsRunningBatch(false);
    }
  };

  // Exception action handler (APPROVE, REJECT, OVERRIDE)
  const handleExceptionAction = async (
    exceptionId: string,
    action: "APPROVE" | "REJECT" | "OVERRIDE",
    notes?: string
  ) => {
    const res = await fetch(`${API_BASE}/api/exceptions/${exceptionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Action failed");
    }

    // Refresh exceptions & scorecard
    await fetchDashboardData();
  };

  // Derived cascade counts for TelemetryFunnel
  const total = scorecardData?.total_deposits ?? 500;
  const exact = scorecardData?.breakdown?.exact_matches ?? 425;
  const fuzzy = scorecardData?.breakdown?.fuzzy_matches ?? 50;
  const subset = scorecardData?.breakdown?.subset_matches ?? 10;
  const unresolved = scorecardData?.breakdown?.unresolved_ai_researched ?? 15;

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 pb-16">
      {/* Top Navigation Bar */}
      <Navbar
        circuitState={circuitState}
        onTripBreaker={handleTripBreaker}
        onResetBreaker={handleResetBreaker}
        onRunBatch={handleRunBatch}
        isRunningBatch={isRunningBatch}
      />

      {/* Main Dashboard Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Section 1: Executive Batch Scorecard */}
        <BatchScorecard
          scorecard={scorecardData}
          feeCritic={feeCriticData}
          metrics={metricsData}
        />

        {/* Section 2: Cascade Engine Telemetry Funnel */}
        <TelemetryFunnel
          total={total}
          exact={exact}
          fuzzy={fuzzy}
          subset={subset}
          unresolved={unresolved}
        />

        {/* Section 3: Audit Exception Review Workspace */}
        <ExceptionWorkspace
          exceptions={exceptions}
          onAction={handleExceptionAction}
        />

        {/* Section 4: Master Bank Ledger Table */}
        <MasterLedgerTable />
      </main>
    </div>
  );
}
