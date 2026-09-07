import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import { notify, formatINR } from "../../lib/runtime.js"
import { api, patternLabel } from "../../lib/api.js"

const NODE_POS = [
  { x: 480, y: 205 },
  { x: 205, y: 330 },
  { x: 755, y: 330 },
  { x: 385, y: 445 },
  { x: 575, y: 445 },
  { x: 480, y: 335 },
]

function FlowTimeline() {
  const { id: paramId } = useParams()
  const location = useLocation()
  const initialId = paramId || location.state?.id || "INV-001"

  const [held, setHeld] = useState(false)
  const [holdBusy, setHoldBusy] = useState(false)
  const [holdMsg, setHoldMsg] = useState("")
  const [loopOn, setLoopOn] = useState(true)
  const [inv, setInv] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [frame, setFrame] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const graphSvgRef = useRef(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const d = await api.investigation(initialId)
        if (alive) setInv(d)
      } catch {}
      try {
        const t = await api.investigationTimeline(initialId)
        if (alive) { setTimeline(t); setFrame((t?.days?.length || 1) - 1) }
      } catch {}
    }
    load()
    return () => { alive = false }
  }, [initialId])

  const days = timeline?.days || []
  const lastIdx = Math.max(days.length - 1, 0)
  const frameIdx = frame < 0 ? lastIdx : Math.min(frame, lastIdx)

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setFrame((f) => {
        const nf = f + 1
        if (nf > lastIdx) {
          if (loopOn) return 0
          setPlaying(false)
          return lastIdx
        }
        return nf
      })
    }, 1100)
    return () => clearInterval(timer)
  }, [playing, loopOn, lastIdx])

  const id = inv?.id || initialId
  const summary = inv?.summary || {}
  const accounts = Array.isArray(inv?.accounts) ? inv.accounts : (summary.accounts || [])
  const pattern = summary.pattern || patternLabel(summary.pattern_types?.[0] || "unknown")
  const risk = inv?.risk_score ?? 0
  const primaryAccount = summary.primary_account || accounts[0]?.id || "—"
  const totalVolume = timeline?.total_volume || 0
  const totalTxns = timeline?.total_txns || 0
  const startDate = timeline?.start ? new Date(`${timeline.start}T00:00:00`) : null
  const endDate = timeline?.end ? new Date(`${timeline.end}T00:00:00`) : null
  const dateLabel = startDate && endDate
    ? `${startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${startDate.getFullYear()}`
    : "—"
  const spanDays = days.length || 0
  const currentDay = days[frameIdx] || null

  const sortedAccounts = [...accounts].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 6)
  const posById = {}
  sortedAccounts.forEach((a, i) => { posById[a.id] = NODE_POS[i % NODE_POS.length] })

  const frameTxns = days.slice(0, frameIdx + 1).flatMap((d) => d.event_txns || [])
  const activeIds = new Set(frameTxns.flatMap((t) => [t.from, t.to]))
  activeIds.add(primaryAccount)
  const activeEdges = frameTxns
    .filter((t) => posById[t.from] && posById[t.to])
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 16)

  const visibleAccounts = sortedAccounts.filter((a) => activeIds.has(a.id) || a.id === primaryAccount)

  const play = () => { setFrame(0); setPlaying(true) }
  const seekTo = (i) => { setFrame(i); setPlaying(false) }
  const step = (dir) => {
    setPlaying(false)
    setFrame((f) => Math.min(lastIdx, Math.max(0, (f < 0 ? 0 : f) + dir)))
  }

  const captureFrame = () => {
    const svg = graphSvgRef.current
    if (!svg) return notify({ title: "No frame", body: "The graph has not rendered yet.", tone: "secondary" })
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${id}-day${frameIdx + 1}-frame.svg`
    a.click()
    URL.revokeObjectURL(url)
    notify({ title: "Frame captured", body: `${id} · Day ${frameIdx + 1} topology snapshot saved.`, tone: "primary" })
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Investigation Context Bar & Breadcrumb Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md py-space-md mb-space-base">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm mb-space-2xs">
            <Link className="hover:text-primary cursor-pointer transition-colors" to="/analyst/alerts">Forensic Vault</Link>
            <MaterialIcon name="chevron_right" className="text-[14px]" />
            <Link className="hover:text-primary cursor-pointer transition-colors" to={`/analyst/investigations/${id}`}>Case {id}</Link>
            <MaterialIcon name="chevron_right" className="text-[14px]" />
            <span className="text-primary font-headline-sm text-headline-sm">Dynamic Flow Timeline</span>
          </div>
          <div className="flex items-baseline gap-space-md flex-wrap">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Flow Timeline</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Watch the financial network form over time.</p>
          </div>
        </div>
        {/* Switchers & Dossier Direct Links */}
        <div className="flex items-center gap-space-sm self-start lg:self-center flex-wrap">
          <div className="flex items-center gap-space-2xs bg-surface-container-high px-space-sm py-1.5 rounded-full text-on-surface-variant font-label-caps text-label-caps">
            <span className={`w-2 h-2 rounded-full ${playing ? "bg-error animate-pulse" : "bg-primary"}`}></span>
            <span>{playing ? `REPLAYING · DAY ${frameIdx + 1} OF ${spanDays}` : inv ? `FRAME DAY ${frameIdx + 1} OF ${spanDays}` : "LOADING CASE…"}</span>
          </div>
          <Link className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm shadow-sm" to="/analyst/network-explorer">
            <MaterialIcon name="hub" className="text-[16px] text-primary" />
            <span>Network Explorer</span>
          </Link>
          <Link className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-sm text-label-sm shadow-sm" to={`/analyst/investigations/${id}`}>
            <MaterialIcon name="folder_open" className="text-[16px]" />
            <span>Investigation Dossier</span>
          </Link>
        </div>
      </div>

      {/* Meta Summary Pillboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm mb-space-lg">
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Target Scope</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">{id} ({patternLabel(pattern)})</span>
          </div>
          <span className="px-space-xs py-1 rounded bg-secondary-container text-on-secondary-fixed font-numeric-md text-numeric-md">{accounts.length} Entities</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Total Trace Volume</span>
            <span className="font-numeric-lg text-numeric-lg text-on-surface">{formatINR(totalVolume)}</span>
          </div>
          <span className="text-on-surface-variant font-label-sm text-label-sm">INR Verified</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Algorithmic Risk Score</span>
            <span className={`font-numeric-lg text-numeric-lg flex items-center gap-space-2xs ${risk >= 40 ? "text-error" : "text-on-surface"}`}>
              {risk}<span className="text-label-sm font-label-sm text-outline">/100</span>
            </span>
          </div>
          <span className={`px-space-xs py-0.5 rounded-full font-label-caps text-label-caps font-semibold ${risk >= 60 ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-on-surface"}`}>{risk >= 40 ? "HIGH RISK" : "MEDIUM RISK"}</span>
        </div>
        <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Time Horizon</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">{dateLabel}</span>
          </div>
          <span className="font-label-caps text-label-caps text-outline">{spanDays} DAYS SPAN</span>
        </div>
      </div>

      {/* Primary Canvas + Side Panel Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Visual Graph Stage (9 Cols) */}
        <div className="xl:col-span-9 flex flex-col gap-space-md">
          {/* Graph Canvas Container */}
          <div className="relative w-full h-[600px] bg-surface-container-lowest rounded shadow-sm overflow-hidden">
            {/* Technical Dot-Matrix Background */}
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: "radial-gradient(#747686 0.75px, transparent 0.75px)", backgroundSize: "16px 16px" }}></div>

            {/* Canvas Floating Top Toolbar */}
            <div className="relative z-20 flex items-center justify-between p-space-md pointer-events-none">
              <div className="flex items-center gap-space-xs bg-surface-container-lowest/90 backdrop-blur-md px-space-sm py-1 rounded shadow-sm pointer-events-auto">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></span>
                <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider">Topology Snapshot · Day {frameIdx + 1}</span>
                <span className="text-outline">·</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{totalTxns} Txns Over {spanDays} Days</span>
              </div>
              <div className="flex items-center gap-1.5 px-space-sm py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-lg shadow-sm text-on-surface-variant font-label-caps text-label-caps pointer-events-auto">
                <MaterialIcon name="security_update_warning" className="text-[14px] text-primary" />
                <span>Pattern: {patternLabel(pattern)}</span>
              </div>
            </div>

            {/* Animated Forensic Network Diagram (SVG Visual Layer) */}
            <div className="absolute inset-0 z-10 flex items-center justify-center p-space-md">
              <svg ref={graphSvgRef} className="w-full h-full" fill="none" viewBox="0 0 960 520" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="flowGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.35"></stop>
                    <stop offset="50%" stopColor="#ba1a1a" stopOpacity="0.85"></stop>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.35"></stop>
                  </linearGradient>
                  <radialGradient cx="50%" cy="50%" id="crimson-glow" r="50%">
                    <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.3"></stop>
                    <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0"></stop>
                  </radialGradient>
                  <filter height="140%" id="nodeGlow" width="140%" x="-20%" y="-20%">
                    <feDropShadow dx="0" dy="2" floodColor="#0f172a" floodOpacity="0.08" stdDeviation="3"></feDropShadow>
                  </filter>
                  <marker id="arrowRed" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="3">
                    <path d="M0,0 L0,6 L8,3 z" fill="#ba1a1a"></path>
                  </marker>
                  <marker id="arrowBlue" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="3">
                    <path d="M0,0 L0,6 L8,3 z" fill="#1d4ed8"></path>
                  </marker>
                </defs>

                {activeEdges.length === 0 ? (
                  <text className="text-[12px]" fill="#747686" x="480" y="250" textAnchor="middle">No fund movement scoped yet on this frame — press Play to replay formation.</text>
                ) : activeEdges.map((t, i) => {
                  const a = posById[t.from]
                  const b = posById[t.to]
                  if (!a || !b) return null
                  const highVal = (t.amount || 0) >= 500000
                  const midX = (a.x + b.x) / 2 + (i % 2 === 0 ? 45 : -45)
                  const midY = (a.y + b.y) / 2 + (i % 2 === 0 ? -40 : 40)
                  const d = `M ${a.x} ${a.y} Q ${midX} ${midY}, ${b.x} ${b.y}`
                  const dur = 2.5 + (i % 3) * 0.6
                  return (
                    <g key={t.id || t.txn_id || i}>
                      <path d={d} fill="none" markerEnd={highVal ? "url(#arrowRed)" : "url(#arrowBlue)"} stroke={highVal ? "#ba1a1a" : "#1d4ed8"} strokeDasharray={highVal ? "6,4" : "3,4"} strokeLinecap="round" strokeOpacity={highVal ? 0.85 : 0.4} strokeWidth={highVal ? 2.5 : 1.6}></path>
                      <circle fill={highVal ? "#ba1a1a" : "#1d4ed8"} r="3.5">
                        <animateMotion dur={`${dur}s`} path={d} repeatCount="indefinite"></animateMotion>
                      </circle>
                    </g>
                  )
                })}

                {/* Formed scoped account nodes */}
                {visibleAccounts.map((acct, idx) => {
                  const p = posById[acct.id]
                  if (!p) return null
                  const isHub = acct.id === primaryAccount || idx === 0
                  const fill = isHub ? "#ba1a1a" : "#1d4ed8"
                  const note = `${acct.risk_score ?? "—"} RISK · ${(acct.entity || acct.name || "ACCOUNT").toUpperCase().slice(0, 18)}`
                  return (
                    <g key={acct.id} transform={`translate(${p.x}, ${p.y})`}>
                      {isHub && <circle className="animate-pulse" fill="#ffdad6" opacity="0.5" r="42"></circle>}
                      <circle fill="#ffffff" filter="url(#nodeGlow)" r={isHub ? 30 : 26}></circle>
                      <circle fill="#f2f4f6" r={isHub ? 25 : 22}></circle>
                      <circle fill={fill} r={isHub ? 10 : 6}>
                        <animate attributeName="r" from="0" to={isHub ? 10 : 6} dur="0.4s" fill="freeze"></animate>
                      </circle>
                      <text className="font-semibold text-[11px]" fill="#191c1e" textAnchor="middle" y={isHub ? 48 : 42}>{acct.id}{isHub ? " (HUB)" : ""}</text>
                      <text className="text-[9px]" fill="#565e74" textAnchor="middle" y={isHub ? 61 : 54}>{note}</text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Graph Footer Status Bar */}
            <div className="relative z-20 px-space-md py-space-xs bg-surface-container-low/90 backdrop-blur-sm flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
              <div className="flex items-center gap-space-md">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-error"></span> Primary Account (Hub)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Scoped Account</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-outline"></span> Forming Flow</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span>{activeEdges.length} flows · {visibleAccounts.length}/{accounts.length} accounts formed</span>
              </div>
            </div>
          </div>

          {/* Formation Window Playback & Scrubber Controller Bar */}
          <div className="w-full bg-surface-container-lowest rounded shadow-sm p-space-base flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <MaterialIcon name="history" className="text-[20px] text-primary" />
                <span className="font-headline-sm text-headline-sm text-on-surface">Formation Window · {spanDays} Days</span>
                <span className="text-outline">·</span>
                <span className="font-numeric-md text-numeric-md text-on-surface-variant">{dateLabel}</span>
              </div>
              <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error"></span> {patternLabel(pattern)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <button className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-40" type="button" title="Rewind to Day 1" onClick={() => seekTo(0)} disabled={frameIdx === 0}>
                  <MaterialIcon name="first_page" className="text-[18px]" />
                </button>
                <button className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-40" type="button" title="Previous Day" onClick={() => step(-1)} disabled={frameIdx === 0}>
                  <MaterialIcon name="chevron_left" className="text-[18px]" />
                </button>
                <button className={`h-9 px-space-md rounded-lg text-on-primary font-label-sm text-label-sm font-semibold flex items-center gap-space-xs shadow-sm transition-all cursor-pointer ${playing ? "bg-on-surface-variant" : "bg-primary hover:bg-primary-container"}`} type="button" onClick={() => (playing ? setPlaying(false) : play())}>
                  <MaterialIcon name={playing ? "pause" : "play_arrow"} className="text-[20px]" />
                  <span>{playing ? "Pause" : "Play Formation"}</span>
                </button>
                <button className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-40" type="button" title="Next Day" onClick={() => step(1)} disabled={frameIdx >= lastIdx}>
                  <MaterialIcon name="chevron_right" className="text-[18px]" />
                </button>
                <button className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-40" type="button" title="Jump to Final Day" onClick={() => seekTo(lastIdx)} disabled={frameIdx >= lastIdx}>
                  <MaterialIcon name="last_page" className="text-[18px]" />
                </button>
              </div>
              <div className="flex items-center gap-space-sm">
                <button className={`flex items-center gap-space-2xs px-space-sm py-1 rounded font-label-sm text-label-sm cursor-pointer ${loopOn ? "bg-surface-container-low text-primary" : "bg-surface-container text-on-surface-variant"}`} type="button" onClick={() => setLoopOn((v) => !v)}>
                  <MaterialIcon name="repeat" className="text-[16px]" />
                  <span>Loop {loopOn ? "On" : "Off"}</span>
                </button>
                <button className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm transition-colors shadow-sm cursor-pointer" type="button" onClick={captureFrame}>
                  <MaterialIcon name="camera" className="text-[16px]" />
                  <span>Capture Frame</span>
                </button>
              </div>
            </div>

            {/* Scrubber Track */}
            <div className="relative py-space-sm px-space-xs pt-space-sm">
              <div className="w-full h-2 rounded-full bg-surface-container-high relative overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${spanDays ? ((frameIdx + 1) / spanDays) * 100 : 0}%`, background: "linear-gradient(90deg,#1d4ed8,#ba1a1a)" }}></div>
              </div>
              <div className="relative w-full flex justify-between items-center -mt-6">
                {days.map((d, i) => {
                  const isActive = i === frameIdx
                  return (
                    <button key={d.day} className="group flex flex-col items-center focus:outline-none cursor-pointer" type="button" onClick={() => seekTo(i)}>
                      <span className={`rounded-full flex items-center justify-center font-label-caps transition-all ${isActive ? "w-7 h-7 bg-error text-on-error font-numeric-md font-bold shadow-md ring-4 ring-error-container" : "w-5 h-5 bg-primary text-on-primary text-[10px] shadow-sm group-hover:scale-110"}`}>{d.day}</span>
                      <span className={`mt-2 font-label-caps text-label-caps ${isActive ? "text-error font-bold uppercase tracking-wider" : "text-on-surface-variant"}`}>{isActive ? "Active Pin" : `Day ${d.day}`}</span>
                      <span className="font-body-sm text-[11px] text-outline">{d.date}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Frame Status Strip */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-xs border-t border-surface-container">
              <div className="flex items-center gap-space-sm">
                <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded">
                  <span className="font-label-caps text-label-caps text-outline px-1">DAY</span>
                  <span className="px-2 py-0.5 rounded font-label-sm text-label-sm text-on-surface font-semibold bg-surface-container-lowest shadow-sm">{frameIdx + 1}</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {currentDay ? `${formatINR(currentDay.volume)} moved · ${currentDay.txn_count} txns · ${currentDay.active_accounts} active accounts on ${currentDay.date}` : "Select a day to inspect frame telemetry."}
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-numeric-md text-numeric-md text-on-surface-variant">
                <span>{formatINR(frameTxns.reduce((s, t) => s + (t.amount || 0), 0))} cumulative</span>
                <span className="text-outline">·</span>
                <span>{Object.keys(posById).length} laid out nodes</span>
              </div>
            </div>
          </div>
        </div>
        {/* Right Side Panel: Network Evolution Cadence (3 Cols) */}
        <div className="xl:col-span-3 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest rounded shadow-sm p-space-base flex flex-col gap-space-base">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Chronology Track</span>
                <h2 className="font-headline-md text-headline-md text-on-surface">Evolution Cadence</h2>
              </div>
              <MaterialIcon name="reorder" className="text-[20px] text-outline" />
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Forensic ledger tracking entity expansion, velocity surges, and structural topology phases across {spanDays} tracked days for {id}.
            </p>
            <div className="flex flex-col gap-space-sm relative">
              <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-surface-container-highest"></div>
              {days.map((d, i) => {
                const isCurrent = i === frameIdx
                return (
                  <button key={d.day} type="button" className={`relative pl-8 flex flex-col gap-space-2xs text-left cursor-pointer rounded transition-all ${isCurrent ? "scale-[1.02]" : "opacity-90 hover:opacity-100"}`} onClick={() => seekTo(i)}>
                    {isCurrent ? (
                      <>
                        <span className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-error border-2 border-surface-container-lowest animate-ping"></span>
                        <span className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-error border-2 border-surface-container-lowest"></span>
                      </>
                    ) : (
                      <span className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface-container-lowest"></span>
                    )}
                    <div className={`p-space-sm rounded flex flex-col gap-1 ${isCurrent ? "bg-error-container/40 shadow-sm" : "bg-surface-container-low"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-label-caps text-label-caps font-semibold ${isCurrent ? "text-error font-bold uppercase" : "text-primary"}`}>DAY {d.day}{isCurrent ? " · CURRENT FRAME" : ""}</span>
                        <span className={`font-numeric-md text-numeric-md font-semibold ${isCurrent ? "text-error" : "text-on-surface"}`}>{d.active_accounts} Accts</span>
                      </div>
                      <div className="font-numeric-lg text-numeric-lg text-on-surface">{formatINR(d.volume)}</div>
                      <span className="text-[11px] text-on-surface-variant">{d.txn_count} transaction(s) on {d.date}</span>
                      {d.event_txns?.[0] && (
                        <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                          {d.event_txns[0].from} → {d.event_txns[0].to} via {d.event_txns[0].channel}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {/* Volume Growth Telemetry Bar Chart Sparkline */}
            <div className="mt-space-xs p-space-sm rounded bg-surface-container-low flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">Volume Per Day</span>
                <span className="font-numeric-md text-numeric-md text-primary font-semibold">{formatINR(totalVolume)} total</span>
              </div>
              <div className="h-14 w-full flex items-end justify-between gap-1 pt-2">
                {days.map((d, i) => {
                  const max = Math.max(...days.map((x) => x.volume), 1)
                  const h = days.length ? Math.max((d.volume / max) * 100, 4) : 4
                  return (
                    <button key={d.day} type="button" title={`Day ${d.day}: ${formatINR(d.volume)}${i === frameIdx ? " (current frame)" : ""}`} onClick={() => seekTo(i)} className={`w-full rounded-t transition-all cursor-pointer ${i === frameIdx ? "bg-error" : "bg-primary-container hover:bg-primary-container-dim"}`} style={{ height: `${h}%` }}></button>
                  )
                })}
              </div>
              <div className="flex justify-between font-label-caps text-[10px] text-outline pt-1">
                <span>D1</span>
                {days.length > 2 && <span>D{days.length / 2 | 0}</span>}
                <span className="text-error font-bold">D{days.length}</span>
              </div>
            </div>
            {/* Action Card: Auto Freeze or Notify */}
            <div className="p-space-sm rounded bg-surface-container flex flex-col gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">Recommended Intervention</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Primary suspect {primaryAccount} scoped in {id} ({patternLabel(pattern)}). Consider a provisional hold pending analyst review.
              </span>
              <button className={`mt-space-2xs w-full py-1.5 rounded font-label-sm text-label-sm font-semibold text-center transition-colors cursor-pointer disabled:opacity-60 ${held ? "bg-emerald-600 text-white" : "bg-error text-on-error hover:opacity-90"}`} type="button" disabled={holdBusy} onClick={() => {
                if (held || holdBusy) return
                setHoldBusy(true)
                setHoldMsg("")
                api.updateAccount(primaryAccount, { frozen: true, freeze_reason: "Provisional hold placed during timeline replay" })
                  .then(() => { setHeld(true); setHoldMsg(`Provisional hold placed · ${primaryAccount}`) })
                  .catch((err) => setHoldMsg(`Hold failed: ${err.message}`))
                  .finally(() => setHoldBusy(false))
              }}>
                {holdBusy ? "Placing hold…" : held ? `Provisional Hold Placed · ${primaryAccount}` : `Issue Provisional Hold (${primaryAccount})`}
              </button>
              {holdMsg && <span className="mt-1 text-body-xs text-body-xs text-on-surface-variant">{holdMsg}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FlowTimeline