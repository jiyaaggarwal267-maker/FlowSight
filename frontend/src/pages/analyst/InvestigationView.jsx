import { useState, useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import { api } from "../../lib/api.js"

function InvestigationView() {
  const { id = "INV-001" } = useParams()
  const [inv, setInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalContent, setModalContent] = useState([])
  const [actionBusy, setActionBusy] = useState("")
  const [statusMsg, setStatusMsg] = useState("")

  const assignLead = () => {
    if (actionBusy) return
    setActionBusy("assign")
    setStatusMsg("")
    api
      .updateInvestigation(id, { assigned_to: "Senior Compliance Lead", status: "in_review" })
      .then(() => {
        setStatusMsg(`Case ${id} escalated to Senior Compliance Lead · Tier-2 SIU queue.`)
      })
      .catch((err) => setStatusMsg(`Escalation failed: ${err.message}`))
      .finally(() => setActionBusy(""))
  }

  const generateReport = () => {
    if (actionBusy) return
    setActionBusy("report")
    setStatusMsg("")
    api
      .generateReport({ investigation_id: id })
      .then((r) => setStatusMsg(`Investigation report generated · ${r.id}`))
      .catch((err) => setStatusMsg(`Report generation failed: ${err.message}`))
      .finally(() => setActionBusy(""))
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .investigation(id)
      .then((data) => {
        if (!alive) return
        setInv(data)
        setLoading(false)
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [id])

  const formatCurrency = (val) => {
    try {
      const v = Number(val || 0)
      if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
      if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`
      return `₹${v.toLocaleString("en-IN")}`
    } catch { return "—" }
  }

  const accts = inv?.accounts || []
  const txns = inv?.transactions || []
  const risk = inv?.risk_score || 0
  const severity = risk >= 60 ? "critical" : risk >= 40 ? "high" : risk >= 25 ? "medium" : "low"
  // Local triangular closed-loop layout for the archetype diagram
  // (rendering only — uses the page's existing accts/txns data as-is).
  const graphAccts = accts.slice(0, 3)
  const graphTxns = txns.slice(0, 3)
  const NODE_R = 32
  const EDGE_GAP = 8
  const EDGE_BOW = 42
  const loopPos = [
    { x: 140, y: 150 },
    { x: 470, y: 78 },
    { x: 470, y: 228 },
  ]
  const loopNodes = graphAccts.map((a, i) => ({ ...a, ...loopPos[i] }))
  const loopCentroid = loopNodes.length > 0
    ? {
        x: loopNodes.reduce((s, n) => s + n.x, 0) / loopNodes.length,
        y: loopNodes.reduce((s, n) => s + n.y, 0) / loopNodes.length,
      }
    : { x: 0, y: 0 }
  // Edges are trimmed to stop at the circle perimeters (so arrowheads stay
  // visible) and bowed outward from the centroid for a uniform clockwise loop.
  const loopEdges = loopNodes.length > 1
    ? loopNodes.map((n, i) => {
        const m = loopNodes[(i + 1) % loopNodes.length]
        const dx = m.x - n.x
        const dy = m.y - n.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const trim = NODE_R + EDGE_GAP
        const start = { x: n.x + ux * trim, y: n.y + uy * trim }
        const end = { x: m.x - ux * trim, y: m.y - uy * trim }
        const mx = (n.x + m.x) / 2
        const my = (n.y + m.y) / 2
        // Bow perpendicular to the chord, always away from the centroid,
        // so all three edges curve the same rotational way (clockwise loop).
        const nx = -uy
        const ny = ux
        const dot = nx * (mx - loopCentroid.x) + ny * (my - loopCentroid.y)
        const sgn = dot >= 0 ? 1 : -1
        const ctrl = { x: mx + nx * sgn * EDGE_BOW, y: my + ny * sgn * EDGE_BOW }
        const label = { x: mx + nx * sgn * (EDGE_BOW + 26), y: my + ny * sgn * (EDGE_BOW + 26) }
        return {
          from: n,
          to: m,
          start,
          end,
          ctrl,
          label,
          txn: graphTxns[i] || graphTxns[i % Math.max(graphTxns.length, 1)] || null,
        }
      })
    : []

  // Closed center-line loop for the travelling flow packets
  // (same animateMotion recipe as the Overview graph).
  const loopPacketPath = loopNodes.length > 1
    ? (() => {
        let d = `M ${loopNodes[0].x} ${loopNodes[0].y} `
        loopNodes.forEach((n, i) => {
          const m = loopNodes[(i + 1) % loopNodes.length]
          const len = Math.hypot(m.x - n.x, m.y - n.y) || 1
          const ux = (m.x - n.x) / len
          const uy = (m.y - n.y) / len
          const mx = (n.x + m.x) / 2
          const my = (n.y + m.y) / 2
          const sgn = (-uy * (mx - loopCentroid.x) + ux * (my - loopCentroid.y)) >= 0 ? 1 : -1
          d += `Q ${mx + -uy * sgn * EDGE_BOW} ${my + ux * sgn * EDGE_BOW} ${m.x} ${m.y} `
        })
        return d + "Z"
      })()
    : ""

  const getTxnPayload = (txn) => {
    if (!txn) return []
    return [
      `Displaying Forensic Payload for ${txn.txn_id || txn.id}`,
      `Amount: ${formatCurrency(txn.amount)}`,
      `Origin: ${txn.from || txn.from_account}`,
      `Destination: ${txn.to || txn.to_account}`,
      `Channel: ${txn.channel}`,
    ]
  }

  if (loading) {
    return (
      <div className="flex flex-col w-full pb-space-2xl gap-space-lg">
        <div className="h-8 bg-surface-container-high rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-base">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-surface-container-high rounded animate-pulse" />)}
        </div>
        <div className="h-64 bg-surface-container-high rounded animate-pulse" />
      </div>
    )
  }

  if (!inv) {
    return (
      <div className="flex flex-col w-full pb-space-2xl gap-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-space-md pt-space-md mb-space-lg">
          <div className="flex flex-col gap-space-2xs">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Investigation {id}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Case dossier not found.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Case Super-Header & Breadcrumb Bar */}
      <div className="flex flex-col gap-space-sm pt-space-md mb-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-xs font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
            <Link className="hover:text-primary transition-colors" to="/analyst/alerts">Alerts</Link>
            <span className="text-outline-variant">/</span>
            <Link className="hover:text-primary transition-colors" to="/analyst/alerts">{inv.alert_id || "ALT-0001"}</Link>
            <span className="text-outline-variant">/</span>
            <span className="text-on-surface font-bold text-primary">Investigation #{id.slice(-3)}</span>
          </div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm bg-surface-container-high px-space-sm py-space-2xs rounded-full">
            <span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse"></span>
            <span className="font-medium text-on-surface">Case Dossier Synchronized</span>
            <span className="text-outline">·</span>
            <span>UTC {new Date().toISOString().slice(11,19)}</span>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md mt-space-2xs">
          <div className="flex flex-col gap-space-2xs">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Investigation {id}: {inv.summary?.pattern_types?.join(" + ") || "Investigation"}
            </h1>
            <div className="flex flex-wrap items-center gap-space-sm mt-space-xs">
              <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-error-container text-on-error-container shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                <span className="font-label-caps text-label-caps font-bold tracking-wider uppercase">{severity.toUpperCase()} RISK · {risk}/100</span>
              </div>
              <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-secondary-container text-on-secondary-container">
                <MaterialIcon name="pending_actions" className="text-[14px]" />
                <span className="font-label-sm text-label-sm font-medium">Status: {inv.status || "Open"}</span>
              </div>
              <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider px-space-xs">ID: {id}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-space-xs">
            <Link className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-high transition-all active:scale-[0.98]" to="/analyst/network-explorer">
              <MaterialIcon name="hub" className="text-[18px] text-primary" />
              <span className="font-label-sm text-label-sm font-medium">Explore in Network Graph</span>
            </Link>
            <Link className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-high transition-all active:scale-[0.98]" to="/analyst/flow-timeline">
              <MaterialIcon name="timeline" className="text-[18px] text-secondary" />
              <span className="font-label-sm text-label-sm font-medium">View Flow Timeline</span>
            </Link>
            <Link className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary shadow-sm hover:bg-primary transition-all active:scale-[0.98]" to="/analyst/ai-investigator">
              <MaterialIcon name="smart_toy" className="text-[18px]" />
              <span className="font-label-sm text-label-sm font-medium">Investigate with AI</span>
            </Link>
            <button className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-inverse-surface text-inverse-on-surface shadow-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer" onClick={generateReport} disabled={!!actionBusy} type="button">
              <MaterialIcon name="download_for_offline" className="text-[18px]" />
              <span className="font-label-sm text-label-sm font-medium">{actionBusy === "report" ? "Generating…" : "Generate Investigation Report"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-base mb-space-xl">
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Composite Risk Rating</span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-error font-bold tracking-tight">{risk}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">/ 100</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-error-container text-error flex items-center justify-center">
              <MaterialIcon name="production_quantity_limits" className="text-[22px]" />
            </div>
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Total Network Flow</span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">{formatCurrency(inv?.summary?.evidence ? parseFloat(inv.summary.evidence.match(/₹([\d.]+)/)?.[1] || 0) : 0)}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <MaterialIcon name="payments" className="text-[22px]" />
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant">Across <strong className="text-on-surface font-semibold">{txns.length}</strong> transactions</span>
            <span className="font-label-caps text-label-caps bg-surface-container px-space-2xs py-0.5 rounded text-on-surface-variant font-mono">UPI / IMPS</span>
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Flagged Node Count</span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">{accts.length}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
              <MaterialIcon name="account_tree" className="text-[22px]" />
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant">Accounts in scope</span>
            <span className="font-label-caps text-label-caps text-primary font-bold">1 Hub Core</span>
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Investigation Window</span>
              <div className="flex items-baseline gap-space-xs mt-space-xs">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">{new Date(inv?.created_at || Date.now()).toLocaleDateString("en-IN", {month:"short", day:"numeric"})}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center">
              <MaterialIcon name="date_range" className="text-[22px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-space-lg min-w-0">
          {/* Network Path Graphic Panel */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col">
            <div className="flex items-center justify-between pb-space-md">
              <div className="flex items-center gap-space-sm">
                <MaterialIcon name="all_inclusive" className="text-primary text-[22px]" />
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Forensic Network Path Archetype</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Pattern: {inv?.summary?.pattern_types?.join(", ") || "Circular Flow"} · {accts.length} accounts</p>
                </div>
              </div>
            </div>
            <div className="relative w-full h-80 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center p-space-md" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
              <svg className="w-full h-full" fill="none" viewBox="0 0 700 300" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="inv-arrow-crimson" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="6" refY="5" viewBox="0 0 10 10">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ba1a1a"></path>
                  </marker>
                  <linearGradient id="inv-edge-grad" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.3"></stop>
                    <stop offset="50%" stopColor="#dc2626" stopOpacity="0.8"></stop>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3"></stop>
                  </linearGradient>
                  <filter height="140%" id="inv-drop-glow" width="140%" x="-20%" y="-20%">
                    <feDropShadow dx="0" dy="2" floodColor="#0f172a" floodOpacity="0.08" stdDeviation="3"></feDropShadow>
                  </filter>
                  <radialGradient cx="50%" cy="50%" id="inv-node-glow" r="50%">
                    <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.3"></stop>
                    <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0"></stop>
                  </radialGradient>
                </defs>
                {/* Closed-loop directional edges (circular flow order) */}
                {loopEdges.map((e, i) => {
                  const label = e.txn ? (e.txn.txn_id || e.txn.id) : null
                  return (
                    <g key={`edge-${i}`}>
                      <path d={`M ${e.start.x} ${e.start.y} Q ${e.ctrl.x} ${e.ctrl.y} ${e.end.x} ${e.end.y}`} fill="none" markerEnd="url(#inv-arrow-crimson)" stroke="url(#inv-edge-grad)" strokeWidth="3"></path>
                      {label && (
                        <g transform={`translate(${e.label.x}, ${e.label.y})`}>
                          <rect fill="#ffffff" height="18" rx="2" stroke="#c4c5d7" strokeWidth="0.5" width="92" x="-46" y="-9"></rect>
                          <text fill="#93000a" fontFamily="Inter" fontSize="10" fontWeight="700" textAnchor="middle" x="0" y="4">{label}</text>
                        </g>
                      )}
                    </g>
                  )
                })}
                {/* Travelling flow packets (same recipe as the Overview graph) */}
                {loopPacketPath && (
                  <g>
                    <circle fill="#dc2626" r="4">
                      <animateMotion dur="4s" path={loopPacketPath} repeatCount="indefinite"></animateMotion>
                    </circle>
                    <circle fill="#1d4ed8" r="3.5">
                      <animateMotion dur="2.8s" path={loopPacketPath} repeatCount="indefinite"></animateMotion>
                    </circle>
                  </g>
                )}
                {/* Account nodes */}
                {loopNodes.map((a, i) => {
                  // Entity name sits fully outside the circle: above for the
                  // top node (its downward edge exits below), below otherwise.
                  const above = a.y < loopCentroid.y - 20
                  return (
                  <g key={a.id || `node-${i}`} className="cursor-pointer">
                    {i === 0 && <circle className="animate-pulse" cx={a.x} cy={a.y} r="44" fill="url(#inv-node-glow)"></circle>}
                    <circle cx={a.x} cy={a.y} r={NODE_R} fill="#ffffff" filter="url(#inv-drop-glow)" stroke={i === 0 ? "#ba1a1a" : "#0037b0"} strokeWidth="3"></circle>
                    <text fill={i === 0 ? "#ba1a1a" : "#191c1e"} fontFamily="Inter" fontSize="12" fontWeight="700" textAnchor="middle" x={a.x} y={a.y + 4}>{a.id || "?"}</text>
                    <text fill="#565e74" fontFamily="Inter" fontSize="10" fontWeight="600" textAnchor="middle" x={a.x} y={above ? a.y - NODE_R - 12 : a.y + NODE_R + 16} stroke="#ffffff" strokeWidth="3" style={{ paintOrder: "stroke" }}>{(a.entity || "Unknown").slice(0, 18)}</text>
                  </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Explainable Intelligence Evidence Panel */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col">
            <div className="flex items-center justify-between pb-space-md">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
                  <MaterialIcon name="psychology_alt" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Why was this network flagged?</h2>
                </div>
              </div>
              <span className="font-label-caps text-label-caps px-space-sm py-1 bg-surface-container rounded-full text-on-surface font-semibold">{accts.length} Accounts</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md mb-space-lg">
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-space-xs">
                    <span className="font-label-caps text-label-caps font-bold text-error uppercase">1. Pattern Detection</span>
                    <span className="font-label-caps text-label-caps bg-error-container text-on-error-container px-1.5 py-0.5 rounded font-mono">RULE: AML-{inv?.summary?.pattern_types?.[0]?.toUpperCase() || "CIRC"}</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface font-medium leading-snug">
                    {inv?.summary?.description || "Suspicious transaction pattern detected."}
                  </p>
                </div>
              </div>
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-space-xs">
                    <span className="font-label-caps text-label-caps font-bold text-secondary uppercase">2. Risk Assessment</span>
                    <span className="font-label-caps text-label-caps bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded font-mono">SCORE: {risk}/100</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface font-medium leading-snug">
                    Risk score of {risk}/100 based on {accts.length} accounts and {txns.length} transactions in the investigation scope.
                  </p>
                </div>
              </div>
            </div>

            {/* Clickable Forensic Transaction Evidence Ledger */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-space-sm">
                <span className="font-headline-sm text-headline-sm text-on-surface">Key Forensic Ledger Entries</span>
              </div>
              <div className="overflow-x-auto rounded-lg bg-surface-container-low">
                <table className="w-full text-left font-body-sm text-body-sm">
                  <thead className="bg-surface-container-high font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                    <tr>
                      <th className="py-space-sm px-space-md">Txn Reference</th>
                      <th className="py-space-sm px-space-md">Amount (₹)</th>
                      <th className="py-space-sm px-space-md">Routing</th>
                      <th className="py-space-sm px-space-md">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.slice(0, 10).map((t) => (
                      <tr key={t.txn_id || t.id} className="hover:bg-surface-container-highest/60 transition-colors cursor-pointer" onClick={() => { setModalContent(getTxnPayload(t)); setModalOpen(true); }}>
                        <td className="py-space-sm px-space-md font-mono font-semibold text-primary">{t.txn_id || t.id}</td>
                        <td className="py-space-sm px-space-md text-right font-numeric-md text-numeric-md font-bold text-on-surface">{formatCurrency(t.amount)}</td>
                        <td className="py-space-sm px-space-md">{t.channel || "—"}</td>
                        <td className="py-space-sm px-space-md text-right">
                          <button className="px-space-sm py-1 rounded bg-primary text-on-primary font-label-sm text-label-sm hover:bg-primary-container transition-colors cursor-pointer" type="button">View Evidence</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-space-lg min-w-0">
          {/* Risk Factor Breakdown */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col">
            <div className="flex items-center justify-between pb-space-md">
              <div className="flex items-center gap-space-xs">
                <MaterialIcon name="bar_chart" className="text-[20px] text-error" />
                <h3 className="font-headline-md text-headline-md text-on-surface">Risk Factor Breakdown</h3>
              </div>
              <span className="font-label-caps text-label-caps text-outline uppercase font-mono">{severity.toUpperCase()}</span>
            </div>
            <div className="flex flex-col gap-space-md">
              {[
                { label: "Pattern Severity", score: Math.min(risk, 100), color: risk >= 60 ? "text-error" : risk >= 40 ? "text-amber-600" : "text-primary" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-space-2xs">
                  <div className="flex justify-between items-center text-body-sm font-body-sm">
                    <span className="text-on-surface font-medium">{item.label}</span>
                    <span className={`font-numeric-md text-numeric-md font-bold ${item.color}`}>{item.score} / 100</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${risk >= 60 ? "bg-error" : risk >= 40 ? "bg-amber-600" : "bg-primary"}`} style={{ width: `${item.score}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Action */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col">
            <div className="flex items-center justify-between pb-space-md">
              <div className="flex items-center gap-space-xs">
                <MaterialIcon name="verified_user" className="text-[20px] text-primary" />
                <h3 className="font-headline-md text-headline-md text-on-surface">Recommended Actions</h3>
              </div>
              <span className="font-label-caps text-label-caps bg-primary-container text-on-primary px-space-xs py-0.5 rounded">Action Required</span>
            </div>
            <div className="flex flex-col gap-space-sm">
              <button className="w-full text-left p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between group active:scale-[0.99] cursor-pointer disabled:opacity-60" type="button" onClick={assignLead} disabled={!!actionBusy}>
                <div className="flex items-center gap-space-sm min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                    <MaterialIcon name="person_add" className="text-[20px]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">{actionBusy === "assign" ? "Assigning…" : "Assign to Senior Compliance Lead"}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate">Escalate to Tier 2 SIU</span>
                  </div>
                </div>
                <MaterialIcon name="chevron_right" className="text-outline group-hover:text-on-surface transition-colors" />
              </button>
              <button className="w-full text-left p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-all flex items-center justify-between group active:scale-[0.99] cursor-pointer disabled:opacity-60" type="button" onClick={() => generateReport()} disabled={!!actionBusy}>
                <div className="flex items-center gap-space-sm min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-error-container text-on-error-container flex items-center justify-center flex-shrink-0 group-hover:bg-error group-hover:text-on-error transition-colors">
                    <MaterialIcon name="send_and_archive" className="text-[20px]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">{actionBusy === "report" ? "Generating…" : "Export Regulatory SAR / STR Filing"}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate">FIU-IND compliant package</span>
                  </div>
                </div>
                <MaterialIcon name="chevron_right" className="text-outline group-hover:text-on-surface transition-colors" />
              </button>
              {statusMsg && (
                <div className="px-space-md py-space-sm rounded-lg bg-surface-container text-body-sm text-body-sm text-on-surface-variant flex items-center gap-space-xs">
                  <MaterialIcon name={statusMsg.includes("failed") ? "error" : "task_alt"} className="text-[16px] text-primary" />
                  <span>{statusMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Payload Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md" onClick={() => setModalOpen(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md p-space-lg flex flex-col gap-space-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <MaterialIcon name="receipt_long" className="text-[20px] text-error" />
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Forensic Payload</span>
              </div>
              <button className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer" type="button" onClick={() => setModalOpen(false)}>
                <MaterialIcon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="font-mono text-[13px] bg-slate-900 rounded-lg p-space-md text-slate-200 flex flex-col gap-1.5">
              {modalContent.map((line, i) => (
                <span className="text-slate-300" key={i}>{line}</span>
              ))}
            </div>
            <div className="flex gap-1.5 font-label-caps text-label-caps text-outline">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              HASH-CHAIN VERIFIED · SHA-256 SEALED
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvestigationView