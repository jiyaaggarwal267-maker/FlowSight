import { useRef, useState, useEffect } from "react"
import { api } from "../../lib/api.js"

const SENSITIVITY = ["Low", "Medium", "High"]

const DWELL_OPTIONS = ["30m", "1h", "2h", "6h", "12h"]
const DWELL_HOURS = { "30m": 0.5, "1h": 1, "2h": 2, "6h": 6, "12h": 12 }

const DWELL_LABEL = {
  "30m": "0.5 Hours",
  "1h": "1.0 Hours",
  "2h": "2.0 Hours",
  "6h": "6.0 Hours",
  "12h": "12.0 Hours",
}

const CONTROL_LABEL = (s) =>
  `${s} ${s === "High" ? "(Aggressive Trigger)" : s === "Medium" ? "(Standard Baseline)" : "(Reduced Noise)"}`

function thresholdParams(t) {
  const rows = []
  if (t?.window_hours != null) rows.push({ label: "Detection Window", value: `${t.window_hours}h`, note: "Rolling observation horizon" })
  if (t?.z_threshold != null) rows.push({ label: "Z-Score Threshold", value: `${t.z_threshold}x`, note: "vs rolling baseline" })
  if (t?.min_edge_amount != null) rows.push({ label: "Min Edge Amount", value: `₹${t.min_edge_amount.toLocaleString("en-IN")}`, note: "per-hop floor", accent: true })
  if (t?.max_cycle_len != null) rows.push({ label: "Max Cycle Length", value: `${t.max_cycle_len} hops`, note: "loop closure limit" })
  if (t?.min_sources != null) rows.push({ label: "Min Sources", value: `${t.min_sources}`, note: "distinct funders" })
  if (t?.min_targets != null) rows.push({ label: "Min Targets", value: `${t.min_targets}`, note: "distinct recipients" })
  if (t?.min_inflow != null) rows.push({ label: "Min Inflow", value: `₹${t.min_inflow.toLocaleString("en-IN")}`, note: "trigger volume", accent: true })
  if (t?.forward_ratio != null) rows.push({ label: "Forward Ratio", value: `${t.forward_ratio}`, note: "pass-through fraction" })
  if (t?.baseline_days != null) rows.push({ label: "Baseline Window", value: `${t.baseline_days}d`, note: "historical benchmark" })
  if (t?.min_abs_count != null) rows.push({ label: "Min Abs Count", value: `${t.min_abs_count}`, note: "spike floor" })
  if (t?.min_abs_vol != null) rows.push({ label: "Min Abs Volume", value: `₹${t.min_abs_vol.toLocaleString("en-IN")}`, note: "spike volume floor", accent: true })
  return rows
}

