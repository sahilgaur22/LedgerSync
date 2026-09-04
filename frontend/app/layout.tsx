import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LedgerSync AI — Autonomous Financial Controller",
  description: "Enterprise bank settlement reconciliation with deterministic matching, forensic AI research, and circuit-breaker resilience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#070a13] text-slate-100 antialiased selection:bg-blue-500/30 selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
