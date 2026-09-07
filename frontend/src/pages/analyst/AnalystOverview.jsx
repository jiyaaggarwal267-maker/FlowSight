import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import AnimatedNumber from "../../components/AnimatedNumber.jsx"
import { notify, formatINR } from "../../lib/runtime.js"
import { api, patternLabel } from "../../lib/api.js"

function AnalystOverview() {
  const [selectedNode, setSelectedNode] = useState(null)
  const [frozen, setFrozen] = useState(false)
  const [freezeBusy, setFreezeBusy] = useState(false)
  const [freezeMsg, setFreezeMsg] = useState("")
  const [overview, setOverview] = useState(null)
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    let alive = true
    api
      .overview()
      .then((d) => alive && setOverview(d))
      .catch(() => {})
    api
      .accounts({ limit: "20" })
      .then((d) => alive && setAccounts(d.items || []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const nodeData = accounts.find((a) => a.id === selectedNode) || accounts.find((a) => a.risk_score >= 60) || accounts[0] || {}

  const freezeNode = () => {
    if (frozen || freezeBusy || !nodeData.id) return
    setFreezeBusy(true)
    setFreezeMsg("")
    api
      .updateAccount(nodeData.id, { frozen: true, freeze_reason: "Frozen from overview graph sandbox" })
      .then(() => {
        setFrozen(true)
        setFreezeMsg(`Node ${nodeData.id} frozen`)
      })
      .catch((err) => setFreezeMsg(`Freeze failed: ${err.message}`))
      .finally(() => setFreezeBusy(false))
  }

  const graphNodes = accounts.slice(0, 5)
  const graphPos = [
    { x: 160, y: 170, note: "FEEDER ACC" },
    { x: 320, y: 100, note: "LAYER" },
    { x: 320, y: 250, note: "LAYER" },
    { x: 490, y: 170, note: "CONVERGED" },
    { x: 640, y: 170, note: "OFF-RAMP" },
  ]

  return (
    <div className="flex flex-col w-full pb-space-2xl space-y-space-lg">
      {/* Top Intelligence Summary Bar */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md py-space-sm">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider mb-space-2xs">
            <span>AML Surveillance Console</span>
            <span className="text-outline-variant">•</span>
            <span className="text-primary font-semibold flex items-center gap-1">
              <span className="relative flex w-1.5 h-1.5">
                <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-primary"></span>
              </span>
              Live Feed Synchronized
            </span>
          </div>
<h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Good morning, A. Sharma</h1>
	           <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Automated algorithmic triage detected {overview?.high_risk_alerts || 0} anomalous transaction topologies in the last 4 hours.</p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-low rounded-lg text-on-surface font-label-sm text-label-sm">
            <MaterialIcon />
            <span>INR (₹)</span>
            <span className="text-outline-variant text-[11px]">Tabular</span>
          </div>
          <button className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest rounded-lg shadow-sm text-on-surface hover:bg-surface-container-low transition-colors font-label-sm text-label-sm cursor-pointer" type="button" onClick={() => notify({ title: "Window fixed to demo range", body: "Last 30 Days · Oct 1 – Oct 31, 2024.", tone: "primary" })}>
            <MaterialIcon name="calendar_today" className="text-[18px] text-outline" />
            <span>Last 30 Days · Oct 1 – Oct 31, 2024</span>
            <MaterialIcon name="expand_more" className="text-[16px] text-outline" />
          </button>
          <button className="flex items-center gap-space-xs px-space-md h-9 bg-primary text-on-primary rounded-lg shadow-sm hover:bg-primary-container transition-colors font-label-sm text-label-sm cursor-pointer" type="button" onClick={() => {
            const invs = overview?.recent_investigations || []
            const rows = [["investigation", "pattern", "risk", "accounts"]]
            for (const i of invs) {
              rows.push([i.id, i.summary?.pattern || "—", i.risk_score, i.summary?.accounts?.length || 0])
            }
            const csv = rows.map((r) => r.join(",")).join("\n")
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
            const link = document.createElement("a")
            link.href = url
            link.download = "flowsight-overview-summary.csv"
            link.click()
            URL.revokeObjectURL(url)
            notify({ title: "Summary exported", body: `${invs.length} investigations written to CSV.`, tone: "primary" })
          }}>
            <MaterialIcon name="sim_card_download" className="text-[18px]" />
            <span>Export Summary</span>
          </button>
        </div>
      </section>

      {/* Metric KPI Cards (4-Grid Bento) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">Transactions Monitored</span>
            <MaterialIcon name="swap_horiz" className="text-outline text-[20px] group-hover:text-primary transition-colors" />
          </div>
          <div className="my-space-sm">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                <AnimatedNumber format={(v) => `${v.toFixed(2)}M`} value={overview ? overview.transactions / 1e6 : 1.84} />
              </span>
              <span className="flex items-center font-label-sm text-label-sm text-on-secondary font-medium px-1.5 py-0.5 rounded bg-secondary">+12.4%</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">UPI · IMPS · NEFT · RTGS channels</p>
          </div>
          <div className="w-full h-8 pt-1">
            <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 160 28">
              <path d="M0 24 L20 20 L40 22 L60 14 L80 18 L100 11 L120 15 L140 6 L160 8" stroke="#1d4ed8" strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
              <path d="M0 24 L20 20 L40 22 L60 14 L80 18 L100 11 L120 15 L140 6 L160 8 L160 28 L0 28 Z" fill="#dae2fd" opacity="0.3"></path>
            </svg>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">High Risk Alerts</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-error font-label-caps text-[10px] uppercase font-bold bg-error-container/60">
              <span className="w-1.5 h-1.5 rounded-full bg-error inline-block animate-ping"></span>
              Action Required
            </span>
          </div>
          <div className="my-space-sm">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-error font-semibold tracking-tight">
                <AnimatedNumber value={overview ? overview.high_risk_alerts : 128} />
              </span>
              <span className="flex items-center font-label-sm text-label-sm text-error font-medium px-1.5 py-0.5 rounded bg-error-container/50">-4 resolved</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Pending review &amp; regulatory escalation</p>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: "74%" }}></div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">Suspicious Networks</span>
            <MaterialIcon name="hub" className="text-outline text-[20px]" />
          </div>
          <div className="my-space-sm">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                <AnimatedNumber value={overview ? overview.clusters : 34} />
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium bg-surface-container-high px-1.5 py-0.5 rounded">Active DAGs</span>
            </div>
            <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mt-1">
              <span className="font-medium text-on-surface">5 circular flows</span>
              <span>•</span>
              <span className="font-medium text-on-surface">12 fan-out clusters</span>
            </div>
          </div>
          <div className="flex items-center gap-1 w-full pt-1">
            <span className="h-1.5 rounded-full bg-primary flex-1"></span>
            <span className="h-1.5 rounded-full bg-primary-container flex-1"></span>
            <span className="h-1.5 rounded-full bg-secondary flex-1"></span>
            <span className="h-1.5 rounded-full bg-surface-container-high flex-1"></span>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">Total Funds Monitored</span>
            <MaterialIcon name="account_balance" className="text-outline text-[20px]" />
          </div>
          <div className="my-space-sm">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">
                ₹<AnimatedNumber format={(v) => `${v.toFixed(1)} Cr`} value={overview ? overview.total_volume / 1e7 : 42.8} />
              </span>
              <span className="font-numeric-md text-numeric-md text-error font-medium px-1.5 py-0.5 rounded bg-error-container/40">₹18.7L flagged</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Prioritized in high-velocity investigations</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden flex">
              <div className="bg-error h-full" style={{ width: "4.8%" }}></div>
              <div className="bg-primary h-full" style={{ width: "22%" }}></div>
              <div className="bg-outline-variant h-full" style={{ width: "73.2%" }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Large Interactive Main Card: Suspicious Flow Activity & Active Alerts */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-space-lg py-space-md bg-surface-container-low flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-md">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <MaterialIcon name="account_tree" className="text-[20px]" />
            </div>
            <div>
              <div className="flex items-center gap-space-xs">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Suspicious Flow Activity &amp; Active Alerts</h2>
                {overview?.recent_investigations?.[0] && (
                  <Link className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-error-container text-on-error-container font-semibold hover:bg-error hover:text-on-error transition-colors" to={`/analyst/investigations/${overview.recent_investigations[0].id}`}>
                    Priority Case: {overview.recent_investigations[0].id}
                  </Link>
                )}
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Synthesized graph topology of suspected funnel mule accounts and high-velocity layering.</span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant mr-1">Telemetry Canvas:</span>
            <button className="p-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer" title="Recenter Graph" type="button" onClick={() => notify({ title: "Graph recentered", body: `Viewport reset on primary suspect hub ${nodeData.id || "—"}.`, tone: "primary" })}>
              <MaterialIcon name="filter_center_focus" className="text-[18px]" />
            </button>
            <button className="p-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer" title="Toggle Clustering" type="button" onClick={() => notify({ title: "Clustering overlay toggled", body: "Community detection layer switched.", tone: "primary" })}>
              <MaterialIcon name="grain" className="text-[18px]" />
            </button>
            <Link className="flex items-center gap-1.5 px-space-md py-1.5 bg-surface-container-lowest shadow-sm rounded-lg text-primary hover:bg-surface-container text-label-sm font-label-sm font-semibold transition-colors" to="/analyst/network-explorer">
              <span>Open in Network Explorer</span>
              <MaterialIcon name="arrow_outward" className="text-[16px]" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[460px]">
          {/* Graph Canvas: 8 cols */}
          <div className="xl:col-span-8 relative bg-[#fafbfc] overflow-hidden flex flex-col justify-between p-space-md" id="graph-viewport">
            <div className="absolute inset-0 opacity-[0.45] pointer-events-none" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-space-sm pointer-events-none">
              <div className="flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest/90 backdrop-blur-md rounded-xl shadow-sm text-on-surface font-body-sm text-body-sm pointer-events-auto">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
<span className="font-semibold">Circular Velocity: {overview ? (overview.total_volume / 1e5).toFixed(1) + 'L' : '—'}</span>
	                <span className="text-outline-variant">|</span>
	                <span className="text-on-surface-variant">{overview?.accounts || 0} Accounts • {overview?.transactions || 0} Txns</span>
              </div>
              <div className="flex items-center gap-1.5 px-space-sm py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-lg shadow-sm text-on-surface-variant font-label-caps text-label-caps pointer-events-auto">
                <MaterialIcon name="security_update_warning" className="text-[14px] text-primary" />
                <span>Pattern: Layering + Fan-In Exit</span>
              </div>
            </div>

            <div className="relative z-0 w-full h-[360px] flex items-center justify-center my-auto">
              <svg className="w-full h-full max-h-[360px]" fill="none" viewBox="0 0 740 340" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="edgeGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.3"></stop>
                    <stop offset="50%" stopColor="#dc2626" stopOpacity="0.8"></stop>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3"></stop>
                  </linearGradient>
                  <filter height="140%" id="glow" width="140%" x="-20%" y="-20%">
                    <feDropShadow dx="0" dy="2" floodColor="#0f172a" floodOpacity="0.08" stdDeviation="3"></feDropShadow>
                  </filter>
                </defs>
                <path d="M 160 170 Q 240 90, 320 100" stroke="#cbd5e1" strokeDasharray="4 3" strokeWidth="2.5"></path>
                <path d="M 160 170 Q 240 250, 320 240" stroke="#cbd5e1" strokeDasharray="4 3" strokeWidth="2.5"></path>
                <path d="M 320 100 Q 420 110, 480 170" stroke="url(#edgeGrad)" strokeWidth="3"></path>
                <path d="M 320 240 Q 420 230, 480 170" stroke="url(#edgeGrad)" strokeWidth="3"></path>
                <path d="M 480 170 L 640 170" stroke="#dc2626" strokeWidth="3.5"></path>
                <path d="M 640 170 C 600 300, 200 300, 160 170" opacity="0.65" stroke="#dc2626" strokeDasharray="6 4" strokeWidth="2"></path>
                <circle fill="#dc2626" r="4">
                  <animateMotion dur="4s" path="M 160 170 Q 240 90, 320 100 Q 420 110, 480 170 L 640 170 C 600 300, 200 300, 160 170" repeatCount="indefinite"></animateMotion>
                </circle>
                <circle fill="#1d4ed8" r="3.5">
                  <animateMotion dur="2.8s" path="M 160 170 Q 240 250, 320 240 Q 420 230, 480 170 L 640 170" repeatCount="indefinite"></animateMotion>
                </circle>

                {graphNodes.map((node, idx) => {
                  const p = graphPos[idx] || graphPos[graphPos.length - 1]
                  const isHub = idx === 3 || node.risk_score >= 60
                  const fill = isHub ? "#ba1a1a" : "#1d4ed8"
                  const label = node.risk_score >= 60 ? `${node.id} (HUB)` : node.id
                  const note = `${node.risk_score || "—"} RISK · ${node.entity || ""}`
                  return (
                    <g key={node.id} className="cursor-pointer transition-transform hover:scale-105" onClick={() => setSelectedNode(node.id)} transform={`translate(${p.x}, ${p.y})`}>
                      {isHub && <circle className="animate-pulse" fill="#ffdad6" opacity="0.6" r="34"></circle>}
                      <circle fill="#ffffff" filter="url(#glow)" r={isHub ? 28 : 24}></circle>
                      <circle fill="#f2f4f6" r={isHub ? 23 : 20}></circle>
                      <circle fill={fill} r={isHub ? 9 : 6}></circle>
                      <text className="font-semibold text-[11px]" fill="#191c1e" textAnchor="middle" y={isHub ? 44 : 38}>{label}</text>
                      <text className="text-[9px]" fill="#565e74" textAnchor="middle" y={isHub ? 57 : 50}>{note}</text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="relative z-10 flex items-center justify-between px-space-md py-space-xs bg-surface-container-lowest/90 backdrop-blur-md rounded-xl shadow-sm text-on-surface font-body-sm">
              <div className="flex items-center gap-space-sm text-body-sm">
                <span className="text-on-surface-variant font-label-caps text-label-caps">Selected Node:</span>
                <span className="font-numeric-md font-semibold text-on-surface">{nodeData.entity || '—'}</span>
                <span className="px-1.5 py-0.5 rounded text-error bg-error-container/60 font-label-caps text-[10px] font-bold">Risk {nodeData.risk_score || '—'}</span>
                {frozen && <span className="px-1.5 py-0.5 rounded text-on-primary bg-primary font-label-caps text-[10px] font-bold animate-pulse">Node Frozen</span>}
              </div>
              <div className="flex items-center gap-space-xs">
                <button
                  className="text-primary hover:text-primary-container font-label-sm text-label-sm font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  type="button"
                  onClick={freezeNode}
                  disabled={freezeBusy}
                >
                  <MaterialIcon name={freezeBusy ? "progress_activity" : "lock"} className="text-[16px]" />
                  {freezeBusy ? "Freezing…" : frozen ? "Frozen" : "Freeze Node"}
                </button>
                {freezeMsg && <span className="font-label-sm text-label-sm text-on-surface-variant">{freezeMsg}</span>}
                <span className="text-outline-variant">|</span>
                {overview?.recent_investigations?.[0] && (
                  <Link className="text-on-surface hover:text-primary font-label-sm text-label-sm font-medium" to={`/analyst/investigations/${overview.recent_investigations[0].id}`}>Inspect Ledger</Link>
                )}
              </div>
            </div>
          </div>

          {/* Priority Alerts Feed: 4 cols */}
          <div className="xl:col-span-4 bg-surface-container-low p-space-md flex flex-col gap-space-sm justify-between">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-sm text-headline-sm text-on-surface">Active High-Risk Alerts</span>
                <span className="px-2 py-0.5 rounded-full bg-error text-on-error font-label-caps text-[10px] font-bold">{overview?.high_risk_alerts || 0} Urgent</span>
              </div>
              <Link className="font-label-caps text-label-caps text-primary hover:underline" to="/analyst/alerts">View All ({overview?.high_risk_alerts || 0})</Link>
            </div>

            <div className="flex flex-col gap-space-sm overflow-y-auto">
              {(overview?.top_alerts || []).slice(0, 5).map((a) => {
                const sev = a.severity || (a.risk_score >= 60 ? "high" : "medium")
                const dot = sev === "critical" || sev === "high" ? "bg-error" : sev === "medium" ? "bg-amber-500" : "bg-secondary"
                const title = a.pattern ? patternLabel(a.pattern) : "Alert"
                const primaryAcct = a.accounts?.[0]
                return (
                  <div key={a.id} className="p-space-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col gap-space-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${dot}`}></span>
                        <span className="font-headline-sm text-[13px] font-semibold text-on-surface leading-tight">{title}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded font-numeric-md text-[11px] font-bold ${sev === "low" ? "bg-surface-container-high text-on-surface" : "bg-error-container text-error"}`}>SCORE {a.risk_score}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{a.evidence}</p>
                    <div className="flex items-center justify-between pt-space-xs font-numeric-md text-[12px] text-on-surface-variant">
                      <span className="font-bold text-on-surface">{formatINR(a.amount)}</span>
                      <span className="text-outline-variant">•</span>
                      <span>{a.accounts?.length || 0} Accounts</span>
                      <span className="text-outline-variant">•</span>
                      <span>{a.transactions?.length || 0} Txns</span>
                    </div>
                    <div className="pt-space-xs flex items-center justify-between">
                      <span className="font-label-caps text-[10px] font-bold uppercase tracking-wider text-secondary">{a.status?.replace("_", " ") || "open"}</span>
                      <Link className="px-space-md py-1 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm font-semibold hover:bg-primary-container transition-colors flex items-center gap-1" to={primaryAcct ? `/analyst/entities/${primaryAcct}` : "/analyst/alerts"}>
                        <span>Investigate</span>
                        <MaterialIcon name="arrow_forward" className="text-[14px]" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-[11px]">
              <span className="flex items-center gap-1">
                <MaterialIcon name="verified" className="text-[14px] text-primary" />
                Automated ML Risk Scoring Model v4.2
              </span>
              <span className="text-outline">Live sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Section: Risk Distribution & Investigation Ledger */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between space-y-space-md">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Risk Category Distribution</h3>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">30-Day Ingestion</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Transaction classification breakdown across verified scoring bands.</p>
          </div>
          <div className="space-y-space-xs">
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface-container-high">
              <div className="bg-error h-full" style={{ width: "8%" }} title="High Risk: 8%"></div>
              <div className="bg-secondary h-full" style={{ width: "24%" }} title="Medium Risk: 24%"></div>
              <div className="bg-primary h-full" style={{ width: "68%" }} title="Low / Cleared: 68%"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <div className="p-space-sm bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-1 text-error font-label-caps text-[11px] font-bold uppercase">
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  High (8%)
                </div>
                <span className="font-numeric-lg text-numeric-lg text-on-surface font-semibold mt-1 block">147.2K</span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">₹18.4 Cr</span>
              </div>
              <div className="p-space-sm bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-1 text-on-surface font-label-caps text-[11px] font-bold uppercase">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  Medium (24%)
                </div>
                <span className="font-numeric-lg text-numeric-lg text-on-surface font-semibold mt-1 block">441.6K</span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">₹55.2 Cr</span>
              </div>
              <div className="p-space-sm bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-1 text-primary font-label-caps text-[11px] font-bold uppercase">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  Low (68%)
                </div>
                <span className="font-numeric-lg text-numeric-lg text-on-surface font-semibold mt-1 block">1.25M</span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">₹381.1 Cr</span>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-low rounded-xl p-space-md space-y-space-xs">
            <div className="flex items-center gap-space-xs text-primary font-label-sm text-label-sm font-semibold">
              <MaterialIcon name="lightbulb" className="text-[18px]" />
              <span>Analyst Recommendation</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {overview?.recent_investigations?.[0]
                ? `Priority investigation ${overview.recent_investigations[0].id} is ${overview.recent_investigations[0].status} with risk ${overview.recent_investigations[0].risk_score}/100 (${patternLabel(overview.recent_investigations[0].summary?.pattern || "unknown")}). Primary suspect account ${overview.recent_investigations[0].summary?.primary_account || "—"} scoped for review.`
                : "No active investigations in the current window."}
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Recent Active Investigations</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Cross-border and domestic high-velocity multi-party cases.</p>
            </div>
            <div className="flex items-center gap-space-xs">
              <Link className="px-space-md py-1.5 bg-surface-container-low hover:bg-surface-container rounded-lg font-label-sm text-label-sm font-semibold text-on-surface transition-colors flex items-center gap-1" to="/analyst/reports">
                <span>View All Records</span>
                <MaterialIcon name="chevron_right" className="text-[16px]" />
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider h-9">
                  <th className="px-space-md py-2 font-semibold">Investigation ID</th>
                  <th className="px-space-md py-2 font-semibold">Typology Pattern</th>
                  <th className="px-space-md py-2 font-semibold text-center">Risk Score</th>
                  <th className="px-space-md py-2 font-semibold text-right">Accounts</th>
                  <th className="px-space-md py-2 font-semibold text-right">Primary Account</th>
                  <th className="px-space-md py-2 font-semibold">Lead Analyst</th>
                  <th className="px-space-md py-2 font-semibold">Status</th>
                  <th className="px-space-md py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm">
                {(overview?.recent_investigations || []).map((inv) => {
                  const risk = inv.risk_score || 0
                  const riskBadge = risk >= 60 ? "bg-error-container text-error" : risk >= 40 ? "bg-amber-100 text-amber-800" : "bg-surface-container-high text-on-surface"
                  const initials = (inv.assigned_to || "—").split(" ").map((w) => w[0]).join("").slice(0, 2) || "—"
                  return (
                    <tr key={inv.id} className="h-10 hover:bg-surface-container-low transition-colors group">
                      <td className="px-space-md py-2 font-numeric-md font-bold text-primary">
                        <Link className="flex items-center gap-1.5" to={`/analyst/investigations/${inv.id}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${risk >= 40 ? "bg-error" : "bg-outline-variant"}`}></span>
                          <span>{inv.id}</span>
                        </Link>
                      </td>
                      <td className="px-space-md py-2 text-on-surface font-medium">{inv.summary?.pattern ? patternLabel(inv.summary.pattern) : "—"}</td>
                      <td className="px-space-md py-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-numeric-md font-bold text-[11px] ${riskBadge}`}>{risk} / 100</span>
                      </td>
                      <td className="px-space-md py-2 text-right font-numeric-md text-on-surface">{inv.summary?.accounts?.length || 0}</td>
                      <td className="px-space-md py-2 text-right font-numeric-md font-bold text-on-surface">{inv.summary?.primary_account || "—"}</td>
                      <td className="px-space-md py-2 text-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-surface-container-high text-[10px] font-bold flex items-center justify-center text-on-surface">{initials}</span>
                          <span>{inv.assigned_to || "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="px-space-md py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-caps text-[10px] font-bold ${inv.status === "open" ? "text-error bg-error-container/50" : "text-on-surface bg-surface-container-high"}`}>{inv.status || "open"}</span>
                      </td>
                      <td className="px-space-md py-2 text-right">
                        <Link className="px-2 py-1 bg-primary text-on-primary rounded text-label-sm font-label-sm font-semibold hover:bg-primary-container transition-colors" to={`/analyst/investigations/${inv.id}`}>Review</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AnalystOverview