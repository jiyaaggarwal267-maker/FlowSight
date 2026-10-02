import { useEffect } from "react"
import MaterialIcon from "./MaterialIcon.jsx"
import { AUDIENCE } from "../lib/tour.js"

function ContextModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-space-md bg-on-background/40 backdrop-blur-sm animate-page-in"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="fs-context-title"
        aria-modal="true"
        className="w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl ring-1 ring-outline-variant overflow-hidden animate-page-in"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start gap-space-md p-space-lg border-b border-surface-container-high">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <MaterialIcon name="domain_verification" className="text-[22px]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-semibold">
              Read this first
            </span>
            <h2
              className="font-headline-md text-headline-md text-on-surface tracking-tight"
              id="fs-context-title"
            >
              Who FLOWSIGHT is for
            </h2>
          </div>
          <button
            aria-label="Dismiss"
            className="p-1.5 -mr-1 -mt-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="p-space-lg flex flex-col gap-space-base">
          <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
            FLOWSIGHT is an{" "}
            <span className="font-semibold text-primary">internal financial crime intelligence tool</span>{" "}
            used by bank compliance teams and financial intelligence units (FIUs) to investigate
            suspicious transaction networks.
          </p>

          <div className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container-low border-l-4 border-error">
            <MaterialIcon name="block" className="text-[20px] text-error shrink-0 mt-px" />
            <p className="font-body-md text-body-md text-on-surface">
              It is <span className="font-semibold">not a customer-facing app</span> — no end user or
              bank customer ever interacts with this system directly. Everything you see here is
              evidence, tooling and controls for investigators and their regulators.
            </p>
          </div>

          <div className="flex flex-col gap-space-sm">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
              Built for
            </span>
            <div className="flex flex-wrap gap-space-xs">
              {AUDIENCE.map((a) => (
                <span
                  className="inline-flex items-center gap-1.5 px-space-md py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-semibold"
                  key={a.label}
                >
                  <MaterialIcon name={a.icon} className="text-[16px]" />
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-space-lg py-space-md bg-surface-container-low border-t border-surface-container-high flex flex-wrap items-center justify-between gap-space-sm">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Shown once per session · reopen anytime with{" "}
            <MaterialIcon name="info" className="text-[14px] align-[-3px]" /> in the header
          </span>
          <button
            className="h-9 px-space-lg rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-sm hover:bg-primary-container transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContextModal
