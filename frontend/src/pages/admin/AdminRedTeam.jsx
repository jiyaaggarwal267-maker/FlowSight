import { useCallback, useEffect, useMemo, useState } from "react"
import { api } from "../../lib/api"
import { formatINR, notify } from "../../lib/runtime"
import Badge from "../../components/Badge.jsx"
import Card from "../../components/Card.jsx"
import MaterialIcon from "../../components/MaterialIcon.jsx"

const PRESETS = [
  { id: "low", label: "Low", hint: "Short ring, fast, uniform" },
  { id: "medium", label: "Medium", hint: "Longer chain, some noise" },
  { id: "high", label: "High", hint: "Near the detection limits" },
  { id: "extreme", label: "Extreme", hint: "Built to slip past" },
]

const CONTROLS = [
  {
    key: "hop_count",
    label: "Hop count",
    icon: "linear_scale",
    min: 3,
    max: 12,
    step: 1,
    unit: "hops",
    help: "Edges in the cycle. The detector abandons a path once it reaches its depth limit.",
  },
  {
    key: "time_spread_hours",
    label: "Time spread",
    icon: "schedule",
    min: 1,
    max: 240,
    step: 1,
    unit: "h",
    help: "How long the money takes to come back to the origin.",
  },
  {
    key: "amount_variance",
    label: "Amount variance",
    icon: "casino",
    min: 0,
    max: 0.95,
    step: 0.05,
    unit: "",
    format: (v) => `${Math.round(v * 100)}% jitter`,
    help: "Randomises each edge around the baseline amount. Only defeats the edge floor if the band dips under it.",
  },
  {
    key: "dilution",
    label: "Account dilution",
    icon: "blur_on",
    min: 0,
    max: 8,
    step: 1,
    unit: "noise accts",
    help: "Innocent accounts moving small amounts alongside the ring.",
  },
]

// One button system for the whole page. Every control used to carry its own
// bespoke class string, which is what produced seven near-duplicate button
// styles; geometry now lives in BTN_BASE and colour in the three recipes
// below, so a new button is one of these plus state modifiers.
const BTN_BASE =
  "inline-flex items-center gap-space-xs rounded-lg font-label-sm text-label-sm font-semibold transition-colors disabled:opacity-50"
// Primary action: one per view, the thing you came here to do.
const BTN_PRIMARY = `${BTN_BASE} w-full justify-center px-space-base py-3 bg-primary text-on-primary hover:opacity-90`
// Destructive-but-reversible secondary action.
const BTN_SECONDARY = `${BTN_BASE} w-full justify-center px-space-base py-2 border border-outline text-on-surface-variant hover:bg-surface-container`
// Stacked option (label + supporting hint) used by the preset picker.
const BTN_OPTION = `${BTN_BASE} w-full flex-col items-start gap-0.5 px-space-sm py-space-xs border text-left`

function inr(v) {
  return `₹${Number(v || 0).toLocaleString("en-IN")}`
}

// Ring layout: the chain is a circle, so place the cycle nodes on one and hang
// the noise accounts off to the side.
function layout(network) {
  const chain = network.chain
  const noise = network.noise
  const R = 118
  const C = { x: 200, y: 190 }
  const pos = {}
  chain.forEach((id, i) => {
    const a = (i / chain.length) * Math.PI * 2 - Math.PI / 2
    pos[id] = { x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a), cycle: true }
  })
  noise.forEach((id, i) => {
    const a = (i / Math.max(noise.length, 1)) * Math.PI * 0.9 - Math.PI * 0.45
    pos[id] = { x: C.x + 168 * Math.cos(a), y: C.y + 152 * Math.sin(a), cycle: false }
  })
  return pos
}

// ── Graph rendering ──────────────────────────────────────────────────
// Visual vocabulary is lifted wholesale from the app's existing graphs so the
// simulator reads as part of the same product rather than a bolt-on:
//   • edge gradient + crimson arrowhead + txn chips  -> InvestigationView
//     ("Why was this network flagged?" diagram)
//   • travelling flow packets (animateMotion)        -> Overview + FlowTimeline
//   • node radii / halo / label offsets              -> FlowTimeline
//   • node drop-shadow filter                        -> Overview, FlowTimeline,
//                                                      InvestigationView
//   • neutral edge colour #cbd5e1                    -> Overview
//   • dot-grid canvas                                -> InvestigationView
// Only the rendering layer below is new; node positions still come from
// `layout()` above, unchanged.