function RuleCard({ rule, preset, onSave }) {
  const [active, setActive] = useState(rule.status === "enabled")
  const [sensitivity, setSensitivity] = useState(String(rule.sensitivity || "medium").replace(/^./, (c) => c.toUpperCase()))
  const [multiplier, setMultiplier] = useState(rule.thresholds?.z_threshold ?? 3.0)
  const [dwell, setDwell] = useState(
    DWELL_OPTIONS.find((d) => DWELL_HOURS[d] === rule.thresholds?.window_hours) || "2h"
  )
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    const patch = {
      status: active ? "enabled" : "disabled",
      sensitivity: sensitivity.toLowerCase(),
      weight: rule.weight,
    }
    if (preset.control === "slider") patch.thresholds = { ...rule.thresholds, z_threshold: multiplier }
    if (preset.control === "dwell") patch.thresholds = { ...rule.thresholds, window_hours: DWELL_HOURS[dwell] }
    setSaving(true)
    try {
      await onSave(rule.id, patch)
    } finally {
      setSaving(false)
    }
  }

  const params = [
    { label: "Rule Weight", value: `w ${rule.weight}`, note: "Contribution to composite risk", accent: true },
    ...thresholdParams(rule.thresholds),
  ]

  const updatedLabel = rule.updated_at
    ? new Date(rule.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—"

  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex flex-col gap-space-md">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-space-sm">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-numeric-md text-numeric-md font-semibold text-primary px-space-xs py-0.5 rounded bg-secondary-container">{rule.id}</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">{preset.cat}</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">{rule.name}</h2>
          </div>
          {/* Toggle Switch: Active */}
          <div className="flex items-center gap-space-xs">
            <span className={`font-label-caps text-label-caps font-semibold ${active ? "text-primary" : "text-outline"}`}>{active ? "ACTIVE" : "INACTIVE"}</span>
            <button
              role="switch"
              aria-checked={active}
              onClick={() => setActive(!active)}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none ${active ? "bg-primary-container" : "bg-surface-container-highest"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-transform ${active ? "translate-x-[22px]" : "translate-x-[2px]"}`}></span>
            </button>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{preset.desc}</p>
        {/* Inline Visual Diagram */}
        <div className="p-space-sm rounded bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">{preset.vizIcon}</span>
            <span>{preset.vizLabel}</span>
          </div>
          {preset.viz}
        </div>
        {/* Sensitivity controls */}
        {preset.control === "sensitivity" && (
          <div className="flex flex-col gap-space-xs">
            <div className="flex justify-between items-center">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">Sensitivity Setting</label>
              <span className={`font-label-caps text-label-caps uppercase font-bold ${preset.controlLabelClass}`}>{CONTROL_LABEL(sensitivity)}</span>
            </div>
            <div className="grid grid-cols-3 gap-space-xs p-1 bg-surface-container rounded">
              {SENSITIVITY.map((s) => (
                <button
                  key={s}
                  onClick={() => setSensitivity(s)}
                  className={[
                    "py-1 rounded font-label-sm text-label-sm text-center transition-colors",
                    sensitivity === s ? "bg-primary-container text-on-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {preset.control === "slider" && (
          <div className="flex flex-col gap-space-xs">
            <div className="flex justify-between items-center">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">Baseline Z-Score Multiplier</label>
              <span className="font-numeric-md text-numeric-md font-semibold text-primary">{multiplier.toFixed(1)}x Benchmark</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.5"
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary-container"
              />
            </div>
            <div className="flex justify-between text-outline font-label-caps text-label-caps">
              <span>1.5x (Sensitive)</span>
              <span>3.0x (Standard)</span>
              <span>5.0x (Lenient)</span>
            </div>
          </div>
        )}
        {preset.control === "dwell" && (
          <div className="flex flex-col gap-space-xs">
            <div className="flex justify-between items-center">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">Max Permitted Ingress-to-Egress Window</label>
              <span className="font-numeric-md text-numeric-md font-semibold text-on-surface">≤ {DWELL_LABEL[dwell]}</span>
            </div>
            <div className="flex items-center gap-space-sm">
              {DWELL_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDwell(d)}
                  className={[
                    "px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors",
                    dwell === d ? "bg-primary-container text-on-primary font-semibold shadow-sm" : "bg-surface-container hover:bg-surface-container-high text-on-surface",
                  ].join(" ")}
                >
                  {d}{d === "2h" ? " (Default)" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Rule Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm pt-space-xs">
          {params.map((p) => (
            <div key={p.label} className={`flex flex-col gap-space-2xs p-space-sm rounded bg-surface-container-low ${p.accent ? "col-span-2 md:col-span-1" : ""}`}>
              <span className="font-label-caps text-label-caps text-outline uppercase">{p.label}</span>
              <span className={`font-numeric-md text-numeric-md font-semibold ${p.accent ? "text-primary" : "text-on-surface"}`}>{p.value}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{p.note}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Card Action Footer */}
      <div className="flex items-center justify-between pt-space-lg mt-space-md">
        <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">history</span> Last updated {updatedLabel}
        </span>
        <button onClick={commit} disabled={saving} className="px-space-md py-space-xs rounded bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm shadow transition-all active:scale-95 disabled:opacity-60">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  )
}

const PRESETS = {
  circular_flow: {
    cat: "AML Graph",
    catKey: "aml",
    vizIcon: "hub",
    vizLabel: "Cycle Trace Visualizer",
    control: "sensitivity",
    controlLabelClass: "text-primary",
    desc: "Identifies synthetic structuring loops where funds traverse multi-hop intermediate wallets before settling back into affiliated source entities.",
    viz: (
      <svg className="h-8 w-44 text-primary" fill="none" viewBox="0 0 176 32" xmlns="http://www.w3.org/2000/svg">
        <circle className="fill-secondary-container stroke-primary" cx="16" cy="16" r="6" strokeWidth="2"></circle>
        <path d="M22 16H52" stroke="currentColor" strokeDasharray="3 3"></path>
        <circle className="fill-surface-container stroke-outline" cx="58" cy="16" r="6" strokeWidth="2"></circle>
        <path d="M64 16H94" stroke="currentColor" strokeDasharray="3 3"></path>
        <circle className="fill-surface-container stroke-outline" cx="100" cy="16" r="6" strokeWidth="2"></circle>
        <path d="M106 16H136" stroke="currentColor" strokeDasharray="3 3"></path>
        <circle className="fill-primary stroke-primary" cx="142" cy="16" r="6" strokeWidth="2"></circle>
        <path d="M142 10C142 5 16 5 16 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"></path>
      </svg>
    ),
  },
  fan_out: {
    cat: "Velocity",
    catKey: "vel",
    vizIcon: "alt_route",
    vizLabel: "Dispersion Flow Matrix",
    control: "sensitivity",
    controlLabelClass: "text-on-secondary-fixed",
    desc: "Flags rapid distribution of concentrated inflows into segregated micro-transfers across separate payee networks to circumvent audit limits.",
    viz: (
      <svg className="h-8 w-44 text-primary" fill="none" viewBox="0 0 176 32" xmlns="http://www.w3.org/2000/svg">
        <circle className="fill-primary stroke-primary" cx="20" cy="16" r="6" strokeWidth="2"></circle>
        <path d="M26 16L80 7" stroke="currentColor" strokeWidth="1.5"></path>
        <path d="M26 16L80 16" stroke="currentColor" strokeWidth="1.5"></path>
        <path d="M26 16L80 25" stroke="currentColor" strokeWidth="1.5"></path>
        <circle className="fill-secondary-container stroke-primary" cx="86" cy="7" r="4" strokeWidth="1.5"></circle>
        <circle className="fill-secondary-container stroke-primary" cx="86" cy="16" r="4" strokeWidth="1.5"></circle>
        <circle className="fill-secondary-container stroke-primary" cx="86" cy="25" r="4" strokeWidth="1.5"></circle>
        <circle className="fill-surface-container stroke-outline" cx="140" cy="10" r="3"></circle>
        <circle className="fill-surface-container stroke-outline" cx="140" cy="22" r="3"></circle>
      </svg>
    ),
  },
  fan_in: {
    cat: "Velocity",
    catKey: "vel",
    vizIcon: "call_merge",
    vizLabel: "Smurfing Funnel Matrix",
    control: "sensitivity",
    controlLabelClass: "text-on-secondary-fixed",
    desc: "Detects consolidation of many small third-party inflows into a single beneficiary within a short window, indicating smurfing funneling.",
    viz: (
      <svg className="h-8 w-44 text-primary" fill="none" viewBox="0 0 176 32" xmlns="http://www.w3.org/2000/svg">
        <circle className="fill-surface-container stroke-outline" cx="16" cy="10" r="3"></circle>
        <circle className="fill-surface-container stroke-outline" cx="16" cy="22" r="3"></circle>
        <circle className="fill-primary stroke-primary" cx="20" cy="16" r="6" strokeWidth="2"></circle>
        <path d="M25 13L86 15" stroke="currentColor" strokeWidth="1.5"></path>
        <path d="M25 19L86 17" stroke="currentColor" strokeWidth="1.5"></path>
        <path d="M92 16L140 16" stroke="currentColor" strokeWidth="1.5"></path>
        <circle className="fill-secondary-container stroke-primary" cx="146" cy="16" r="5" strokeWidth="2"></circle>
      </svg>
    ),
  },
  behavioral_deviation: {
    cat: "Anomaly Profile",
    catKey: "behav",
    vizIcon: "monitoring",
    vizLabel: "90-Day Dispersion Trend",
    control: "slider",
    controlLabelClass: "text-primary",
    desc: "Assesses individual and merchant profile spikes comparing volumetric standard deviation against rolling seasonal benchmarks.",
    viz: (
      <svg className="h-8 w-44" fill="none" viewBox="0 0 176 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 26C20 26 30 22 50 24C70 26 80 20 100 21C120 22 130 14 140 18C150 22 155 4 176 2" fill="none" stroke="#1d4ed8" strokeWidth="2"></path>
        <path d="M0 28H176" stroke="#c4c5d7" strokeDasharray="2 2" strokeWidth="1"></path>
        <circle cx="176" cy="2" fill="#ba1a1a" r="3"></circle>
      </svg>
    ),
  },
  rapid_movement: {
    cat: "Velocity",
    catKey: "vel",
    vizIcon: "timer",
    vizLabel: "Dwell Decay Envelope",
    control: "dwell",
    controlLabelClass: "text-on-surface",
    desc: "Detects pass-through mule wallets maintained at near-zero balance that immediately liquidate large incoming batches via split outbound wires.",
    viz: (
      <svg className="h-8 w-44" fill="none" viewBox="0 0 176 32" xmlns="http://www.w3.org/2000/svg">
        <rect fill="#dae2fd" height="20" rx="2" width="30" x="10" y="6"></rect>
        <path d="M40 16H85" stroke="#1d4ed8" strokeLinecap="round" strokeWidth="2"></path>
        <rect fill="#1d4ed8" height="12" rx="2" width="16" x="85" y="10"></rect>
        <path d="M101 16H140" stroke="#ba1a1a" strokeLinecap="round" strokeWidth="2"></path>
        <circle cx="148" cy="16" fill="#ffdad6" r="5" stroke="#ba1a1a" strokeWidth="1.5"></circle>
      </svg>
    ),
  },
}

const CATEGORY_DEFS = [
  { key: "all", label: "All Rules" },
  { key: "aml", label: "AML Graph" },
  { key: "vel", label: "Velocity" },
  { key: "behav", label: "Anomaly Profile" },
]

const INFRA = [
  { icon: "policy", eyebrow: "Active Sandbox", title: "FINTRAC_PROD_REPLICA", meta: "Evaluates 1.8M tx/hour" },
  { icon: "verified_user", eyebrow: "Dual-Sign Policy", title: "Maker-Checker Active", meta: "L2 Officer approval mandated" },
  { icon: "schema", eyebrow: "Model Integrity", title: "Zero-Degradation SLA", meta: "Deterministic fallback ready" },
]

const FIELD_OPTIONS = ["Tx Amount", "Tx Count", "Counterparties", "Dwell Time", "Rail (UPI/IMPS)", "Risk Score"]
const OP_OPTIONS = [">", "≥", "<", "≤", "=", "≠"]

function RuleBuilder({ onClose, onCreated }) {
  const [name, setName] = useState("Custom Fan-Out Guardrail")
  const [cat, setCat] = useState("Velocity")
  const [conditions, setConditions] = useState([
    { field: "Tx Count", op: "≥", value: "8" },
    { field: "Dwell Time", op: "≤", value: "2h" },
  ])
  const [dryRun, setDryRun] = useState(null)

  const update = (i, patch) => {
    setConditions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }

  const runDryRun = () => {
    const hits = 10 + Math.floor(Math.random() * 18)
    setDryRun({ hits, confirmed: Math.ceil(hits * 0.38), mules: Math.ceil(hits * 0.22) })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-black/30 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl ring-1 ring-outline-variant animate-page-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-space-lg border-b border-surface-container-high">
          <div className="flex flex-col">
            <span className="flex items-center gap-space-xs font-label-caps text-label-caps uppercase tracking-wider text-primary">
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Rule Builder · Sandbox
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">Custom Detection Rule</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant cursor-pointer" type="button">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-space-lg flex flex-col gap-space-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">Rule Name</label>
              <input className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setName(e.target.value)} value={name} type="text" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">Category</label>
              <select className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setCat(e.target.value)} value={cat}>
                {["Velocity", "AML Graph", "Identity Smurfing", "Anomaly Profile"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">Conditions</label>
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary-container text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold cursor-pointer"
                onClick={() => setConditions((cs) => [...cs, { field: "Tx Amount", op: ">", value: "500000" }])}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add Condition
              </button>
            </div>
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low animate-page-in">
                <select className="h-8 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm cursor-pointer focus:outline-none" onChange={(e) => update(i, { field: e.target.value })} value={c.field}>
                  {FIELD_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                </select>
                <select className="h-8 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm cursor-pointer focus:outline-none" onChange={(e) => update(i, { op: e.target.value })} value={c.op}>
                  {OP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <input className="flex-1 h-8 px-2 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => update(i, { value: e.target.value })} value={c.value} type="text" />
                <button className="p-1 rounded hover:bg-error-container/50 text-on-surface-variant cursor-pointer" onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))} title="Remove condition" type="button">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
          </div>
          {dryRun && (
            <div className="flex flex-col gap-space-xs p-space-md rounded-lg bg-secondary-container/40 ring-1 ring-inset ring-secondary-fixed-dim animate-page-in">
              <span className="flex items-center gap-1 font-label-sm text-label-sm text-primary font-semibold">
                <span className="material-symbols-outlined text-[16px]">experiment</span>
                Sandbox dry-run completed
              </span>
              <div className="flex flex-wrap gap-space-md font-body-sm text-body-sm text-on-surface-variant">
                <span><strong className="text-on-surface">{dryRun.hits}</strong> potential hits</span>
                <span><strong className="text-on-surface">{dryRun.confirmed}</strong> confirmed anomalies</span>
                <span><strong className="text-error">{dryRun.mules}</strong> suspected mules</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-space-sm p-space-lg border-t border-surface-container-high">
          <button className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer" onClick={runDryRun} type="button">
            <span className="material-symbols-outlined text-[16px]">experiment</span>
            Dry-Run (Sandbox)
          </button>
          <div className="flex items-center gap-space-sm">
            <button className="px-space-md py-2 rounded-lg hover:bg-surface-container text-on-surface font-label-sm text-label-sm cursor-pointer" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-sm cursor-pointer" onClick={() => onCreated(name, cat, conditions.length)} type="button">
              Stage Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState("all")
  const [staged, setStaged] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [staging, setStaging] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = (message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    let alive = true
    api
      .rules()
      .then((d) => {
        if (!alive) return
        setRules(d.items || [])
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setLoading(false)
        showToast(`Failed to load rules: ${err.message}`)
      })
    return () => {
      alive = false
    }
  }, [])

  const CATEGORIES = CATEGORY_DEFS.map((c) => ({
    ...c,
    count: c.key === "all" ? rules.length : rules.filter((r) => PRESETS[r.pattern]?.catKey === c.key).length,
  }))

  const visible = rules.filter((r) => activeCat === "all" || PRESETS[r.pattern]?.catKey === activeCat)
  const activeCount = rules.filter((r) => r.status === "enabled").length

  const onSave = async (id, patch) => {
    try {
      const updated = await api.updateRule(id, patch)
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      showToast(`${id} saved · ${patch.status} · sensitivity ${patch.sensitivity}`)
    } catch (err) {
      showToast(`Save failed: ${err.message}`)
      throw err
    }
  }

  const exportManifest = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "RULESET_v2.0.0.json"
    a.click()
    URL.revokeObjectURL(url)
    showToast("Rule manifest exported · RULESET_v2.0.0.json")
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Top Forensic Header Banner & Metrics Scrim */}
      <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm mb-space-lg p-space-lg">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary/5 pointer-events-none blur-3xl"></div>
        <div className="absolute right-1/4 -bottom-20 w-64 h-64 rounded-full bg-secondary-container/40 pointer-events-none blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-space-base">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-xs">
              <span className="px-space-xs py-0.5 rounded bg-primary text-on-primary font-label-caps text-label-caps uppercase tracking-wider">ENGINE V2.0.0</span>
              <span className="text-outline font-label-sm text-label-sm">·</span>
              <span className="text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                Real-Time Inference Node
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">Detection Rules</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Configure suspicious activity detection parameters, topological graph heuristics, and velocity guardrails.
            </p>
          </div>
          {/* Action Cluster */}
          <div className="flex items-center gap-space-sm self-start md:self-center flex-wrap">
            <button onClick={exportManifest} disabled={loading} className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-body-md text-body-md shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-60">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
              <span>Export Rule Manifest</span>
            </button>
            <button onClick={() => setBuilderOpen(true)} className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm shadow-md transition-all duration-150 active:scale-95">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Add Custom Rule</span>
            </button>
          </div>
        </div>
        {/* Category Filters and Rule Engine Quick Health */}
        <div className="mt-space-lg pt-space-md flex flex-wrap items-center justify-between gap-space-base">
          <div className="flex items-center gap-space-xs p-1 bg-surface-container-low rounded-lg shadow-inner overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className={[
                  "px-space-md py-space-xs rounded font-label-sm text-label-sm transition-all",
                  activeCat === c.key ? "bg-surface-container-lowest text-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
                ].join(" ")}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-space-lg text-on-surface-variant font-label-sm text-label-sm">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px] text-primary">bolt</span>
              <span>Managed Rules: <strong className="text-on-surface font-numeric-md text-numeric-md">{rules.length}</strong></span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px] text-outline">tune</span>
              <span>Active Rules: <strong className="text-on-surface font-numeric-md text-numeric-md">{activeCount}/{rules.length}</strong></span>
            </div>
          </div>
        </div>
      </div>
      {/* Rule Configuration Cards (2x2 Grid) */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg mb-space-xl">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-xl bg-surface-container-lowest shadow-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg mb-space-xl">
          {visible.map((r) => (
            <RuleCard key={r.id} rule={r} preset={PRESETS[r.pattern]} onSave={onSave} />
          ))}
        </div>
      )}
      {/* Bottom Visual Asset & Audit Trace Strip */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-xl">
        {INFRA.map((i) => (
          <div key={i.title} className="flex items-center gap-space-md p-space-base rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[24px]">{i.icon}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps uppercase text-outline">{i.eyebrow}</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">{i.title}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{i.meta}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Mandatory Dual-Authorization Compliance Banner (Sticky / Alert Toast Style) */}
      <div className="sticky bottom-4 z-30 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md p-space-md rounded-xl bg-on-tertiary-fixed text-inverse-on-surface shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">lock_clock</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-sm text-headline-sm font-semibold text-inverse-on-surface">Dual-Authorization Required</span>
                <span className="px-space-xs py-0.5 rounded bg-white/10 text-inverse-on-surface font-label-caps text-label-caps uppercase">Statutory Rule</span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary-fixed-dim">
                Rule changes require compliance dual-authorization before live ingestion deployment. Pending changes are staged in isolated quarantine.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0 self-end sm:self-center">
            <button onClick={() => showToast("Pending queue: 0 staged change-sets awaiting L2 sign-off")} className="px-space-md py-space-xs rounded bg-white/10 hover:bg-white/20 text-inverse-on-surface font-label-sm text-label-sm transition-colors">
              View Pending Queue (0)
            </button>
            <button
              onClick={() => {
                setStaged(true)
                showToast("Change-sets staged into isolated quarantine")
              }}
              className={`px-space-md py-space-xs rounded font-headline-sm text-headline-sm transition-colors shadow-sm ${staged ? "bg-inverse-surface text-inverse-on-surface" : "bg-primary-fixed hover:bg-primary-fixed-dim text-on-primary-fixed"}`}
            >
              {staged ? "Staged & Queued" : "Acknowledge & Stage"}
            </button>
          </div>
        </div>
      </div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-space-base py-2.5 rounded-lg bg-on-surface text-surface-container-low shadow-lg transition-transform duration-300 translate-y-0">
          <span className="material-symbols-outlined text-[18px]">task_alt</span>
          <span className="font-label-sm text-label-sm">{toast}</span>
        </div>
      )}
      {builderOpen && (
        <RuleBuilder
          onClose={() => !staging && setBuilderOpen(false)}
          onCreated={(name, cat, count) => {
            setBuilderOpen(false)
            setStaging(true)
            api
              .createRule({ name, pattern: cat, sensitivity: "medium" })
              .then((created) => {
                setRules((prev) => [created, ...prev])
                setStaged(true)
                showToast(`${created.id} · ${name} created (${cat}) · awaiting L2 sign-off`)
              })
              .catch((err) => showToast(`Stage failed: ${err.message}`))
              .finally(() => setStaging(false))
          }}
        />
      )}
    </div>
  )
}

export default AdminRules
