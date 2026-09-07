import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import MaterialIcon from "./MaterialIcon.jsx"
import { bus, getTheme, setTheme } from "../lib/runtime.js"

const COMMANDS = [
  { label: "Analyst Overview", hint: "analyst", icon: "dashboard", path: "/app/overview" },
  { label: "Network Explorer", hint: "graph · INV-042", icon: "hub", path: "/app/network-explorer" },
  { label: "Alerts Triage", hint: "live queue", icon: "notifications_none", path: "/app/alerts" },
  { label: "Flow Timeline", hint: "investigation · INV-042", icon: "timeline", path: "/app/investigations/inv-042" },
  { label: "Entity Profile", hint: "AC-20491", icon: "account_balance", path: "/app/entities/ac-20491" },
  { label: "AI Investigator", hint: "copilot", icon: "auto_awesome", path: "/app/ai-investigator" },
  { label: "Investigation Reports", hint: "filings", icon: "description", path: "/app/reports" },
  { label: "Admin Overview", hint: "admin", icon: "admin_panel_settings", path: "/admin/overview" },
  { label: "User Management", hint: "admin", icon: "group", path: "/admin/users" },
  { label: "Rule Engine", hint: "admin", icon: "rule", path: "/admin/rules" },
  { label: "Audit Logs", hint: "admin", icon: "fact_check", path: "/admin/audit-logs" },
  { label: "Platform Health", hint: "admin", icon: "monitor_heart", path: "/admin/health" },
  { label: "Account Settings", hint: "profile · analyst", icon: "settings", path: "/analyst/settings" },
  { label: "Admin Settings", hint: "profile · admin", icon: "tune", path: "/admin/settings" },
  { label: "FLOWSIGHT Home", hint: "public", icon: "home", path: "/" },
]

const ACTIONS = [
  { label: "Toggle dark mode", hint: "theme", icon: "dark_mode", run: () => setTheme(getTheme() === "dark" ? "light" : "dark") },
  { label: "Launch Analyst Console", hint: "go", icon: "login", path: "/login" },
]

function fuzzyScore(query, text) {
  const q = query.toLowerCase().trim()
  if (!q) return 1
  const t = text.toLowerCase()
  let i = 0
  let score = 0
  for (const ch of q) {
    const idx = t.indexOf(ch, i)
    if (idx === -1) return 0
    score += idx === i ? 2 : 1
    i = idx + 1
  }
  return score
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery("")
        setIndex(0)
      }
      if (e.key === "Escape") setOpen(false)
    }
    const onOpen = () => {
      setOpen(true)
      setQuery("")
      setIndex(0)
    }
    window.addEventListener("keydown", onKey)
    const unsub = bus.on("open-palette", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      unsub()
    }
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const results = useMemo(() => {
    const all = [
      ...COMMANDS.map((c) => ({ ...c, kind: "page" })),
      ...ACTIONS.map((c) => ({ ...c, kind: "action" })),
    ]
    return all
      .map((c) => ({ ...c, score: fuzzyScore(query, `${c.label} ${c.hint}`) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [query])

  if (!open) return null

  const trigger = (item) => {
    if (item.kind === "action" && !item.path) {
      item.run()
      setOpen(false)
      return
    }
    navigate(item.path)
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[18vh] px-space-md bg-black/30 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl ring-1 ring-outline-variant overflow-hidden animate-page-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-space-md px-space-md h-12">
          <MaterialIcon name="search" className="text-outline text-[20px]" />
          <input
            className="flex-1 h-full bg-transparent font-body-lg text-body-lg text-on-surface placeholder:text-outline focus:outline-none"
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, results.length - 1))
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setIndex((i) => Math.max(i - 1, 0))
              }
              if (e.key === "Enter" && results[index]) trigger(results[index])
            }}
            placeholder="Search pages, accounts, cases…"
            ref={inputRef}
            type="text"
            value={query}
          />
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container-high font-label-caps text-label-caps text-on-surface-variant uppercase">esc</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-space-sm border-t border-surface-container-high">
          {results.length === 0 && (
            <div className="px-space-md py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
              No matches for “{query}”. Try an account ID like AC-20491.
            </div>
          )}
          {results.map((item, i) => (
            <button
              className={`w-full text-left flex items-center gap-space-md px-space-md py-2.5 rounded-lg transition-colors cursor-pointer ${
                i === index ? "bg-primary-container/30" : "hover:bg-surface-container-low"
              }`}
              key={`${item.kind}-${item.label}`}
              onClick={() => trigger(item)}
              onMouseEnter={() => setIndex(i)}
              type="button"
            >
              <MaterialIcon className={`text-[18px] ${i === index ? "text-primary" : "text-outline"}`} name={item.icon} />
              <span className="flex-1 font-body-md text-body-md text-on-surface font-medium">{item.label}</span>
              <span className="font-label-caps text-label-caps text-outline uppercase">{item.kind === "action" ? "action" : item.hint}</span>
            </button>
          ))}
        </div>
        <div className="px-space-md py-space-xs flex items-center gap-space-md border-t border-surface-container-high bg-surface-container-lowest">
          <span className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant">
            <kbd className="px-1 rounded bg-surface-container-high">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant">
            <kbd className="px-1 rounded bg-surface-container-high">↵</kbd> open
          </span>
          <span className="flex-1 font-label-caps text-label-caps text-outline text-right">FLOWSIGHT Navigator</span>
        </div>
      </div>
    </div>
  )
}