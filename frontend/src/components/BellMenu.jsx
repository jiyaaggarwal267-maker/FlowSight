import { useEffect, useRef, useState } from "react"
import MaterialIcon from "./MaterialIcon.jsx"
import { bus, getNotifications } from "../lib/runtime.js"

const TONE_DOT = {
  error: "bg-error",
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
}

export default function BellMenu({ className = "" }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(getNotifications)
  const [count, setCount] = useState(getNotifications().length)
  const ref = useRef(null)

  useEffect(() => {
    const unsub = bus.on("notify", () => {
      setItems(getNotifications())
      setCount((c) => c + 1)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        aria-label="Notifications"
        className="relative w-9 h-8 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setCount(0)
        }}
        type="button"
      >
        <MaterialIcon name={open ? "notifications_active" : "notifications_none"} className="text-[19px]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[85vw] bg-surface-container-lowest shadow-xl ring-1 ring-outline-variant rounded-xl p-space-sm z-[80] animate-page-in">
          <div className="flex items-center justify-between px-space-sm py-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface font-semibold uppercase tracking-wider">Live Alerts</span>
            <span className="flex items-center gap-1 font-label-caps text-label-caps text-error font-bold">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-error opacity-60"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-error"></span>
              </span>
              LIVE
            </span>
          </div>
          <div className="flex flex-col max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div
                className="flex flex-col gap-0.5 px-space-sm py-space-sm rounded-lg hover:bg-surface-container-low cursor-pointer border-l-2"
                key={item.id}
                style={{
                  borderLeftColor: `var(--color-${item.tone === "error" ? "error" : item.tone})`,
                }}
              >
                <div className="flex items-center gap-space-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[item.tone] || "bg-primary"}`}></span>
                  <span className="font-body-md text-body-md text-on-surface font-semibold">{item.title}</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant pl-3">{item.body}</span>
                <span className="font-label-caps text-label-caps text-outline pl-3">{item.time}</span>
              </div>
            ))}
          </div>
          <div className="px-space-sm py-space-xs border-t border-surface-container-high mt-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant">Notifications are simulated for the demo workspace.</span>
          </div>
        </div>
      )}
    </div>
  )
}