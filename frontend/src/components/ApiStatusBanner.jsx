import { useEffect, useState } from "react"
import { api, ApiUnavailableError } from "../lib/api.js"

/**
 * Watches the backend and narrates its state.
 *
 * The container can scale to zero or be redeployed, so the API can be briefly
 * unreachable while it boots. Without this the only signal is a page that
 * silently stops updating, which is indistinguishable from the backend being
 * broken. This banner states what is happening and disappears on its own once
 * the API answers again, so a transient blip never looks like a dead site.
 */
const POLL_MS = 20000

export default function ApiStatusBanner() {
  const [state, setState] = useState("checking") // checking | ok | degraded

  useEffect(() => {
    let cancelled = false
    let timer

    async function check() {
      try {
        const health = await api.health()
        if (cancelled) return
        setState(health.status === "ok" ? "ok" : "degraded")
      } catch (err) {
        if (cancelled) return
        // An unrecognised failure is treated as degraded rather than ok so the
        // banner errs on the side of telling the truth.
        setState(err instanceof ApiUnavailableError ? "degraded" : "degraded")
      } finally {
        if (!cancelled) timer = setTimeout(check, POLL_MS)
      }
    }

    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  if (state !== "degraded") return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] flex items-center justify-center gap-2 border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200 backdrop-blur-sm sm:text-sm"
    >
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      <span>
        Reconnecting to the FLOWSIGHT API — it is restarting. This page will recover
        automatically, no need to reload.
      </span>
    </div>
  )
}
