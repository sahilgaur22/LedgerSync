import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LedgerSync — Financial Reconciliation & Audit Terminal",
  description: "Enterprise bank settlement reconciliation with deterministic matching, forensic AI research, and circuit-breaker resilience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-white font-sans text-[#003366] antialiased selection:bg-[#cce0ff] selection:text-[#003366]">
        {children}
      </body>
    </html>
  );
}
