export default function Emblem({ className = "h-8 w-auto object-contain" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="FLOWSIGHT Emblem"
    >
      <circle cx="12" cy="24" r="5" fill="#1e293b" />
      <circle cx="28" cy="14" r="4.5" fill="#2563eb" />
      <circle cx="28" cy="34" r="4.5" fill="#2563eb" />
      <circle cx="40" cy="24" r="6" fill="#0f172a" />
      <path
        d="M16.5 22C20 20.5 22 17 24 15.5"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
      <path
        d="M16.5 26C20 27.5 22 31 24 32.5"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
      <path d="M32 15.5C34.5 17 36.5 20.5 38 22" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 32.5C34.5 31 36.5 27.5 38 26" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="24" r="2.5" fill="#3b82f6" fillOpacity="0.8" />
      <path d="M17 24H23.5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      <path d="M28.5 24H34" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}