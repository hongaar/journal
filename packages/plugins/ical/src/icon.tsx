export function IcalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M7 2v4M17 2v4M3 9h18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="7" y="12" width="4" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}
