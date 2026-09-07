import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import { bus, notify } from "../../lib/runtime.js"
import { api } from "../../lib/api.js"

const FILTERS = ["All", "High Risk", "Medium Risk", "Under Review", "Resolved", "Archived"]

function AlertsTriage() {
  const [activeFilter, setActiveFilter] = useState("All")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [surfacing, setSurfacing] = useState(null)
  const surfacingTimer = useRef(null)
  const [alerts, setAlerts] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .alerts()
      .then((data) => {
        if (!alive) return
        setAlerts(data.items || [])
        setBusy(false)
      })
      .catch((err) => {
        if (!alive) return
        setError(String(err))
        setBusy(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const matchesFilter = (a) => {
    if (activeFilter === "High Risk") return a.severity === "critical" || a.severity === "high"
    if (activeFilter === "Medium Risk") return a.severity === "medium"
    if (activeFilter === "Under Review") return a.status === "under_review" || a.status === "review"
    if (activeFilter === "Resolved") return a.status === "resolved"
    if (activeFilter === "Archived") return a.status === "archived"
    return true
  }
  const filtered = alerts.filter(matchesFilter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const exportCsv = () => {
    const rows = [["alert_id", "pattern", "severity", "risk", "accounts", "transactions", "status"]]
    filtered.forEach((a) => rows.push([
      a.id, a.pattern, a.severity, a.risk,
      (a.accounts || []).join("|"), (a.transactions || []).join("|"), a.status || "open",
    ]))
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `flowsight-alerts-${activeFilter.replace(/\s+/g, "-").toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    notify({ title: "Alerts exported", body: `${filtered.length} rows written to CSV.`, tone: "primary" })
  }
  useEffect(() => {
    const unsub = bus.on("notify", (item) => {
      setSurfacing(item)
      if (surfacingTimer.current) clearTimeout(surfacingTimer.current)
      surfacingTimer.current = setTimeout(() => setSurfacing(null), 7000)
    })
    const t = setInterval(() => {
      notify({
        title: "New high-velocity pattern detected",
        body: "6-account fan-out from AC-66401 flagged · suggested case INV-043.",
        tone: "error",
      })
    }, 18000)
    return () => {
      unsub()
      clearInterval(t)
      if (surfacingTimer.current) clearTimeout(surfacingTimer.current)
    }
  }, [])

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Header Context Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-lg">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-caps text-label-caps uppercase text-primary tracking-wider font-semibold">Triage &amp; Forensics</span>
            <span className="text-outline text-body-sm">•</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant">Real-Time Graph Telemetry</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">Alerts</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Prioritized suspicious activity requiring analyst attention.</p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="relative flex items-center">
            <MaterialIcon name="search" className="absolute left-3 text-outline text-[18px]" />
            <input className="w-64 h-9 pl-9 pr-3 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md shadow-sm outline-none placeholder:text-outline focus:bg-surface-container-low transition-colors" placeholder="Filter alerts, pattern, rule ID..." type="text" />
          </div>
          <button className="flex items-center gap-space-xs h-9 px-space-md rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all shadow-sm cursor-pointer" type="button" onClick={() => notify({ title: "Window fixed to demo range", body: "Oct 1 – Oct 31, 2024 · last 30 days of seeded telemetry.", tone: "primary" })}>
            <MaterialIcon name="calendar_today" className="text-[18px] text-on-surface-variant" />
            <span className="font-body-sm text-body-sm font-medium">Last 30 Days (Oct 1 - Oct 31, 2024)</span>
            <MaterialIcon name="expand_more" className="text-[16px] text-outline" />
          </button>
          <button className="flex items-center gap-space-xs h-9 px-space-md rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest transition-all shadow-sm cursor-pointer border border-outline-variant/30" type="button" onClick={() => notify({ title: "Filter engine", body: "Use the severity tabs below — they filter this ledger live.", tone: "primary" })}>
            <MaterialIcon name="tune" className="text-[18px] text-on-surface-variant" />
            <span className="font-body-sm text-body-sm font-medium">Filter Engine</span>
          </button>
          <button className="flex items-center gap-space-xs h-9 px-space-md rounded bg-surface-container-high hover:bg-surface-container-highest active:scale-95 text-on-surface transition-all shadow-sm cursor-pointer" type="button" onClick={exportCsv}>
            <MaterialIcon name="file_download" className="text-[18px]" />
            <span className="font-body-sm text-body-sm font-medium">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Telemetry Highlights / Analytical Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md mb-space-lg">
        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase tracking-wider">High Velocity Queue</span>
            <MaterialIcon name="emergency" className="text-error text-[18px]" />
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-bold tracking-tight">{alerts.filter((a) => a.severity === "critical" || a.severity === "high").length} Critical</span>
            <span className="font-body-sm text-body-sm text-error font-medium flex items-center">+4 in 1hr</span>
          </div>
          <div className="w-full bg-surface-container-high h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-error h-full rounded-full w-2/3"></div>
          </div>
        </div>
        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase tracking-wider">Total Value At Risk</span>
            <MaterialIcon name="currency_rupee" className="text-primary text-[18px]" />
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-bold tracking-tight">₹86.59 Lakh</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">30d cumulative</span>
          </div>
          <div className="w-full bg-surface-container-high h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-primary h-full rounded-full w-4/5"></div>
          </div>
        </div>
        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase tracking-wider">Active Entities Implicated</span>
            <MaterialIcon name="hub" className="text-tertiary text-[18px]" />
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-bold tracking-tight">45 Mules / Nodes</span>
            <span className="font-body-sm text-body-sm text-secondary font-medium">Across 8 Banks</span>
          </div>
          <div className="w-full bg-surface-container-high h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-tertiary h-full rounded-full w-1/2"></div>
          </div>
        </div>
        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase tracking-wider">Avg Triage Speed</span>
            <MaterialIcon name="speed" className="text-secondary text-[18px]" />
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-bold tracking-tight">18.4 mins</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">SLA Target &lt; 30m</span>
          </div>
          <div className="w-full bg-surface-container-high h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-secondary h-full rounded-full w-11/12"></div>
          </div>
        </div>
      </div>

      {/* Primary Investigative Ledger Surface */}
      <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden flex flex-col">
        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between px-space-base pt-space-sm bg-surface-container-lowest">
          <div className="flex items-center gap-space-xs overflow-x-auto">
{alerts.length > 0 ? (
                    FILTERS.map((f) => {
                      const count = f === "All" ? alerts.length : alerts.filter((a) => {
                        if (f === "High Risk") return a.severity === "critical" || a.severity === "high"
                        if (f === "Medium Risk") return a.severity === "medium"
                        if (f === "Under Review") return a.status === "under_review" || a.status === "review"
                        if (f === "Resolved") return a.status === "resolved"
                        return false
                      }).length
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => { setActiveFilter(f); setPage(1) }}
                          className={
                            activeFilter === f
                              ? "flex items-center gap-space-xs px-space-md py-space-sm rounded font-headline-sm text-headline-sm text-primary bg-secondary-container transition-colors cursor-pointer"
                              : "flex items-center gap-space-xs px-space-md py-space-sm rounded font-headline-sm text-headline-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          }
                        >
                          {f === "High Risk" && <span className="w-2 h-2 rounded-full bg-error"></span>}
                          {f === "Medium Risk" && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                          <span>{f}</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-label-caps text-label-caps ${activeFilter === f ? "bg-surface-container-lowest text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    FILTERS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => { setActiveFilter(f); setPage(1) }}
                        className={
                          activeFilter === f
                            ? "flex items-center gap-space-xs px-space-md py-space-sm rounded font-headline-sm text-headline-sm text-primary bg-secondary-container transition-colors cursor-pointer"
                            : "flex items-center gap-space-xs px-space-md py-space-sm rounded font-headline-sm text-headline-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                        }
                      >
                        {f === "High Risk" && <span className="w-2 h-2 rounded-full bg-error"></span>}
                        {f === "Medium Risk" && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                        <span>{f}</span>
                        <span className={`px-1.5 py-0.5 rounded-full font-label-caps text-label-caps ${activeFilter === f ? "bg-surface-container-lowest text-primary" : "bg-surface-container text-on-surface-variant"}`}>0</span>
                      </button>
                    ))
                  )}
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="relative flex w-1.5 h-1.5">
                <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-error opacity-60"></span>
                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-error"></span>
              </span>
              Live Sorting: Score (High → Low)
            </span>
          </div>
        </div>

        {surfacing && (
          <div className="mx-space-base mt-space-sm flex items-center justify-between gap-space-md p-space-md rounded-lg bg-error-container/40 ring-1 ring-inset ring-error/30 animate-page-in">
            <div className="flex items-center gap-space-md min-w-0">
              <span className="relative flex w-2.5 h-2.5 flex-shrink-0">
                <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-error opacity-60"></span>
                <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-error"></span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{surfacing.title}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{surfacing.body}</span>
              </div>
            </div>
            <Link className="flex-shrink-0 px-space-md py-1.5 rounded-lg bg-error text-on-error font-label-sm text-label-sm font-semibold hover:bg-on-error hover:text-error transition-colors flex items-center gap-1" to="/analyst/alerts">
              <span>Investigate</span>
              <MaterialIcon name="arrow_forward" className="text-[14px]" />
            </Link>
          </div>
        )}

        {/* Data Table Canvas */}
        <div className="overflow-x-auto w-full mt-space-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider h-9">
                <th className="pl-space-base pr-space-sm py-2">Alert ID</th>
                <th className="px-space-sm py-2 min-w-[260px]">Pattern Archetype</th>
                <th className="px-space-sm py-2">Risk Score</th>
                <th className="px-space-sm py-2">Flagged Accounts</th>
                <th className="px-space-sm py-2 text-right">Total Amount</th>
                <th className="px-space-sm py-2">Detected</th>
                <th className="px-space-sm py-2">Status</th>
                <th className="pl-space-sm pr-space-base py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {busy && (
                <tr>
                  <td colSpan={8} className="px-space-base py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
                    Loading live alerts from detection engine…
                  </td>
                </tr>
              )}
              {!busy && error && (
                <tr>
                  <td colSpan={8} className="px-space-base py-space-lg text-center">
                    <span className="font-body-sm text-body-sm text-error">{error}</span>
                  </td>
                </tr>
              )}
              {!busy && !error && alerts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-space-base py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
                    No alerts detected.
                  </td>
                </tr>
              )}
              {!busy && !error && pageRows.map((a) => {
                const tone =
                  a.severity === "critical" ? "bg-error-container text-on-error-container" :
                  a.severity === "high" ? "bg-amber-100 text-amber-900" :
                  a.severity === "medium" ? "bg-secondary-container text-on-secondary-fixed-variant" :
                  "bg-surface-container text-on-surface"
                const dot =
                  a.severity === "critical" ? "bg-error" :
                  a.severity === "high" ? "bg-amber-600" :
                  a.severity === "medium" ? "bg-secondary" :
                  "bg-primary"
                return (
                  <tr key={a.id} className="h-table-row-h hover:bg-surface-container-low transition-colors group bg-surface-container-lowest">
                    <td className="pl-space-base pr-space-sm py-space-sm">
                      <div className="flex items-center gap-space-xs">
                        <MaterialIcon name={a.severity === "critical" ? "priority_high" : "warning"} className={"text-[16px] " + (a.severity === "critical" ? "text-error" : "text-amber-600")} />
                        <span className="font-numeric-md text-numeric-md font-semibold text-primary">{a.id}</span>
                      </div>
                    </td>
                    <td className="px-space-sm py-space-sm">
                      <div className="flex flex-col">
                        <span className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors capitalize">{a.pattern.replace(/_/g, " ")}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant max-w-[400px] truncate">{a.evidence}</span>
                      </div>
                    </td>
                    <td className="px-space-sm py-space-sm whitespace-nowrap">
                      <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold " + tone}>
                        <span className={"w-1.5 h-1.5 rounded-full " + dot}></span>
                        <span>Score {a.risk} · {a.severity}</span>
                      </span>
                    </td>
                    <td className="px-space-sm py-space-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <MaterialIcon name="account_balance" className="text-[16px] text-on-surface-variant" />
                        <span className="font-numeric-md text-numeric-md text-on-surface">{a.accounts.length} Accounts</span>
                      </div>
                    </td>
                    <td className="px-space-sm py-space-sm text-right whitespace-nowrap font-numeric-md text-numeric-md font-semibold text-on-surface">{a.transactions.length} txns</td>
                    <td className="px-space-sm py-space-sm whitespace-nowrap font-body-sm text-body-sm text-on-surface-variant capitalize">{a.pattern.replace(/_/g, " ")}</td>
                    <td className="px-space-sm py-space-sm whitespace-nowrap">
                      <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-caps text-label-caps uppercase"}>
                        <span className={"w-1.5 h-1.5 rounded-full " + dot}></span>
                        <span>{a.severity} · Open</span>
                      </span>
                    </td>
                    <td className="pl-space-sm pr-space-base py-space-sm text-right whitespace-nowrap">
                      <Link className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-primary-container text-on-primary hover:bg-primary transition-all font-body-sm text-body-sm font-medium shadow-sm" to={`/analyst/entities/${a.accounts[0] || ""}`}>
                        <span>Inspect</span>
                        <MaterialIcon name="arrow_forward" className="text-[14px]" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
</tbody>
          </table>
        </div>

        {!busy && !error && filtered.length === 0 && alerts.length > 0 && (
          <div className="m-space-base p-space-xl rounded bg-surface-container-low border border-dashed border-outline-variant flex flex-col items-center justify-center text-center transition-all">
            <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant mb-space-sm">
              <MaterialIcon name="filter_alt_off" className="text-[24px]" />
            </div>
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-1">No alerts match this filter</h3>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-space-md">No suspicious circular flows, fan-out networks, or dwell anomalies detected in the selected filter range.</p>
            <div className="flex items-center gap-space-sm">
              <button className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-primary-container text-on-primary hover:bg-primary transition-all font-body-sm text-body-sm font-medium shadow-sm active:scale-95 cursor-pointer" type="button" onClick={() => { setActiveFilter("All"); setPage(1) }}>
                <MaterialIcon name="restart_alt" className="text-[16px]" />
                <span>Reset filters</span>
              </button>
              <button className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-all font-body-sm text-body-sm font-medium cursor-pointer" type="button" onClick={() => notify({ title: "Thresholds managed by detection rules", body: "Tune sensitivity in Admin → Detection Rules; ledgers re-score on save.", tone: "primary" })}>
                <MaterialIcon name="tune" className="text-[16px]" />
                <span>Adjust threshold</span>
              </button>
            </div>
          </div>
        )}

        {/* Forensic Ledger Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-space-base py-space-md bg-surface-container-low text-on-surface-variant mt-auto">
          <div className="flex items-center gap-space-md mb-2 sm:mb-0">
            <span className="font-body-sm text-body-sm">
              Showing <span className="font-semibold text-on-surface">{filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}</span> to <span className="font-semibold text-on-surface">{Math.min(safePage * pageSize, filtered.length)}</span> of <span className="font-semibold text-on-surface">{filtered.length}</span> entries
            </span>
            <div className="flex items-center gap-space-xs text-body-sm font-body-sm">
              <span>Rows per page:</span>
              <select className="bg-surface-container-lowest text-on-surface font-numeric-md text-numeric-md rounded px-1.5 py-0.5 shadow-sm outline-none cursor-pointer" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <button className={`flex items-center justify-center w-8 h-8 rounded bg-surface-container-lowest shadow-sm transition-all ${safePage <= 1 ? "text-on-surface-variant opacity-40 cursor-not-allowed" : "text-on-surface hover:bg-surface-container cursor-pointer"}`} disabled={safePage <= 1} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <MaterialIcon name="chevron_left" className="text-[16px]" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
              <button key={n} className={`flex items-center justify-center w-8 h-8 rounded font-numeric-md text-numeric-md shadow-sm transition-all cursor-pointer ${n === safePage ? "bg-primary-container text-on-primary font-semibold" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"}`} type="button" onClick={() => setPage(n)}>{n}</button>
            ))}
            {totalPages > 5 && <span className="px-1 text-outline">...</span>}
            {totalPages > 5 && (
              <button className={`flex items-center justify-center w-8 h-8 rounded font-numeric-md text-numeric-md shadow-sm transition-all cursor-pointer ${totalPages === safePage ? "bg-primary-container text-on-primary font-semibold" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"}`} type="button" onClick={() => setPage(totalPages)}>{totalPages}</button>
            )}
            <button className={`flex items-center justify-center w-8 h-8 rounded bg-surface-container-lowest shadow-sm transition-all ${safePage >= totalPages ? "text-on-surface-variant opacity-40 cursor-not-allowed" : "text-on-surface hover:bg-surface-container cursor-pointer"}`} disabled={safePage >= totalPages} type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <MaterialIcon name="chevron_right" className="text-[16px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Anomaly Sub-Canvas Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md mt-space-lg">
        <div className="p-space-lg rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-xs">
                <MaterialIcon name="hub" className="text-primary text-[20px]" />
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Topology Anomaly</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-caps text-label-caps">99.4% MATCH</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">Identified multi-hop bipartite layering matching recent cyber syndicate fingerprint #401-NCR.</p>
          </div>
          <div className="mt-space-md pt-space-md flex items-center justify-between bg-surface-container-low p-space-sm rounded">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Recommended Action</span>
              <span className="font-headline-sm text-headline-sm text-error font-medium">Generate Immediate STR</span>
            </div>
            <Link className="px-space-md py-1 rounded bg-surface-container-highest hover:bg-surface-container text-on-surface font-body-sm text-body-sm font-medium" to="/analyst/reports">Quick File</Link>
          </div>
        </div>
        <div className="p-space-lg rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-xs">
                <MaterialIcon name="auto_awesome" className="text-primary text-[20px]" />
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">AI Synthesis</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed-variant font-label-caps text-label-caps">AUTONOMOUS AGENT</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">Coordinated mule acquisition detected across 4 private sector banks. Outbound volumes spike predictably at 23:00 IST.</p>
          </div>
          <div className="mt-space-md pt-space-md flex items-center justify-between bg-surface-container-low p-space-sm rounded">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Confidence Level</span>
              <span className="font-headline-sm text-headline-sm text-primary font-medium">High (0.94 P-Val)</span>
            </div>
            <Link className="px-space-md py-1 rounded bg-primary-container text-on-primary hover:bg-primary font-body-sm text-body-sm font-medium shadow-sm" to="/analyst/ai-investigator">Review Agent Logs</Link>
          </div>
        </div>
        <div className="p-space-lg rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-space-xs">
              <MaterialIcon name="location_on" className="text-tertiary text-[20px]" />
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Geographic Concentration</span>
            </div>
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Western Hub</span>
          </div>
          <div className="flex flex-col gap-space-xs mb-space-sm">
            <div className="flex justify-between items-center font-body-sm text-body-sm">
              <span className="text-on-surface">Mumbai Metro Area</span>
              <span className="font-numeric-md text-numeric-md font-semibold text-on-surface">54% volume</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[54%]"></div>
            </div>
            <div className="flex justify-between items-center font-body-sm text-body-sm pt-space-xs">
              <span className="text-on-surface">Ahmedabad Corridor</span>
              <span className="font-numeric-md text-numeric-md font-semibold text-on-surface">28% volume</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-secondary h-full w-[28%]"></div>
            </div>
          </div>
          <Link className="font-body-sm text-body-sm text-primary hover:underline flex items-center gap-1 mt-auto" to="/analyst/network-explorer">
            <span>Open Geospatial Layer</span>
            <MaterialIcon name="north_east" className="text-[14px]" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AlertsTriage