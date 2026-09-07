import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import MaterialIcon from "./MaterialIcon.jsx"

const MINI_NODES = [
  { dot: "bg-emerald-400", title: "SRC-301", sub: "₹4,20,000 · UPI", static: "left-[80px] top-[95px]" },
  { dot: "bg-emerald-400", title: "SRC-884", sub: "₹8,10,450 · IMPS", static: "left-[80px] top-[235px]" },
  { dot: "bg-blue-400", title: "AC-1099 (Kotak)", sub: "₹3,50,000 · Fan-Out", static: "left-[490px] top-[275px]" },
  { dot: "bg-red-500", title: "SYNTHETIC CORP", sub: "Circular Loop Sink", static: "left-[670px] top-[195px]", red: true },
  { icon: "currency_exchange", title: "CRYPTO ON-RAMP", sub: "USDT Gateway Liquidity", static: "right-[30px] top-[115px]" },
  { icon: "apartment", title: "OFFSHORE SINK", sub: "Tax Haven Layer 4", static: "right-[30px] top-[290px]", red: true },
]

function NetworkGraphHero({ tall = false }) {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState("all")
  const [loopFocus, setLoopFocus] = useState(false)

  return (
    <section
      className="w-full flex flex-col gap-6 px-6 bg-surface"
      id="network-explorer-preview"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1 max-w-2xl">
          <span className="font-mono text-xs text-primary font-bold tracking-wider uppercase">SEE IT IN ACTION</span>
          <h2 className="text-2xl sm:text-3xl text-on-surface font-bold">Live Graph Traversal &amp; Mule Cluster Mapping</h2>
          <p className="text-secondary text-sm">
            Trace high-risk flow topologies across 14 layers in real time. Click nodes to inspect transaction velocities, counterparty risk scores, and automatic evidentiary citations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-surface-container-low p-1.5 rounded-lg border border-outline-variant/60">
          {[
            { key: "all", label: "Show All Rails" },
            { key: "UPI", label: "UPI Only" },
            { key: "IMPS", label: "IMPS Only" },
            { key: "5L", label: "&gt; ₹5L Volume" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={
                activeFilter === f.key
                  ? "px-2.5 py-1 text-xs font-semibold rounded bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/40"
                  : "px-2.5 py-1 text-xs font-medium rounded hover:bg-surface-container text-secondary transition-colors cursor-pointer"
              }
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLoopFocus((v) => !v)}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
            Highlight Circular Loops
          </button>
        </div>
      </div>

      <div
        className={`relative w-full ${tall ? "h-[640px]" : "h-[460px]"} bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden select-none`}
      >
        <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="30" id="graph-grid-hero" patternUnits="userSpaceOnUse" width="30">
              <circle cx="2" cy="2" fill="#94a3b8" r="1"></circle>
            </pattern>
          </defs>
          <rect fill="url(#graph-grid-hero)" height="100%" width="100%"></rect>
        </svg>

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 460">
          <defs>
            <marker id="arrow-blue-hero" markerHeight="4" markerWidth="6" orient="auto" refX="5" refY="2">
              <polygon fill="#60a5fa" points="0 0, 6 2, 0 4"></polygon>
            </marker>
            <marker id="arrow-red-main-hero" markerHeight="4" markerWidth="6" orient="auto" refX="5" refY="2">
              <polygon fill="#ef4444" points="0 0, 6 2, 0 4"></polygon>
            </marker>
            <marker id="arrow-amber-hero" markerHeight="4" markerWidth="6" orient="auto" refX="5" refY="2">
              <polygon fill="#f59e0b" points="0 0, 6 2, 0 4"></polygon>
            </marker>
          </defs>
          <path d="M 140 120 Q 230 160 320 200" fill="none" markerEnd="url(#arrow-blue-hero)" stroke="#60a5fa" strokeDasharray="4,4" strokeWidth="1.8"></path>
          <path d="M 140 260 Q 220 230 320 200" fill="none" markerEnd="url(#arrow-blue-hero)" stroke="#60a5fa" strokeDasharray="4,4" strokeWidth="1.8"></path>
          <path className="animate-dash-fast" d="M 320 200 Q 420 100 520 110" fill="none" markerEnd="url(#arrow-red-main-hero)" stroke="#ef4444" strokeWidth="2.2"></path>
          <path className="animate-dash-fast" d="M 320 200 Q 430 200 540 200" fill="none" markerEnd="url(#arrow-red-main-hero)" stroke="#ef4444" strokeWidth="2.2"></path>
          <path className="animate-dash-flow" d="M 320 200 Q 430 280 520 290" fill="none" markerEnd="url(#arrow-amber-hero)" stroke="#f59e0b" strokeWidth="2"></path>
          <path className="animate-dash-fast" d="M 520 110 Q 640 140 700 220" fill="none" stroke="#ef4444" strokeWidth="2"></path>
          <path className="animate-dash-fast" d="M 700 220 Q 600 360 400 320" fill="none" stroke="#ef4444" strokeWidth="2"></path>
          <path className="animate-dash-fast" d="M 400 320 Q 340 290 320 200" fill="none" markerEnd="url(#arrow-red-main-hero)" stroke="#ef4444" strokeWidth="2.5"></path>
          <path d="M 540 200 Q 680 160 820 140" fill="none" markerEnd="url(#arrow-blue-hero)" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5"></path>
          <path d="M 700 220 Q 770 290 840 310" fill="none" markerEnd="url(#arrow-red-main-hero)" stroke="#ef4444" strokeDasharray="3,3" strokeWidth="2"></path>
        </svg>

        {MINI_NODES.map((n) => (
          <div key={n.title} className={`hidden md:block absolute ${n.static} p-2 rounded-lg shadow cursor-pointer hover:border-slate-500 transition-colors ${
            n.red ? "bg-red-950/80 border-red-500 shadow-lg" : n.icon ? (n.title === "OFFSHORE SINK" ? "bg-red-950/90 border-red-700" : "bg-slate-900 border-slate-700") : "bg-slate-800 border-slate-700"
          }`}>
            {n.icon ? (
              <>
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name={n.icon} className={`text-xs ${n.red ? "text-red-400" : "text-slate-400"}`} />
                  <span className={`font-mono text-xs font-semibold ${n.red ? "text-red-200 font-bold" : "text-slate-200 font-semibold"}`}>{n.title}</span>
                </div>
                <p className={`text-[10px] font-mono mt-0.5 ${n.red ? "text-red-400" : "text-slate-500"}`}>{n.sub}</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${n.dot}`}></span>
                  <span className="font-mono text-xs text-white font-semibold">{n.title}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{n.sub}</p>
              </>
            )}
          </div>
        ))}
        <div className="hidden md:block absolute left-[285px] top-[165px] z-20 cursor-pointer" onClick={() => setLoopFocus((v) => !v)}>
          <div className={`absolute -inset-2.5 rounded-xl bg-red-600/30 ${loopFocus ? "" : "animate-pulse"}`}></div>
          <div className="relative px-3.5 py-2.5 bg-red-950 border-2 border-red-500 rounded-xl shadow-2xl text-left ring-2 ring-red-400/40">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-mono text-xs font-bold text-red-200">AC-9214 (HDFC)</span>
              <span className="bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">94/100</span>
            </div>
            <p className="font-mono text-[10px] text-red-300 font-semibold mt-1">₹18,70,450 • Inflow Hub</p>
          </div>
        </div>

        <div className="hidden md:block absolute left-[340px] top-[24px] z-30 w-72 bg-slate-950/95 border border-red-500/80 rounded-xl shadow-2xl p-3.5 backdrop-blur-md text-white transition-all">
          <div className="flex items-start justify-between pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-red-400">SUSPECT NODE: AC-9214</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">HDFC Bank · Fort Branch</p>
            </div>
            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[10px] font-mono font-bold">CRITICAL</span>
          </div>
          <div className="py-2.5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Risk Score:</span>
              <span className="text-red-400 font-bold">94/100 (Structuring)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Inflow:</span>
              <span className="text-white font-semibold">₹18.70 Lakhs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Layering Cadence:</span>
              <span className="text-amber-400">Fan-Out within 180s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Connected Clusters:</span>
              <span className="text-blue-300">14 Layered Nodes / 3 Banks</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex gap-2">
            <Link to="/analyst/network-explorer" className="flex-1 py-1 bg-primary text-white rounded text-[11px] font-medium hover:bg-blue-600 transition-colors text-center cursor-pointer">
              Inspect in Explorer
            </Link>
            <button className="py-1 px-2.5 bg-slate-800 text-slate-200 border border-slate-700 rounded text-[11px] font-medium hover:bg-slate-700 transition-colors cursor-pointer" type="button" onClick={() => navigate("/analyst/reports")}>
              Generate FIU Report
            </button>
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-y-1 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-slate-300">Critical Risk (&gt;90)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-300">Suspicious Relay (50-89)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">Legitimate Origin (&lt;20)</span>
            </span>
          </div>
          <div className="text-slate-400">
            Graph Density: <strong className="text-white">14 Nodes</strong> · Telemetry: <span className="text-emerald-400">14.2ms/hop</span>
          </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        <div className="rounded-xl border border-red-500/80 bg-slate-950/95 p-3.5 text-white">
          <div className="flex items-start justify-between pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-red-400">SUSPECT NODE: AC-9214</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">HDFC Bank · Fort Branch</p>
            </div>
            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[10px] font-mono font-bold">CRITICAL</span>
          </div>
          <div className="py-2.5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Risk Score:</span>
              <span className="text-red-400 font-bold text-right">94/100 (Structuring)</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Total Inflow:</span>
              <span className="text-white font-semibold text-right">₹18.70 Lakhs</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Layering Cadence:</span>
              <span className="text-amber-400 text-right">Fan-Out within 180s</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Connected Clusters:</span>
              <span className="text-blue-300 text-right">14 Layered / 3 Banks</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            <Link to="/analyst/network-explorer" className="flex-1 py-1.5 bg-primary text-white rounded text-[11px] font-medium hover:bg-blue-600 transition-colors text-center cursor-pointer">
              Inspect in Explorer
            </Link>
            <button className="py-1.5 px-2.5 bg-slate-800 text-slate-200 border border-slate-700 rounded text-[11px] font-medium hover:bg-slate-700 transition-colors cursor-pointer" type="button" onClick={() => navigate("/analyst/reports")}>
              Generate FIU Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {MINI_NODES.map((n) => (
            <div key={n.title} className={`rounded-lg p-2 border shadow-sm ${
              n.red ? "bg-red-950/80 border-red-500" : n.icon ? (n.title === "OFFSHORE SINK" ? "bg-red-950/90 border-red-700" : "bg-slate-900 border-slate-700") : "bg-slate-800 border-slate-700"
            }`}>
              {n.icon ? (
                <>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MaterialIcon name={n.icon} className={`text-xs shrink-0 ${n.red ? "text-red-400" : "text-slate-400"}`} />
                    <span className={`font-mono text-[11px] truncate ${n.red ? "text-red-200 font-bold" : "text-slate-200 font-semibold"}`}>{n.title}</span>
                  </div>
                  <p className={`text-[10px] font-mono mt-0.5 truncate ${n.red ? "text-red-400" : "text-slate-500"}`}>{n.sub}</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${n.dot}`}></span>
                    <span className="font-mono text-[11px] truncate text-white font-semibold">{n.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{n.sub}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default NetworkGraphHero