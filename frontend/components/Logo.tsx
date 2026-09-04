import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

export const LSLogo: React.FC<LogoProps> = ({ size = 32, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LedgerSync Monogram"
    >
      {/* Deep Navy Vault Base */}
      <rect width="40" height="40" rx="6" fill="#003366" />

      {/* L Pillar: Vertical stem and horizontal base */}
      <path d="M8 8H13V27H23V32H8V8Z" fill="#FFFFFF" />

      {/* S Interlocking Geometry: 3 clean horizontal steps with vertical ties */}
      <path
        d="M17 8H31V13H22V17H29C30.6569 17 32 18.3431 32 20V27C32 28.6569 30.6569 30 29 30H17V25H27V22H20C18.3431 22 17 20.6569 17 19V8Z"
        fill="#FFFFFF"
      />

      {/* Bright Blue Precision Notch */}
      <rect x="25" y="9.5" width="4" height="2" fill="#007acc" />
    </svg>
  );
};
