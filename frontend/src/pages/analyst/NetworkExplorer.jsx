import { useRef, useState, useEffect } from "react"
import { Link } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import Skeleton, { useDemoLoad } from "../../components/Skeleton.jsx"
import { bus, notify } from "../../lib/runtime.js"
import { api } from "../../lib/api.js"

const MAX_VISIBLE_NODES = 12
const MAX_VISIBLE_EDGES = 32
const CX = 550
const CY = 340

function NetworkExplorer() {
  const [selected, setSelected] = useState("")
  const [accounts, setAccounts] = useState([])
  const [net, setNet] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [suspiciousOnly, setSuspiciousOnly] = useState(true)
  const [layoutMode, setLayoutMode] = useState("Force Directed")
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hovered, setHovered] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [query, setQuery] = useState("")
  const [highRiskOnly, setHighRiskOnly] = useState(false)
  const [minFlowOnly, setMinFlowOnly] = useState(false)
  const [channels, setChannels] = useState([])
  const minFlow = 100000
  const canvasRef = useRef(null)
  const loading = useDemoLoad(650)

  useEffect(() => {
    let alive = true
    api.accounts({ limit: "50" }).then((d) => {
      if (!alive) return
      const items = d.items || []
      setAccounts(items)
      if (items.length > 0) {
        const highRisk = items.find((a) => a.risk_score >= 60) || items[0]
        setSelected(highRisk.id)
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    api.network({ suspicious_only: suspiciousOnly ? "true" : "false" })
      .then((d) => { if (alive) { setNet(d); setView({ x: 0, y: 0, k: 1 }) } })
      .catch(() => {})
    return () => { alive = false }
  }, [suspiciousOnly])

  const nodesData = net?.nodes || []
  const edgesData = net?.edges || []

  const acct = accounts.find((a) => a.id === selected) || accounts.find((a) => a.risk_score >= 60) || {}

  const openDrawer = (id) => {
    setSelected(id)
    setDrawerOpen(true)
    bus.emit("case-context", { entity: id, case: "INV-001" })
  }

  const zoomBy = (factor) => {
    setView((v) => ({ ...v, k: Math.min(2.6, Math.max(0.4, v.k * factor)) }))
  }

  const fitScreen = () => setView({ x: 0, y: 0, k: 1 })

  const q = query.trim().toLowerCase()
  const matchesQuery = (n) => !q || [n.id, n.entity, n.bank, n.city].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
  const riskTier = (n) => (n.risk_score >= 60 ? 0 : n.risk_score >= 40 ? 1 : 2)

  const baseNodes = nodesData.filter((n) => matchesQuery(n) && (!highRiskOnly || n.risk_score >= 80))
  const sorted = [...baseNodes].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
  const nodes = sorted.slice(0, MAX_VISIBLE_NODES)
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edgeList = edgesData
    .filter((e) => {
      if (minFlowOnly && (e.amount || 0) < minFlow) return false
      if (channels.length > 0 && !channels.includes(e.channel)) return false
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return false
      return true
    })
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, MAX_VISIBLE_EDGES)

  function computePositions(list) {
    if (layoutMode === "Hierarchical") {
      const rows = [[], [], []]
      list.forEach((n) => rows[riskTier(n)].push(n))
      const yAt = [160, 330, 500]
      const idxOf = {}
      list.forEach((n, i) => { idxOf[n.id] = i })
      const pos = new Array(list.length)
      rows.forEach((row, band) => {
        const spacing = 1100 / Math.max(row.length + 1, 2)
        row.forEach((n, i) => {
          pos[idxOf[n.id]] = { x: spacing * (i + 1), y: yAt[band] }
        })
      })
      return pos
    }
    if (layoutMode === "Radial") {
      const rings = [150, 245, 335]
      const bandIdx = [0, 0, 0]
      return list.map((_, i) => {
        const b = riskTier(list[i])
        const idx = bandIdx[b]++
        const total = list.reduce((acc, m) => acc + (riskTier(m) === b ? 1 : 0), 0)
        const ang = -Math.PI / 2 + (idx / Math.max(total, 1)) * Math.PI * 2
        return { x: CX + rings[b] * Math.cos(ang), y: CY + rings[b] * 0.78 * Math.sin(ang) }
      })
    }
    return list.map((_, i) => {
      const ang = -Math.PI / 2 + (i / Math.max(list.length, 1)) * Math.PI * 2
      return { x: CX + 300 * Math.cos(ang), y: CY + 230 * Math.sin(ang) }
    })
  }
  const positions = computePositions(nodes)

  const toggleChannel = (c) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const resetFilters = () => {
    setQuery("")
    setHighRiskOnly(false)
    setMinFlowOnly(false)
    setChannels([])
    setSuspiciousOnly(true)
    fitScreen()
  }

  const onPointerDown = (e) => {
    setDragging({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragging || !canvasRef.current) return
    const dx = e.clientX - dragging.x
    const dy = e.clientY - dragging.y
    setView((v) => ({ ...v, x: dragging.vx + dx, y: dragging.vy + dy }))
  }

  const stopDrag = () => setDragging(null)

  const onWheel = (e) => {
    zoomBy(e.deltaY < 0 ? 1.08 : 0.92)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col gap-space-md mb-space-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-md">
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">Network Explorer</h1>
                <span className="px-space-xs py-0.5 rounded bg-error text-on-error font-label-caps text-label-caps tracking-wider">INVESTIGATION INV-001</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Topological forensic graph of suspected mule fan-out and multi-hop layering topology.</p>
            </div>
          </div>
          <div className="flex items-center gap-space-xs flex-wrap">
            <div className="relative flex items-center">
              <MaterialIcon name="search" className="absolute left-space-md text-outline text-[18px]" />
              <input className="w-72 lg:w-96 h-9 pl-9 pr-8 bg-surface-container-lowest rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline shadow-sm focus:outline-none" placeholder="Search accounts (e.g. AC-10254), transaction IDs, or entities..." type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
                if (e.key !== "Enter") return
                const match = baseNodes[0] || nodes[0]
                if (match) { setSelected(match.id); setDrawerOpen(true) }
              }} />
            </div>
            <button className="h-9 px-space-md bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm text-label-sm rounded-lg flex items-center gap-space-xs shadow-sm transition-colors cursor-pointer" type="button" onClick={() => notify({ title: "Advanced rules", body: "Graph rule builder is managed in Admin → Detection Rules.", tone: "primary" })}>
              <MaterialIcon name="tune" className="text-[18px] text-secondary" />
              <span>Advanced Rules</span>
            </button>
            <button className="h-9 px-space-md bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm rounded-lg flex items-center gap-space-xs shadow-sm transition-colors cursor-pointer" type="button" onClick={() => notify({ title: "View saved", body: `Viewport at ${Math.round(view.k * 100)}% stored for INV-001.`, tone: "primary" })}>
              <MaterialIcon name="save" className="text-[18px]" />
              <span>Save View</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 select-none">
          <div className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-lowest shadow-sm text-on-surface font-label-sm text-label-sm whitespace-nowrap">
            <MaterialIcon name="calendar_today" className="text-[16px] text-primary" />
            <span className="text-on-surface-variant font-medium">Window:</span>
            <span className="font-semibold">Oct 1 - Oct 31, 2024</span>
          </div>
          <button type="button" onClick={() => { setHighRiskOnly((v) => !v); fitScreen() }} className={`flex items-center gap-1.5 px-space-sm py-1 rounded font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer ${highRiskOnly ? "bg-error text-on-error" : "bg-error-container text-on-error-container hover:bg-error/70"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
            <span className="font-semibold">Risk: {highRiskOnly ? "High (≥80)" : "All"}</span>
          </button>
          <div className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-lowest shadow-sm text-on-surface font-label-sm text-label-sm whitespace-nowrap">
            <MaterialIcon name="hub" className="text-[16px] text-tertiary" />
            <span className="text-on-surface-variant">Typology:</span>
            <span className="font-semibold">Circular Flow, Fan-Out, Mule Net</span>
          </div>
          <button type="button" onClick={() => { setMinFlowOnly((v) => !v); fitScreen() }} className={`flex items-center gap-1.5 px-space-sm py-1 rounded font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer ${minFlowOnly ? "bg-primary text-on-primary" : "bg-surface-container-lowest shadow-sm text-on-surface hover:bg-surface-container"}`}>
            <MaterialIcon name="currency_rupee" className="text-[16px] text-secondary" />
            <span className="text-on-surface-variant">Min Flow:</span>
            <span className="font-numeric-md text-numeric-md font-semibold">{minFlowOnly ? "≥ ₹1,00,000 On" : "≥ ₹1,00,000 Off"}</span>
          </button>
          <div className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-lowest shadow-sm text-on-surface font-label-sm text-label-sm whitespace-nowrap">
            <MaterialIcon name="payments" className="text-[16px] text-secondary" />
            <span className="text-on-surface-variant">Channels:</span>
            {["UPI", "IMPS", "RTGS"].map((c) => (
              <button type="button" key={c} onClick={() => toggleChannel(c)} className={`px-1.5 py-0.5 rounded font-label-caps text-[10px] font-semibold transition-colors cursor-pointer ${channels.includes(c) ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-secondary-container hover:bg-surface-container"}`}>{c}</button>
            ))}
          </div>
          <button className="px-space-sm py-1 rounded text-primary hover:bg-surface-container-low font-label-sm text-label-sm flex items-center gap-1 cursor-pointer" type="button" onClick={resetFilters}>
            <MaterialIcon name="restart_alt" className="text-[16px]" /> Reset Filters
          </button>
        </div>
      </div>

      <div className="relative w-full h-[calc(100vh-20rem)] min-h-[440px] md:h-[calc(100vh-16rem)] xl:h-[calc(100vh-14rem)] xl:min-h-[580px] rounded-xl bg-surface-container-lowest overflow-hidden shadow-sm flex">
        <div className="absolute top-space-md left-space-md z-20 flex flex-wrap items-center gap-space-xs bg-surface-container-lowest/90 backdrop-blur-md p-space-xs rounded-xl shadow-md">
          <div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-lowest text-on-surface transition-colors cursor-pointer" title="Zoom In" type="button" onClick={() => zoomBy(1.15)}>
              <MaterialIcon name="add" className="text-[18px]" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-lowest text-on-surface transition-colors cursor-pointer" title="Zoom Out" type="button" onClick={() => zoomBy(0.87)}>
              <MaterialIcon name="remove" className="text-[18px]" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-lowest text-on-surface transition-colors cursor-pointer" title="Fit to Screen" type="button" onClick={fitScreen}>
              <MaterialIcon name="fit_screen" className="text-[18px]" />
            </button>
          </div>
          <div className="h-4 w-px bg-surface-container-highest"></div>
          <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 text-on-surface-variant font-label-sm text-label-sm">
            {["Force Directed", "Radial", "Hierarchical"].map((m) => (
              <button key={m} className={`px-space-sm py-1 rounded cursor-pointer ${layoutMode === m ? "bg-surface-container-lowest text-primary font-semibold shadow-xs" : "hover:text-on-surface"}`} type="button" onClick={() => { setLayoutMode(m); fitScreen() }}>{m}</button>
            ))}
          </div>
          <div className="h-4 w-px bg-surface-container-highest"></div>
          <label className="flex items-center gap-space-xs px-space-xs cursor-pointer select-none">
            <input checked={suspiciousOnly} onChange={(e) => setSuspiciousOnly(e.target.checked)} className="rounded w-4 h-4 text-primary accent-primary bg-surface-container-lowest cursor-pointer" type="checkbox" />
            <span className="font-label-sm text-label-sm text-on-surface font-medium">Suspicious Paths Only</span>
          </label>
        </div>

        <div className="absolute bottom-space-md left-space-md z-20 flex items-center gap-space-md bg-surface-container-lowest/90 backdrop-blur-md px-space-md py-space-xs rounded-xl shadow-md text-on-surface-variant font-label-sm text-label-sm">
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-3 rounded-full bg-error"></span>
            <span>High Risk (≥60)</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-3 rounded-full bg-primary"></span>
            <span>Scoped Flow Node</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-3 rounded-full bg-outline"></span>
            <span>Intermediary</span>
          </div>
          <div className="h-3 w-px bg-surface-container-highest"></div>
          <span className="font-numeric-md text-numeric-md text-on-surface font-semibold">{nodes.length} Nodes · {edgeList.length} Flow Edges</span>
        </div>

        <div
          className="relative w-full h-full cursor-grab active:cursor-grabbing overflow-hidden select-none bg-[radial-gradient(#e0e3e5_1px,transparent_1px)] [background-size:20px_20px]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerLeave={stopDrag}
          onWheel={onWheel}
          ref={canvasRef}
        >
          {loading ? (
            <div className="absolute inset-0 p-space-base flex flex-col gap-space-md">
              <div className="flex items-center gap-2">
                <span className="px-space-sm py-0.5 rounded bg-error-container text-error font-label-caps text-label-caps font-bold uppercase tracking-wider">Graph Loading</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Compiling multi-hop topology for INV-001…</span>
              </div>
              <Skeleton className="h-56 w-3/4" />
              <div className="flex gap-space-base">
                <Skeleton className="h-24 w-40" />
                <Skeleton className="h-24 w-40" />
                <Skeleton className="h-24 w-40" />
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-space-sm text-on-surface-variant">
              <MaterialIcon name="hub" className="text-[48px] text-outline" />
              <span className="font-headline-sm text-headline-sm">No matching nodes</span>
              <span className="font-body-sm text-body-sm">Adjust the search or filters to reveal network topology.</span>
            </div>
          ) : (
          <svg className="w-full h-full" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "center", transition: dragging ? "none" : "transform 130ms ease" }} viewBox="0 0 1100 680" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter height="140%" id="nxGlow" width="140%" x="-20%" y="-20%">
                <feDropShadow dx="0" dy="2" floodColor="#ba1a1a" floodOpacity="0.25" stdDeviation="4"></feDropShadow>
              </filter>
              <marker id="arrowRed" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3">
                <path d="M0,0 L0,6 L8,3 z" fill="#ba1a1a"></path>
              </marker>
              <marker id="arrowBlue" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="3">
                <path d="M0,0 L0,6 L8,3 z" fill="#1d4ed8"></path>
              </marker>
            </defs>

            {edgeList.map((e, i) => {
              const fi = nodes.findIndex((n) => n.id === e.from)
              const ti = nodes.findIndex((n) => n.id === e.to)
              const a = positions[fi]
              const b = positions[ti]
              if (!a || !b) return null
              const highVal = (e.amount || 0) >= 500000
              const midX = (a.x + b.x) / 2 + (i % 2 === 0 ? 30 : -30)
              const midY = (a.y + b.y) / 2 + (i % 2 === 0 ? -36 : 36)
              return (
                <g key={e.id || e.txn_id || i} opacity={hovered && hovered !== e.from && hovered !== e.to ? 0.15 : 1} style={{ transition: "opacity 200ms" }}>
                  <path d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`} fill="none" markerEnd={highVal ? "url(#arrowRed)" : "url(#arrowBlue)"} stroke={highVal ? "#ba1a1a" : "#1d4ed8"} strokeDasharray={highVal ? "6,4" : "3,4"} strokeLinecap="round" strokeOpacity={highVal ? 0.85 : 0.45} strokeWidth={highVal ? 2.5 : 1.6}></path>
                </g>
              )
            })}

            {nodes.map((n, idx) => {
              const p = positions[idx] || { x: CX, y: CY }
              const isHub = idx === 0 || n.risk_score >= 60
              const fill = isHub ? "#ba1a1a" : "#1d4ed8"
              const label = n.risk_score >= 60 ? `${n.id} (HUB)` : n.id
              const note = `${n.risk_score || "—"} RISK · ${(n.entity || "").toUpperCase().slice(0, 18)}`
              return (
                <g key={n.id} className="cursor-pointer transition-transform hover:scale-105" onClick={() => openDrawer(n.id)} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)} style={{ opacity: hovered && hovered !== n.id ? 0.3 : 1, transition: "opacity 200ms, transform 150ms" }} transform={`translate(${p.x}, ${p.y})`}>
                  {isHub && <circle className="animate-pulse" fill="#ffdad6" opacity="0.5" r="40"></circle>}
                  <circle fill="#ffffff" filter="url(#nxGlow)" r={isHub ? 30 : 26}></circle>
                  <circle fill="#f2f4f6" r={isHub ? 25 : 22}></circle>
                  <circle fill={fill} r={isHub ? 10 : 6}></circle>
                  <text className="font-semibold text-[11px]" fill="#191c1e" textAnchor="middle" y={isHub ? 48 : 42}>{label}</text>
                  <text className="text-[9px]" fill="#565e74" textAnchor="middle" y={isHub ? 61 : 54}>{note}</text>
                </g>
              )
            })}
          </svg>
          )}
          <div className="absolute right-space-md bottom-space-md z-10 px-2 py-1 rounded-md bg-surface-container-lowest/90 backdrop-blur font-label-caps text-label-caps text-on-surface-variant shadow-sm pointer-events-none">
            {Math.round(view.k * 100)}% · {layoutMode} · drag to pan · scroll to zoom
          </div>
        </div>

{/* __DRAWER__ */}
        {drawerOpen && (
          <aside className="absolute top-0 right-0 h-full w-panel-drawer-w max-w-[85vw] bg-surface-container-lowest/95 backdrop-blur-xl shadow-xl flex flex-col justify-between z-30 overflow-y-auto">
            <div className="flex flex-col">
              <div className="p-space-md bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <MaterialIcon name="account_balance" className="text-primary text-[20px]" />
                  <span className="font-headline-sm text-headline-sm text-on-surface">Account Detail Inspector</span>
                </div>
                <button className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer" type="button" onClick={() => setDrawerOpen(false)}>
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>
              <div className="p-space-lg flex flex-col gap-space-md">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-headline-md text-headline-md text-on-surface">{selected}</span>
                    <span className="font-body-md text-body-md font-medium text-on-surface-variant">{acct.entity || "—"}</span>
                    <span className="font-body-sm text-body-sm text-secondary mt-space-2xs">{acct.bank || "—"} · {acct.city || "—"}</span>
                    <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Category: {acct.category || "—"}</span>
                  </div>
                  <span className="px-space-sm py-1 rounded bg-error text-on-error font-label-caps text-label-caps uppercase tracking-wider font-semibold">{acct.risk_score >= 60 ? "HIGH RISK" : "FLAGGED"}</span>
                </div>

                <div className="flex flex-col gap-space-xs p-space-md rounded-lg bg-surface-container-low">
                  <div className="font-label-sm font-label-sm text-on-surface-variant font-medium">Risk Assessment</div>
                  <div className="flex items-baseline gap-space-sm mt-1">
                    <span className="font-numeric-lg text-numeric-lg font-semibold text-on-surface">{acct.risk_score}/100</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Risk Score</span>
                  </div>
                  <div className="w-full h-2 rounded bg-surface-container-highest overflow-hidden mt-1">
                    <div className="bg-primary h-full" style={{ width: `${acct.risk_score || 0}%` }}></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Total Sent</span>
                    <span className="font-numeric-lg text-numeric-lg text-on-surface mt-1">{acct.total_sent ? `₹${(acct.total_sent / 1e7).toFixed(1)} Cr` : "—"}</span>
                  </div>
                  <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Total Received</span>
                    <span className="font-numeric-lg text-numeric-lg text-on-surface mt-1">{acct.total_received ? `₹${(acct.total_received / 1e7).toFixed(1)} Cr` : "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Type</span>
                    <span className="font-body-md text-body-md text-on-surface mt-1">{acct.type || "—"}</span>
                  </div>
                  <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Institution</span>
                    <span className="font-body-md text-body-md text-on-surface mt-1">{acct.institution || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-space-md bg-surface-container-lowest flex flex-col gap-space-xs">
              <Link className="w-full h-9 rounded bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center justify-center gap-space-xs transition-colors" to={`/analyst/entities/${selected}`}>
                <MaterialIcon name="account_box" className="text-[16px]" />
                <span>View Entity Profile ({selected})</span>
              </Link>
              <Link className="w-full h-9 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-space-xs transition-colors" to="/analyst/investigations/INV-001">
                <MaterialIcon name="folder_open" className="text-[16px]" />
                <span>Open Investigation</span>
              </Link>
              <Link className="w-full h-9 rounded bg-surface-container-lowest hover:bg-surface-container-low text-secondary font-label-sm text-label-sm flex items-center justify-center gap-space-xs transition-colors" to="/analyst/flow-timeline">
                <MaterialIcon name="timeline" className="text-[16px]" />
                <span>Trace Flow Timeline</span>
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

export default NetworkExplorer