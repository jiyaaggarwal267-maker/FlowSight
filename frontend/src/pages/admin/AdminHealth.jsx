import { useRef, useState, useEffect } from "react"
import { Link } from "react-router-dom"
import AnimatedNumber from "../../components/AnimatedNumber.jsx"
import { api } from "../../lib/api.js"

const SERVICE_META = {
  api: { icon: "swap_calls", name: "API Gateway", desc: "REST ingress for analyst, admin, and public endpoints across the FlowSight platform." },
  detection_engine: { icon: "hub", name: "Detection Engine", desc: "Pattern rule evaluation over ingested transactions: circular flow, fan-in/out, velocity, and behavioral deviations." },
  storage: { icon: "dataset", name: "Storage Layer", desc: "Persistent ledger of accounts, transactions, alerts, rules, and investigation artifacts." },
}

const CHANNEL_META = {
  UPI: { sub: "NPCI National Switch", badge: "UPI 2.0" },
  IMPS: { sub: "NPCI IMPS Network", badge: "IMPS" },
  NEFT: { sub: "RBI Retail System", badge: "NEFT" },
  RTGS: { sub: "RBI Settlement", badge: "RTGS" },
}

function AdminHealth() {
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const [health, setHealth] = useState(null)
  const [channels, setChannels] = useState(null)
  const toastTimer = useRef(null)

  const refreshTelemetry = () => {
    if (refreshing) return
    setRefreshing(true)
    load()
    showToast(`Telemetry snapshot refreshed · ${new Date().toLocaleTimeString("en-IN")} IST`)
    setTimeout(() => setRefreshing(false), 700)
  }

  const load = () => {
    api.adminHealth().then(setHealth).catch(() => {})
    api.overview().then((o) => setChannels(o.channels)).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  const showToast = (message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  const services = health?.services || {}
  const counts = health?.counts || {}
  const rules = health?.rules || {}
  const serviceNames = Object.keys(SERVICE_META)
  const operationalCount = serviceNames.filter((k) => services[k] === "operational").length
  const allOperational = operationalCount === serviceNames.length
  const uptime = serviceNames.length ? (operationalCount / serviceNames.length) * 100 : 100

  const METRICS = [
    { eyebrow: "Tracked Accounts", value: counts.accounts != null ? counts.accounts.toLocaleString("en-IN") : "…", unit: "accounts", icon: "account_balance", footerLabel: "Monitored continuously", footerIcon: "trending_up", footerClass: "text-primary", spark: "M0 16 L 15 14 L 30 18 L 45 10 L 60 12 L 80 4" },
    { eyebrow: "Ingestion Volume", value: counts.transactions != null ? counts.transactions.toLocaleString("en-IN") : "…", unit: "txns ingested", icon: "dynamic_feed", footerLabel: "Across UPI / NEFT / IMPS / RTGS", footerIcon: "trending_up", footerClass: "text-on-surface-variant", spark: "M0 12 L 18 10 L 32 15 L 48 6 L 64 8 L 80 3" },
    { eyebrow: "Active Alerts", value: counts.alerts != null ? counts.alerts : "…", unit: "in triage", icon: "notifications_active", footerLabel: "Awaiting analyst review", footerIcon: "priority_high", footerClass: "text-on-surface-variant", spark: "M0 16 L 20 16 L 40 16 L 60 16 L 80 16" },
    { eyebrow: "Detection Rules", value: rules.total != null ? rules.total : "…", unit: "engine rules", unitClass: rules.healthy === false ? "text-error font-medium" : "text-primary font-medium", icon: "policy", footerLabel: rules.healthy === false ? "Rule set drift detected" : "Rule set healthy", footerIcon: rules.healthy === false ? "warning" : "check_circle", footerClass: rules.healthy === false ? "text-error" : "text-primary", quorum: `Engine v${health?.version || "—"}` },
  ]

  const SERVICES = serviceNames.map((k) => ({
    icon: SERVICE_META[k].icon,
    name: SERVICE_META[k].name,
    badge: k === "api" ? `Version ${health?.version || "—"}` : k === "detection_engine" ? `${rules.total || "—"} Active Rules` : "Persistent Ledger",
    desc: SERVICE_META[k].desc,
    m1: ["Status", String(services[k] || "…").toUpperCase()],
    m2: k === "api" ? ["Latency", health?.database === "connected" ? "OK" : "DEGRADED"] : k === "detection_engine" ? ["Rule Health", rules.healthy === false ? "DRIFT" : "HEALTHY"] : ["Records", counts.transactions != null ? counts.transactions.toLocaleString("en-IN") : "…"],
    spark: "M2 14 L 18 16 L 34 10 L 50 16 L 66 8 L 82 10 L 94 4",
    cy: 4,
  }))

  const channelRows = channels ? Object.entries(channels).map(([name, count]) => ({ name, count, meta: CHANNEL_META[name] || {} })) : []
  const channelTotal = channelRows.reduce((s, c) => s + (Number(c.count) || 0), 0)
  const CONNECTORS = channels
    ? channelRows.map((c) => {
        const pct = channelTotal ? Math.round((Number(c.count) / channelTotal) * 100) : 0
        return {
          name: c.name,
          sub: c.meta.sub || "Clearing Rail",
          badge: c.meta.badge || "NATIONAL",
          label: "Rupee Volume (₹)",
          txns: (Math.round(Number(c.count || 0))).toLocaleString("en-IN"),
          share: `${pct}%`,
          pct: `${pct}%`,
        }
      })
    : []

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Operational Banner / Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md py-space-lg">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-lg text-headline-lg text-on-surface">System Health</span>
            <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-caps text-label-caps">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              LIVE STATUS · ENGINE v{health?.version || "—"}
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">Real-time telemetry and infrastructure status across detection pipelines.</p>
        </div>
        {/* Actions & Global Health Pill */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-lowest shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="font-label-caps text-label-caps text-on-surface font-semibold tracking-wider">{allOperational ? "ALL SERVICES OPERATIONAL" : "PARTIAL SYSTEM DEGRADATION"}</span>
            <span className="text-outline-variant font-body-sm text-body-sm">·</span>
            <span className="font-numeric-md text-numeric-md text-primary font-semibold">
              <AnimatedNumber format={(v) => `${v.toFixed(0)}% Service Uptime`} value={uptime} />
            </span>
          </div>
          <button onClick={refreshTelemetry} className="flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container-lowest hover:bg-surface-container-high text-on-surface shadow-sm transition-all duration-150">
            <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${refreshing ? "animate-spin" : ""}`}>autorenew</span>
            <span className="font-label-sm text-label-sm">Refresh Telemetry</span>
          </button>
          <Link to="/admin/audit-logs" className="flex items-center gap-space-2xs px-space-md py-space-xs rounded bg-surface-container-high hover:bg-surface-container text-on-surface-variant font-label-sm text-label-sm transition-colors">
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Incident History</span>
          </Link>
        </div>
      </div>
      {/* Section 1: Top Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-xl">
        {METRICS.map((m) => (
          <div key={m.eyebrow} className="relative overflow-hidden p-space-base rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between group">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-space-2xs">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">{m.eyebrow}</span>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-numeric-lg text-numeric-lg text-on-surface tracking-tight">{m.value}</span>
                  <span className={`font-body-sm text-body-sm text-on-surface-variant ${m.unitClass || ""}`}>{m.unit}</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
              </div>
            </div>
            <div className="mt-space-md flex items-center justify-between pt-space-xs">
              <div className={`flex items-center gap-1 font-label-sm text-label-sm ${m.footerClass}`}>
                {m.footerIcon && <span className="material-symbols-outlined text-[14px]">{m.footerIcon}</span>}
                <span>{m.footerLabel}</span>
              </div>
              {m.spark && (
                <svg className="w-20 h-5 overflow-visible text-primary" fill="none" viewBox="0 0 80 20">
                  <path className="spark-draw" d={m.spark} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"></path>
                </svg>
              )}
              {m.quorum && <span className="font-numeric-md text-numeric-md text-outline">{m.quorum}</span>}
            </div>
          </div>
        ))}
      </div>
      {/* Section 2: Core Service Pipeline Components */}
      <div className="flex flex-col gap-space-md mb-space-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-md text-headline-md text-on-surface">Core Detection Pipeline Services</span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-caps text-label-caps font-semibold">{SERVICES.length} ACTIVE SUBSYSTEMS</span>
          </div>
          <span className="font-label-sm text-label-sm text-outline">Auto-balancing enabled</span>
        </div>
        <div className="flex flex-col gap-space-sm">
          {SERVICES.map((s) => (
            <div key={s.name} className="flex flex-col md:flex-row md:items-center justify-between p-space-base rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow gap-space-base">
              <div className="flex items-start gap-space-md min-w-0">
                <div className="w-10 h-10 rounded-lg bg-surface-container-low flex-shrink-0 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-space-xs flex-wrap">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">{s.name}</span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-caps text-label-caps">{s.badge}</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{s.desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-space-lg flex-shrink-0">
                <div className="flex items-center gap-space-lg">
                  <div className="flex flex-col items-end">
                    <span className="font-label-caps text-label-caps text-outline uppercase">{s.m1[0]}</span>
                    <span className="font-numeric-md text-numeric-md text-on-surface font-semibold">{s.m1[1]}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-label-caps text-label-caps text-outline uppercase">{s.m2[0]}</span>
                    <span className="font-numeric-md text-numeric-md text-on-surface font-semibold">{s.m2[1]}</span>
                  </div>
                </div>
                {/* Mini Sparkline SVG */}
                <div className="w-24 h-7 hidden sm:flex items-center">
                  <svg className="w-full h-full text-primary" fill="none" viewBox="0 0 96 28">
                    <path className="spark-draw" d={s.spark} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    <circle className="animate-ping-soft origin-center" cx="94" cy={s.cy} fill="currentColor" r="2.5"></circle>
                    <circle cx="94" cy={s.cy} fill="currentColor" r="2.5"></circle>
                  </svg>
                </div>
                {/* Status Pill */}
                <div className={`flex items-center gap-1.5 px-space-sm py-1 rounded-full ${s.m1[1] === "OPERATIONAL" ? "bg-surface-container-low text-primary" : "bg-error-container text-error"}`}>
                  <span className={`w-2 h-2 rounded-full ${s.m1[1] === "OPERATIONAL" ? "bg-primary" : "bg-error"}`}></span>
                  <span className="font-label-sm text-label-sm font-semibold">{s.m1[1] === "OPERATIONAL" ? "Operational" : "Degraded"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Section 3: Infrastructure & Bank Core Connectors */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-md text-headline-md text-on-surface">Live Bank Core Connectors</span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-caps text-label-caps font-semibold">{CONNECTORS.length} CLEARING RAILS</span>
          </div>
          <div className="flex items-center gap-space-sm font-body-sm text-body-sm text-outline">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span> Overseen by Detection Engine</span>
            <span>·</span>
            <span>{CONNECTORS.length} clearing rails tracked</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {CONNECTORS.map((c) => (
            <div key={c.name} className="p-space-base rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between group">
              <div className="flex items-start justify-between mb-space-base">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{c.name}</span>
                  <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">{c.sub}</span>
                </div>
                <span className="px-space-xs py-0.5 rounded text-label-caps font-label-caps font-bold bg-surface-container-high text-on-surface-variant">{c.badge}</span>
              </div>
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface-variant">{c.label}</span>
                  <span className="font-numeric-md text-numeric-md text-on-surface font-semibold">{c.txns}</span>
                </div>
                <div className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="text-on-surface-variant">Share of Volume</span>
                  <span className="font-numeric-md text-numeric-md text-primary font-semibold">{c.share}</span>
                </div>
              </div>
              <div className="mt-space-base pt-space-xs">
                <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant mb-1">
                  <span>Proportion of ledger</span>
                  <span>{c.share}</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: c.pct }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-space-base py-2.5 rounded-lg bg-on-surface text-surface-container-low shadow-lg transition-transform duration-300 translate-y-0">
          <span className="material-symbols-outlined text-[18px]">task_alt</span>
          <span className="font-label-sm text-label-sm">{toast}</span>
        </div>
      )}
    </div>
  )
}

export default AdminHealth