// Radii copied from FlowTimeline so node sizing matches the rest of the app.
const R_HUB = 30
const R_HOP = 26
const R_NOISE = 15
const EDGE_GAP = 8

// Risk palette already in use elsewhere. Origin = the account the ring funds
// out of and back into, so it carries the crimson "hub" treatment every other
// graph uses for a primary account. Hops use the standard scoped-account blue.
// Dilution accounts use the amber already used on the public landing graph.
const COLOR_HUB = "#ba1a1a"
const COLOR_HOP = "#1d4ed8"
const COLOR_NOISE = "#f59e0b"
const COLOR_NEUTRAL_EDGE = "#cbd5e1"
const COLOR_RETURN_LEG = "#dc2626"

function roleRadius(role) {
  return role === "hub" ? R_HUB : role === "hop" ? R_HOP : R_NOISE
}

function RingGraph({ network, verdict }) {
  const pos = useMemo(() => layout(network), [network])
  const cycleTxnIds = new Set(network.cycle_txns.map((t) => t.txn_id))
  const total = network.cycle_txns.reduce((s, t) => s + t.amount, 0)

  // Role per account. `layout()` already marked ring vs noise; the origin is
  // simply the head of the chain, which is also where the closing edge lands.
  const roleById = useMemo(() => {
    const roles = {}
    network.chain.forEach((id, i) => {
      roles[id] = i === 0 ? "hub" : "hop"
    })
    network.noise.forEach((id) => {
      roles[id] = "noise"
    })
    return roles
  }, [network])

  // Which legs the real detectors actually named. When nothing fired there is
  // no flagged path to draw, so we fall back to pointing out the legs that
  // slipped under the configured edge floor.
  const flagged = useMemo(
    () => new Set((verdict?.detectors || []).flatMap((d) => d.transactions || [])),
    [verdict]
  )
  // When nothing fired there is no flagged path, so instead we point out the
  // legs sitting in the detector's blind spots: edges that fall under the
  // configured amount floor, and edges beyond the configured depth limit (the
  // search abandons a path once it reaches `max_cycle_len`, so every later hop
  // is never explored). Both are read from the thresholds already on screen.
  const blindSpot = useMemo(() => {
    const cf = verdict?.thresholds_used?.circular_flow || {}
    const floor = cf.min_edge_amount ?? 100_000
    const maxLen = cf.max_cycle_len ?? 6
    const ids = new Set()
    network.cycle_txns.forEach((t) => {
      const fromIdx = network.chain.indexOf(t.from)
      if (t.amount < floor || fromIdx >= maxLen) ids.add(t.txn_id)
    })
    return ids
  }, [network, verdict])

  const caught = !!verdict?.caught
  const ringStroke = caught ? "url(#rt-edge-grad)" : COLOR_HOP
  const ringArrow = caught ? "url(#rt-arrow-red)" : "url(#rt-arrow-blue)"

  // Centre of the ring, used to push transaction chips clear of the captions.
  const centroid = useMemo(() => {
    const ids = network.chain.map((id) => pos[id]).filter(Boolean)
    if (!ids.length) return { x: 0, y: 0 }
    return {
      x: ids.reduce((s, p) => s + p.x, 0) / ids.length,
      y: ids.reduce((s, p) => s + p.y, 0) / ids.length,
    }
  }, [network, pos])

  // Quadratic edge, trimmed back to each node's perimeter so arrowheads stay
  // visible now that nodes are drawn at the app's larger reference radii.
  function edgePath(e) {
    const a = pos[e.from]
    const b = pos[e.to]
    if (!a || !b) return null
    const isCycle = cycleTxnIds.has(e.txn_id)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const trimA = roleRadius(roleById[e.from]) + EDGE_GAP
    const trimB = roleRadius(roleById[e.to]) + EDGE_GAP
    const start = { x: a.x + ux * trimA, y: a.y + uy * trimA }
    const end = { x: b.x - ux * trimB, y: b.y - uy * trimB }
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    // Bow retained from the previous renderer; the ring itself stays on chords.
    const bow = isCycle ? 0 : 26
    const qx = mx + (a.x < b.x ? bow : -bow) * 0.4
    const qy = my + (a.y < b.y ? bow : -bow)
    // Chip is pushed radially outward from the ring's centre, which on a ring
    // is always clear of every node caption (the flagged-path diagram uses the
    // same outward placement, there resolved against the loop centroid).
    const cdx = mx - centroid.x
    const cdy = my - centroid.y
    const cLen = Math.hypot(cdx, cdy) || 1
    const off = 40
    return {
      d: `M ${start.x} ${start.y} Q ${qx} ${qy} ${end.x} ${end.y}`,
      isCycle,
      isReturnLeg: isCycle && e.to === network.chain[0],
      label: { x: mx + (cdx / cLen) * off, y: my + (cdy / cLen) * off },
    }
  }

  return (
    <div
      className="relative w-full rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center"
      style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }}
    >
      <svg
        className="w-full h-full max-h-[420px]"
        fill="none"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Generated ring network"
      >
        <defs>
          {/* Same blue → crimson → blue ramp as the flagged-path diagram. */}
          <linearGradient id="rt-edge-grad" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#dc2626" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3" />
          </linearGradient>
          <radialGradient cx="50%" cy="50%" id="rt-node-glow" r="50%">
            <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0" />
          </radialGradient>
          <filter height="140%" id="rt-drop-glow" width="140%" x="-20%" y="-20%">
            <feDropShadow dx="0" dy="2" floodColor="#0f172a" floodOpacity="0.08" stdDeviation="3" />
          </filter>
          {/* Arrowhead geometry reused verbatim from FlowTimeline. */}
          <marker id="rt-arrow-red" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="3">
            <path d="M0,0 L0,6 L8,3 z" fill="#ba1a1a" />
          </marker>
          <marker id="rt-arrow-blue" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="3">
            <path d="M0,0 L0,6 L8,3 z" fill="#1d4ed8" />
          </marker>
          <marker id="rt-arrow-amber" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="3">
            <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
          </marker>
        </defs>

        {network.edges.map((e) => {
          const p = edgePath(e)
          if (!p) return null
          const slips = blindSpot.has(e.txn_id)
          if (!p.isCycle) {
            return (
              <g key={e.txn_id}>
                <path
                  d={p.d}
                  fill="none"
                  stroke={COLOR_NEUTRAL_EDGE}
                  strokeDasharray="2,5"
                  strokeLinecap="round"
                  strokeOpacity="0.75"
                  strokeWidth="1.4"
                >
                  <title>{`${e.from} → ${e.to} · ${inr(e.amount)} · ${e.channel}`}</title>
                </path>
              </g>
            )
          }
          return (
            <g key={e.txn_id}>
              <path
                d={p.d}
                fill="none"
                markerEnd={slips ? "url(#rt-arrow-amber)" : ringArrow}
                stroke={slips && !caught ? COLOR_NOISE : p.isReturnLeg ? COLOR_RETURN_LEG : ringStroke}
                strokeDasharray={caught ? "6,4" : undefined}
                strokeLinecap="round"
                strokeOpacity={caught ? 0.9 : 0.7}
                strokeWidth={caught ? 3 : 2.4}
              >
                <title>{`${e.from} → ${e.to} · ${inr(e.amount)} · ${e.channel}`}</title>
              </path>
              {/* Travelling flow packet, same animateMotion recipe as FlowTimeline. */}
              <circle fill={caught ? "#dc2626" : "#1d4ed8"} r="3.5">
                <animateMotion
                  dur={`${2.5 + (network.cycle_txns.indexOf(e) % 3) * 0.6}s`}
                  path={p.d}
                  repeatCount="indefinite"
                />
              </circle>
              {caught && flagged.has(e.txn_id) && (
                <g transform={`translate(${p.label.x}, ${p.label.y})`}>
                  <rect
                    fill="#ffffff"
                    height="18"
                    rx="2"
                    stroke="#c4c5d7"
                    strokeWidth="0.5"
                    width="92"
                    x="-46"
                    y="-9"
                  />
                  <text fill="#93000a" fontFamily="Inter" fontSize="10" fontWeight="700" textAnchor="middle" x="0" y="4">
                    {e.txn_id}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {Object.entries(pos).map(([id, p]) => {
          const role = roleById[id] || "hop"
          const isHub = role === "hub"
          const fill = isHub ? COLOR_HUB : role === "noise" ? COLOR_NOISE : COLOR_HOP
          const r = roleRadius(role)
          // The origin is marked by its crimson core, pulse halo and the legend
          // rather than a "(HUB)" suffix: at 12 hops the ring spacing is ~60px
          // and a suffixed caption overruns its neighbours.
          const label = id
          const note = role === "noise" ? "DILUTION" : isHub ? "ORIGIN" : "RING HOP"
          return (
            <g key={id} transform={`translate(${p.x}, ${p.y})`}>
              {isHub && <circle className="animate-pulse" fill="#ffdad6" opacity="0.5" r="42" />}
              {isHub && <circle className="animate-pulse" fill="url(#rt-node-glow)" r="30" />}
              <circle fill="#ffffff" filter="url(#rt-drop-glow)" r={r} />
              <circle fill={isHub ? "#ffdad6" : role === "noise" ? "#fef3c7" : "#f2f4f6"} r={r - 5} />
              <circle fill={fill} r={isHub ? 10 : role === "noise" ? 4 : 6}>
                <animate attributeName="r" from="0" to={isHub ? 10 : role === "noise" ? 4 : 6} dur="0.4s" fill="freeze" />
              </circle>
              <text
                className={role === "noise" ? "text-[9px]" : "font-semibold text-[11px]"}
                fill="#191c1e"
                textAnchor="middle"
                y={isHub ? 48 : 42}
              >
                {label}
              </text>
              {/* Dilution nodes get a single line: they sit on a tight arc, so a
                  second caption line collides with neighbouring ids. The legend
                  below already identifies them. */}
              {role !== "noise" && (
                <text className="text-[9px]" fill="#565e74" textAnchor="middle" y={isHub ? 61 : 54}>
                  {note}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="absolute left-space-sm bottom-space-sm flex flex-col gap-1 font-label-caps text-label-caps text-on-surface-variant bg-surface-container-lowest/85 backdrop-blur-sm rounded px-space-xs py-1">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: COLOR_HUB }}
          />
          Origin / hub
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: COLOR_HOP }}
          />
          Ring hop
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: COLOR_NOISE }}
          />
          Dilution ({network.noise.length})
        </span>
        {!caught && blindSpot.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5" style={{ background: COLOR_NOISE }} />
            In a detector blind spot ({blindSpot.size})
          </span>
        )}
      </div>
      <div className="absolute right-space-sm bottom-space-sm text-right">
        <div className="font-numeric-md text-numeric-md font-semibold text-on-surface">{formatINR(total)}</div>
        <div className="font-label-caps text-label-caps text-on-surface-variant">cycled total</div>
      </div>
    </div>
  )
}

function Control({ control, value, onChange, disabled }) {
  const shown = control.format ? control.format(value) : `${value} ${control.unit}`.trim()
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex justify-between items-center gap-space-sm">
        <label className="flex items-center gap-space-xs font-label-sm text-label-sm font-semibold text-on-surface">
          <MaterialIcon name={control.icon} className="text-[16px] text-on-surface-variant" />
          {control.label}
        </label>
        <span className="font-numeric-md text-numeric-md font-semibold text-primary tabular-nums">{shown}</span>
      </div>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(control.key, parseFloat(e.target.value))}
        className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary-container disabled:opacity-50"
      />
      <div className="flex justify-between text-outline font-label-caps text-label-caps">
        <span>{control.min}</span>
        <span>{control.max}</span>
      </div>
      <p className="text-[12px] leading-snug text-on-surface-variant">{control.help}</p>
    </div>
  )
}

const STATUS_TONE = {
  fired: "errorContainer",
  clear: "success",
  not_applicable: "neutralVariant",
}

function AdminRedTeam() {
  const [config, setConfig] = useState(null)
  const [controls, setControls] = useState({
    hop_count: 3,
    time_spread_hours: 6,
    amount_variance: 0.05,
    dilution: 0,
  })
  const [preset, setPreset] = useState("low")
  const [advanced, setAdvanced] = useState(false)
  const [result, setResult] = useState(null)
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const [cfg, state] = await Promise.all([api.redTeamConfig(), api.redTeamState()])
      setConfig(cfg)
      setLog(state.log || [])
      if (state.current && !result) setResult(state.current)
    } catch (e) {
      setError(e.message || "Could not load Red Team configuration.")
    }
  }, [result])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cf = config?.thresholds?.circular_flow?.thresholds

  function applyPreset(id) {
    setPreset(id)
    const p = config?.presets?.[id]
    if (p) setControls({ ...p })
  }

  function setControl(key, value) {
    setControls((c) => ({ ...c, [key]: value }))
    setPreset("custom")
  }

  async function launch() {
    setBusy(true)
    setError("")
    try {
      const r = await api.redTeamSimulate({ ...controls, preset })
      setResult(r)
      setLog((l) => [r, ...l.filter((x) => x.id !== r.id)].slice(0, 25))
      notify({
        title: r.caught ? "Evasion attempt caught" : "Evasion attempt slipped through",
        body: r.caught
          ? `${r.detector_patterns.join(", ")} fired on ${r.id}`
          : `${r.id} beat every applicable threshold`,
        tone: r.caught ? "error" : "success",
      })
    } catch (e) {
      setError(e.message || "Simulation failed.")
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    await api.redTeamClear().catch(() => {})
    setResult(null)
    setLog([])
  }

  const v = result?.verdict

  return (
    <div className="flex flex-col gap-space-md">
      <header className="flex flex-col gap-space-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-space-xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Red Team</h1>
          <p className="text-body-md text-on-surface-variant max-w-2xl">
            Build a synthetic laundering network, then run it through the same detectors the
            live system uses — with the thresholds currently on the Detection Rules page.
          </p>
        </div>
        <Badge tone="primaryContainer" className="shrink-0 self-start sm:self-auto">
          <MaterialIcon name="science" className="text-[14px]" />
          Isolated sandbox
        </Badge>
      </header>

      <Card className="p-space-md border-l-4 border-l-primary-container">
        <div className="flex items-start gap-space-sm">
          <MaterialIcon name="info" className="text-[18px] text-primary mt-0.5 shrink-0" />
          <p className="text-[12px] leading-relaxed text-on-surface-variant">
            Nothing here touches production data. Networks are generated in a throwaway
            in-memory sandbox, run against <code className="font-mono text-[12px]">detection.py</code>,
            then discarded. Sandbox accounts are namespaced <code className="font-mono text-[12px]">RT-####</code>{" "}
            so they can never appear on Overview, Alerts, Network Explorer or Flow Timeline.
            Outcomes are reported exactly as the detectors return them — nothing is assumed.
          </p>
        </div>
      </Card>

      {error && (
        <Card className="p-space-md bg-error-container">
          <p className="text-body-md text-on-error-container">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-[minmax(320px,380px)_1fr]">
        {/* ── controls ── */}
        <Card className="p-space-md flex flex-col gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Attack parameters</h2>
            <p className="text-[12px] text-on-surface-variant">How the adversary shapes the network.</p>
          </div>

          <div className="grid grid-cols-2 gap-space-2xs" role="group" aria-label="Sophistication preset">
            {PRESETS.map((p) => {
              const active = preset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!config}
                  aria-pressed={active}
                  onClick={() => applyPreset(p.id)}
                  className={`${BTN_OPTION} ${
                    active
                      ? "border-primary bg-primary-container text-on-primary-container"
                      : "border-outline bg-surface-container-lowest text-on-surface-variant hover:border-primary hover:bg-surface-container"
                  }`}
                >
                  <span className="font-label-sm text-label-sm font-semibold">{p.label}</span>
                  <span className="text-[12px] leading-tight opacity-80">{p.hint}</span>
                </button>
              )
            })}
          </div>

          <div className="h-px bg-outline-variant" />

          <div className="flex flex-col gap-space-md">
            {CONTROLS.map((c) => (
              <Control
                key={c.key}
                control={c}
                value={controls[c.key]}
                onChange={setControl}
                disabled={!config}
              />
            ))}
          </div>

          <div className="h-px bg-outline-variant" />

          <div className="flex flex-col gap-space-2xs">
            <div className="flex justify-between items-center">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                Advanced mode
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={advanced}
                aria-label="Toggle advanced mode"
                onClick={() => setAdvanced((a) => !a)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  advanced ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    advanced ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="text-[12px] leading-snug text-on-surface-variant">
              {advanced
                ? "Each parameter is independently adjustable above; results are attributed to the specific lever that changed the outcome."
                : "Preset bundles the four parameters into a single archetype. Toggle to tune them individually and attribute the outcome to a specific lever."}
            </p>
          </div>

          <div className="flex flex-col gap-space-2xs">
            <button
              type="button"
              onClick={launch}
              disabled={busy || !config}
              className={`${BTN_PRIMARY} font-headline-sm text-headline-sm`}
            >
              <MaterialIcon name={busy ? "hourglass_top" : "crisis_alert"} className="text-[18px]" />
              {busy ? "Launching…" : "Launch evasion attempt"}
            </button>
            {result && (
              <button
                type="button"
                onClick={clearAll}
                className={BTN_SECONDARY}
              >
                <MaterialIcon name="delete_sweep" className="text-[16px]" />
                Clear sandbox
              </button>
            )}
          </div>
        </Card>

        {/* ── results ── */}
        <div className="flex flex-col gap-space-md min-w-0">
          {!result && (
            <Card className="p-space-lg flex flex-col items-center justify-center text-center gap-space-sm min-h-[320px]">
              <MaterialIcon name="travel_explore" className="text-[44px] text-outline" />
              <p className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                No attempt yet
              </p>
              <p className="text-body-md text-on-surface-variant max-w-sm">
                Pick a sophistication preset and launch an attempt to see whether the live
                thresholds catch it.
              </p>
            </Card>
          )}

          {result && v && (
            <>
              <Card
                className={`p-space-md border-l-4 ${
                  v.caught ? "border-l-error bg-error-container/30" : "border-l-success bg-emerald-50/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-space-sm">
                  <div className="flex items-start gap-space-sm">
                    <MaterialIcon
                      name={v.caught ? "gpp_maybe" : "gpp_bad"}
                      className={`text-[28px] shrink-0 ${v.caught ? "text-error" : "text-emerald-700"}`}
                    />
                    <div className="flex flex-col gap-0.5">
                      <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
                        {v.caught ? "Detected" : "Evaded"}
                      </h2>
                      <p className="text-body-md text-on-surface-variant">
                        {v.caught
                          ? `${v.detectors.length} detector${v.detectors.length === 1 ? "" : "s"} fired against this network.`
                          : "No applicable detector fired on this network."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={v.caught ? "errorContainer" : "success"} dot={v.caught ? "bg-error" : "bg-emerald-600"}>
                      {v.caught ? "CAUGHT" : "EVADED"}
                    </Badge>
                    <span className="font-numeric-sm text-numeric-sm text-on-surface-variant">
                      {result.id} · risk +{v.risk_score}
                    </span>
                  </div>
                </div>

                {v.detectors.length > 0 && (
                  <ul className="mt-space-sm flex flex-col gap-space-2xs">
                    {v.detectors.map((d, i) => (
                      <li
                        key={`${d.pattern}-${i}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest px-space-sm py-space-xs"
                      >
                        <Badge tone="errorContainer">{d.pattern}</Badge>
                        <span className="font-numeric-sm text-numeric-sm font-semibold text-on-surface">
                          +{d.risk}
                        </span>
                        <span className="text-[12px] text-on-surface-variant flex-1 min-w-[200px]">
                          {d.evidence}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
                <Card className="p-space-md flex flex-col gap-space-sm min-w-0">
                  <div className="flex items-center justify-between gap-space-sm">
                    <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                      Generated network
                    </h3>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {result.network.accounts.length} accounts · {result.network.edges.length} edges
                    </span>
                  </div>
                  <RingGraph network={result.network} verdict={v} />
                </Card>

                <div className="flex flex-col gap-space-md min-w-0">
                  <Card className="p-space-md flex flex-col gap-space-sm">
                    <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                      Verdict breakdown
                    </h3>

                    {v.evasion_reasons.length > 0 ? (
                      <div className="flex flex-col gap-space-2xs">
                        <p className="font-label-caps text-label-caps text-on-surface-variant">
                          Slipped past
                        </p>
                        {v.evasion_reasons.map((r) => (
                          <div
                            key={r.control}
                            className="rounded-lg border border-error/30 bg-error-container/40 px-space-sm py-space-xs"
                          >
                            <p className="font-label-sm text-label-sm font-semibold text-on-error-container">
                              {r.control}
                            </p>
                            <p className="text-[12px] leading-snug text-on-surface-variant mt-0.5">
                              {r.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-success/30 bg-emerald-50 px-space-sm py-space-xs">
                        <p className="font-label-sm text-label-sm font-semibold text-emerald-900">
                          Every applicable threshold held
                        </p>
                        <p className="text-[12px] leading-snug text-on-surface-variant mt-0.5">
                          The ring stayed inside the {cf?.window_hours}h window, under the{" "}
                          {cf?.max_cycle_len}-hop limit, and above the {inr(cf?.min_edge_amount)} edge
                          floor.
                        </p>
                      </div>
                    )}

                    {v.non_evasive_controls.length > 0 && (
                      <details className="rounded-lg border border-outline-variant px-space-sm py-space-xs">
                        <summary className="cursor-pointer font-label-sm text-label-sm font-semibold text-on-surface">
                          Controls that did not change the outcome
                        </summary>
                        <div className="flex flex-col gap-2 mt-2">
                          {v.non_evasive_controls.map((c) => (
                            <div key={c.control}>
                              <p className="font-label-sm text-label-sm font-semibold text-on-surface-variant">
                                {c.control}
                              </p>
                              <p className="text-[12px] leading-snug text-on-surface-variant">
                                {c.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </Card>

                  <Card className="p-space-md flex flex-col gap-space-sm">
                    <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                      Detector coverage
                    </h3>
                    <div className="flex flex-col gap-space-2xs">
                      {v.detector_report.map((d) => (
                        <div
                          key={d.pattern}
                          className="flex flex-col gap-0.5 rounded-lg bg-surface-container-low px-space-sm py-space-xs"
                        >
                          <div className="flex items-center justify-between gap-space-sm">
                            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                              {d.pattern}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-numeric-sm text-numeric-sm text-on-surface-variant">
                                weight {d.weight}
                              </span>
                              <Badge tone={STATUS_TONE[d.status]}>
                                {d.status === "not_applicable" ? "N/A" : d.status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-[12px] leading-snug text-on-surface-variant">{d.note}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {log.length > 0 && (
            <Card className="p-space-md flex flex-col gap-space-sm">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Session log
                <span className="ml-2 font-label-caps text-label-caps text-on-surface-variant">
                  in-memory only · {log.length} attempt{log.length === 1 ? "" : "s"}
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      {["Run", "Level", "Hops", "Span", "Min edge", "Result", "Detector"].map((h) => (
                        <th
                          key={h}
                          className="px-space-xs py-space-xs font-label-caps text-label-caps text-on-surface-variant font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((r) => (
                      <tr key={r.id} className="border-b border-outline-variant/50 last:border-0">
                        <td className="px-space-xs py-space-xs font-mono text-[12px] text-on-surface whitespace-nowrap">
                          {r.id}
                        </td>
                        <td className="px-space-xs py-space-xs font-label-caps text-label-caps text-on-surface uppercase">
                          {r.level}
                        </td>
                        <td className="px-space-xs py-space-xs font-numeric-sm text-numeric-sm tabular-nums">
                          {r.params.hop_count}
                        </td>
                        <td className="px-space-xs py-space-xs font-numeric-sm text-numeric-sm tabular-nums whitespace-nowrap">
                          {r.span_hours}h
                        </td>
                        <td className="px-space-xs py-space-xs font-numeric-sm text-numeric-sm tabular-nums whitespace-nowrap">
                          {inr(r.min_cycle_amount)}
                        </td>
                        <td className="px-space-xs py-space-xs">
                          <Badge tone={r.caught ? "errorContainer" : "success"}>
                            {r.caught ? "CAUGHT" : "EVADED"}
                          </Badge>
                        </td>
                        <td className="px-space-xs py-space-xs text-[12px] text-on-surface-variant">
                          {r.detector_patterns.length ? r.detector_patterns.join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {config && (
            <Card className="p-space-md flex flex-col gap-space-2xs">
              <div className="flex items-center gap-space-xs">
                <MaterialIcon name="rule" className="text-[18px] text-primary" />
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  Thresholds in force
                </h3>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Read live from the Detection Rules table. Change them there and this simulator
                uses the new values immediately.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-space-2xs mt-1">
                {Object.entries(config.thresholds).map(([pattern, t]) => (
                  <div
                    key={pattern}
                    className="rounded-lg bg-surface-container-low px-space-sm py-space-xs flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                        {pattern}
                      </span>
                      <span className="font-numeric-sm text-numeric-sm text-on-surface-variant">
                        w{t.weight}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {Object.entries(t.thresholds).map(([k, val]) => (
                        <li
                          key={k}
                          className="flex justify-between gap-2 text-[12px] text-on-surface-variant"
                        >
                          <span>{k.replace(/_/g, " ")}</span>
                          <span className="font-numeric-sm tabular-nums text-on-surface">
                            {typeof val === "number" ? val.toLocaleString("en-IN") : String(val)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminRedTeam
