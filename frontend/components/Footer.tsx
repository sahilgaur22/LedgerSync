import React from "react";
import { LSLogo } from "./Logo";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-[#cce0ff] bg-[#f8fafd] px-6 py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
        {/* Left: Monogram and official product description */}
        <div className="flex items-center gap-3">
          <LSLogo size={20} />
          <span className="font-medium text-[#003366]">
            LedgerSync
          </span>
          <span className="text-[#cce0ff]">|</span>
          <span className="text-[#00509e]">
            Automated financial reconciliation and audit trail engine.
          </span>
        </div>

        {/* Right: Contact & Official GitHub Repository */}
        <div className="flex items-center gap-4 text-[#00509e]">
          <span className="font-mono text-[11px]">
            GitHub:{" "}
            <a
              href="https://github.com/sahilgaur22/LedgerSync"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[#66a3ff] hover:text-[#003366]"
            >
              github.com/sahilgaur22/LedgerSync
            </a>
          </span>
          <span className="text-[#cce0ff]">·</span>
          <span className="font-mono text-[11px]">
            Contact:{" "}
            <a
              href="mailto:LedgerSynx@email.com"
              className="text-[#003366] hover:underline"
            >
              LedgerSynx@email.com
            </a>
          </span>
        </div>
      </div>

      {/* Row 2: Architecture credits */}
      <div className="mx-auto mt-2.5 flex max-w-7xl items-center justify-between border-t border-[#cce0ff]/60 pt-2.5 text-[11px] text-[#00509e]/80">
        <div>
          Powered by deterministic reconciliation engines and AI-assisted research
        </div>
        <div>
          Deterministic audit & reconciliation terminal · Continuous verification
        </div>
      </div>
    </footer>
  );
};
