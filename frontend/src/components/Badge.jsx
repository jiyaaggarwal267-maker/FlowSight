const TONES = {
  neutral: "bg-surface-container-high text-on-surface",
  neutralVariant: "bg-surface-container text-on-surface-variant",
  primary: "bg-primary text-on-primary",
  primaryContainer: "bg-primary-container text-on-primary",
  primaryFixed: "bg-primary-fixed text-on-primary-fixed",
  secondaryContainer: "bg-secondary-container text-on-secondary-fixed",
  secondaryFixed: "bg-secondary-fixed text-on-secondary-fixed",
  tertiaryContainer: "bg-tertiary-container text-on-tertiary",
  tertiaryFixed: "bg-tertiary-fixed text-on-tertiary-fixed",
  errorContainer: "bg-error-container text-on-error-container",
  error: "bg-error text-on-error",
  success: "bg-emerald-50 text-emerald-800",
}

function Badge({ tone = "neutral", dot, children, className = "", ...rest }) {
  const tones = TONES[tone] || TONES.neutral
  return (
    <span
      className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded font-label-caps text-label-caps ${tones} ${className}`}
      {...rest}
    >
      {dot ? <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span> : null}
      {children}
    </span>
  )
}

export default Badge