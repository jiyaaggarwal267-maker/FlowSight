import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import SiteNav from "../../components/SiteNav.jsx"
import SiteFooter from "../../components/SiteFooter.jsx"
import NetworkGraphHero from "../../components/NetworkGraphHero.jsx"
import AnimatedNumber from "../../components/AnimatedNumber.jsx"
import { bus, openPalette, formatINR } from "../../lib/runtime.js"

const FEED_INITIAL = [
  { id: 1, tone: "error", text: "INV-042 · Circular flow escalated — routed to FIU L2 queue" },
  { id: 2, tone: "primary", text: "AC-20491 breached 3.1X baseline velocity in 90 minutes" },
  { id: 3, tone: "amber", text: "New mule account AC-66401 · naming-pattern match conf. 0.86" },
  { id: 4, tone: "secondary", text: "Rule RF-14 dry-run complete · 14 hits · 3 confirmed mules" },
  { id: 5, tone: "primary", text: "Crypto off-ramp AC-99032 checkpoint cleared at 11:30 IST" },
]

const FEED_TONE = {
  error: { dot: "bg-error", border: "border-l-error" },
  primary: { dot: "bg-primary", border: "border-l-primary" },
  amber: { dot: "bg-amber-500", border: "border-l-amber-500" },
  secondary: { dot: "bg-secondary", border: "border-l-secondary" },
}

function Landing() {
  const navigate = useNavigate()
  const [feed, setFeed] = useState(FEED_INITIAL)

  useEffect(() => {
    let n = FEED_INITIAL.length
    const unsub = bus.on("notify", (item) => {
      n += 1
      setFeed((f) => [{ id: n, tone: item.tone === "error" ? "error" : "primary", text: item.title }, ...f].slice(0, 6))
    })
    const t = setInterval(() => {
      n += 1
      setFeed((f) => [
        { id: n, tone: "primary", text: `Telemetry heartbeat · ${new Date().toLocaleTimeString("en-IN")} IST snapshot` },
        ...f,
      ].slice(0, 6))
    }, 32000)
    return () => {
      unsub()
      clearInterval(t)
    }
  }, [])

  const scrollToDemo = () => {
    document.getElementById("signin-box")?.scrollIntoView({ behavior: "smooth" })
  }

  const handleLogin = (e) => {
    e.preventDefault()
    navigate("/analyst/overview")
  }

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-surface text-on-surface antialiased font-sans">
      <SiteNav />

      {/* HERO SECTION & FORENSIC SCANNER TERMINAL */}
      <section className="relative w-full overflow-hidden pt-10 pb-14 px-6 bg-gradient-to-b from-surface via-surface to-surface-container-low border-b border-surface-container-high">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none"></div>
        <div className="absolute top-8 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 right-1/4 w-72 h-56 bg-secondary-container/40 rounded-full blur-[90px] pointer-events-none -z-10"></div>
        <div className="absolute inset-0 opacity-[0.25] pointer-events-none -z-10" style={{ backgroundImage: "radial-gradient(var(--color-outline-variant) 1px, transparent 1px)", backgroundSize: "28px 28px" }}></div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 flex flex-col items-start gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container/70 border border-primary/20 text-on-secondary-fixed rounded-full text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              FORENSIC INTELLIGENCE ENGINE V4.2
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] text-on-surface tracking-tight leading-[1.15] font-extrabold">
              See the flow. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Detect the pattern.</span> <br />
              Stop the crime.
            </h1>
            <p className="text-secondary leading-relaxed max-w-xl text-[15px]">
              FLOWSIGHT helps investigators uncover suspicious financial networks hidden across transactions, accounts, and time. Explainable intelligence built for banks, FIUs, and anti-money laundering compliance.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button className="px-5 py-2.5 bg-primary-container text-white text-xs font-semibold rounded-lg shadow-lg shadow-primary/25 hover:bg-primary hover:shadow-primary/40 transition-all flex items-center gap-2 cursor-pointer hover:translate-y-[-1px]" onClick={scrollToDemo} type="button">
                <span>Explore Demo</span>
                <MaterialIcon name="arrow_forward" className="text-sm font-bold" />
              </button>
              <a className="px-5 py-2.5 bg-surface-container-lowest text-on-surface text-xs font-medium rounded-lg border border-outline-variant/60 shadow-sm hover:bg-surface-container transition-all flex items-center gap-2" href="#network-explorer-preview">
                <MaterialIcon name="scatter_plot" className="text-sm text-primary" />
                <span>See How It Works</span>
              </a>
              <button
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-xs font-medium border border-outline-variant/40 hover:bg-surface-container transition-all cursor-pointer"
                onClick={openPalette}
                type="button"
              >
                <MaterialIcon name="keyboard_command_key" className="text-sm text-primary" />
                <span>Navigator</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-[10px]">⌘K</kbd>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 pt-3 text-secondary border-t border-surface-container-highest w-full mt-2">
              <div className="flex items-center gap-1.5 text-xs">
                <MaterialIcon name="verified_user" className="text-base text-primary" />
                <span>FINTRAC &amp; FATF Compliant</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <MaterialIcon name="hub" className="text-base text-primary" />
                <span>14-Hop Layering Detection</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <MaterialIcon name="security" className="text-base text-emerald-600" />
                <span>Zero Hallucination Guarantee</span>
              </div>
            </div>
          </div>

          {/* Right: Forensic Scanner Terminal */}
          <div className="lg:col-span-6 w-full">
            <div className="relative bg-slate-950 text-slate-200 rounded-xl shadow-2xl border border-slate-800 overflow-hidden ring-1 ring-white/10">
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm"></span>
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm"></span>
                  <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm"></span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400 select-none">flowsight-engine-v4.2 — pid 84192 — [LIVE MONITOR]</span>
                </div>
                <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded text-[10px] font-mono text-red-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  <span>LIVE TELEMETRY TRACE — 14.2ms / hop</span>
                </div>
              </div>
              <div className="p-4 font-mono text-[11.5px] leading-relaxed relative overflow-hidden bg-slate-950/95 space-y-1.5">
                <div className="absolute inset-0 scanline-effect pointer-events-none h-20"></div>
                <div className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">&gt;</span>
                  <span>Scanning transaction graph... <strong className="text-slate-200">1,840,332 nodes</strong> indexed across 8 clearinghouse rails</span>
                </div>
                <div className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">&gt;</span>
                  <span>Layering heuristics running: <span className="text-emerald-400 font-semibold">Circular loop detection [ENABLED]</span></span>
                </div>
                <div className="pt-1 text-amber-300 font-semibold flex items-center gap-1.5">
                  <span className="text-amber-400">⚡</span>
                  <span>[ALERT DETECTED] Circular flow discovered across 3 entity hops:</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded text-[11px] text-slate-200 my-1 overflow-x-auto shadow-inner">
                  <div className="text-blue-300 font-medium whitespace-nowrap">
                    └─ <span className="text-white font-bold bg-blue-950/80 px-1 py-0.5 rounded border border-blue-800">AC-9214 (HDFC)</span>
                    <span className="text-amber-400 font-semibold">──[₹4,20,000]──&gt;</span>
                    <span className="text-white font-bold bg-slate-800 px-1 py-0.5 rounded">AC-4102 (ICICI)</span>
                    <span className="text-amber-400 font-semibold">──[₹8,10,450]──&gt;</span>
                    <span className="text-white font-bold bg-slate-800 px-1 py-0.5 rounded">AC-8821 (Axis)</span>
                    <span className="text-red-400 font-semibold">──[₹6,40,000]──&gt;</span>
                    <span className="text-red-300 font-bold underline decoration-red-500">AC-9214</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                    <span className="text-slate-400">&gt; Aggregated velocity:</span>
                    <span className="text-red-400 font-bold ml-1">₹18,70,450</span>
                    <span className="text-emerald-400 text-[10px] ml-1">(98.4% conf)</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                    <span className="text-slate-400">&gt; Risk score computed:</span>
                    <span className="text-red-400 font-bold ml-1">94/100 · P1 Critical</span>
                  </div>
                </div>
                <div className="text-slate-400 text-[11px] pt-1">
                  <span className="text-blue-400">&gt;</span> Case <strong className="text-white">INV-042</strong> flagged and automatically routed to <span className="text-blue-300 underline">FIU L2 queue</span>
                </div>
                <div className="text-slate-400 text-[11px] flex items-center">
                  <span className="text-blue-400">&gt;</span>&nbsp;Awaiting analyst dispatch... <span className="animate-pulse text-blue-400 font-bold text-sm ml-0.5">_</span>
                </div>
              </div>
              {/* Miniature Circular Network SVG */}
              <div className="p-3 bg-slate-900/80 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Live Topology Graph • Cluster #42</span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Synchronized
                  </span>
                </div>
                <div className="relative w-full h-[150px] bg-slate-950 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 460 150">
                    <defs>
                      <marker id="arrowhead-landing" markerHeight="4" markerWidth="6" orient="auto" refX="5" refY="2">
                        <polygon fill="#38bdf8" points="0 0, 6 2, 0 4"></polygon>
                      </marker>
                      <marker id="arrowhead-red-landing" markerHeight="4" markerWidth="6" orient="auto" refX="5" refY="2">
                        <polygon fill="#ef4444" points="0 0, 6 2, 0 4"></polygon>
                      </marker>
                    </defs>
                    <path className="animate-dash-flow" d="M 120 75 Q 230 25 340 50" fill="none" markerEnd="url(#arrowhead-landing)" stroke="#3b82f6" strokeWidth="1.8"></path>
                    <path className="animate-dash-flow" d="M 340 50 Q 300 120 230 125" fill="none" markerEnd="url(#arrowhead-landing)" stroke="#3b82f6" strokeWidth="1.8"></path>
                    <path className="animate-dash-fast" d="M 230 125 Q 150 120 120 75" fill="none" markerEnd="url(#arrowhead-red-landing)" stroke="#ef4444" strokeWidth="2"></path>
                    <line stroke="#475569" strokeDasharray="3,3" strokeWidth="1" x1="50" x2="120" y1="40" y2="75"></line>
                    <line stroke="#475569" strokeDasharray="3,3" strokeWidth="1" x1="50" x2="120" y1="110" y2="75"></line>
                    <line stroke="#475569" strokeDasharray="3,3" strokeWidth="1" x1="410" x2="340" y1="50" y2="50"></line>
                    <line stroke="#475569" strokeDasharray="3,3" strokeWidth="1" x1="390" x2="230" y1="110" y2="125"></line>
                    <circle cx="50" cy="40" fill="#64748b" r="4"></circle>
                    <circle cx="50" cy="110" fill="#64748b" r="4"></circle>
                    <circle cx="410" cy="50" fill="#64748b" r="4"></circle>
                    <circle cx="390" cy="110" fill="#64748b" r="4"></circle>
                    <circle className="animate-ping" cx="120" cy="75" fill="#ef4444" opacity="0.2" r="14"></circle>
                    <circle cx="120" cy="75" fill="#dc2626" r="9" stroke="#fca5a5" strokeWidth="2"></circle>
                    <text fill="#f87171" fontFamily="monospace" fontSize="10" fontWeight="bold" textAnchor="middle" x="120" y="98">AC-9214 (Hub)</text>
                    <circle cx="340" cy="50" fill="#2563eb" r="7" stroke="#93c5fd" strokeWidth="1.5"></circle>
                    <text fill="#cbd5e1" fontFamily="monospace" fontSize="9" textAnchor="middle" x="340" y="38">AC-4102</text>
                    <circle cx="230" cy="125" fill="#2563eb" r="7" stroke="#93c5fd" strokeWidth="1.5"></circle>
                    <text fill="#cbd5e1" fontFamily="monospace" fontSize="9" textAnchor="middle" x="230" y="143">AC-8821</text>
                  </svg>
                  <div className="absolute bottom-2 right-2 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-mono text-slate-300">
                    Loop: 3 Entity Hops
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANIMATED LIVE COUNTERS TELEMETRY STRIP */}
      <section className="w-full bg-slate-900 border-b border-slate-800 text-white py-4 px-6 shadow-inner">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col border-l-2 border-primary pl-3">
            <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">Transactions Scanned Today</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                <AnimatedNumber format={formatINR} value={1840617} />
              </span>
              <span className="inline-flex items-center text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>+2,840/s
              </span>
            </div>
          </div>
          <div className="flex flex-col border-l-2 border-amber-500 pl-3">
            <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">Suspicious Networks Found</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-300">
                <AnimatedNumber duration={700} value={34} />
              </span>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">4 Active Today</span>
            </div>
          </div>
          <div className="flex flex-col border-l-2 border-red-500 pl-3">
            <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">₹ Flagged This Week</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-red-400">
                ₹<AnimatedNumber duration={900} format={(v) => `${v.toFixed(1)} Cr`} value={42.8} />
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">98.4% Precision</span>
            </div>
          </div>
          <div className="flex flex-col border-l-2 border-blue-500 pl-3">
            <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">Mean Detection Latency</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-blue-300">
                <AnimatedNumber duration={600} format={(v) => `${v.toFixed(1)}ms`} value={14.2} />
              </span>
              <span className="text-[10px] font-mono text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800">Instant Traversal</span>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE INCIDENT FEED TICKER */}
      <section className="w-full bg-surface-container-lowest border-b border-surface-container-highest overflow-hidden" aria-label="Live incident feed">
        <div className="max-w-7xl mx-auto flex items-center">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-error text-on-error font-mono text-[11px] font-bold tracking-widest uppercase flex-shrink-0">
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
              <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-white"></span>
            </span>
            Incident Feed
          </div>
          <div className="relative flex-1 overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent 0, black 40px, black calc(100% - 40px), transparent 100%)" }}>
            <div className="flex w-max animate-marquee gap-space-lg py-2.5 pl-space-lg">
              {[...feed, ...feed].map((item, i) => {
                const tone = FEED_TONE[item.tone] || FEED_TONE.secondary
                return (
                  <span key={`${item.id}-${i}`} className={`flex items-center gap-2 border-l-2 pl-3 pr-1 ${tone.border} font-mono text-[12px] text-on-surface-variant whitespace-nowrap`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`}></span>
                    <span>{item.text}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL / PARTNER MARQUEE */}
      <section className="w-full py-3.5 bg-surface-container px-6 border-b border-surface-container-highest">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-secondary">
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-500 uppercase">TRUSTED BY AML &amp; FIU TEAMS AT</span>
          <div className="flex flex-wrap items-center gap-6 sm:gap-10 font-mono text-xs font-bold tracking-widest text-on-surface-variant">
            <span className="hover:text-primary transition-colors cursor-default">VERTEX BANK</span>
            <span className="hover:text-primary transition-colors cursor-default">MERIDIAN UNION</span>
            <span className="hover:text-primary transition-colors cursor-default">CAPITAL CLEARINGHOUSE</span>
            <span className="hover:text-primary transition-colors cursor-default">PACIFIC REGULATORY UNIT</span>
            <span className="hover:text-primary transition-colors cursor-default">EQUITY FORENSICS</span>
          </div>
        </div>
      </section>

      {/* SEE IT IN ACTION — INTERACTIVE GRAPH */}
      <section className="w-full py-12 px-6 bg-surface flex flex-col gap-6" id="network-explorer-preview">
        <div className="max-w-7xl mx-auto w-full">
          <NetworkGraphHero />
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="w-full py-16 px-6 bg-surface-container-low" id="capabilities">
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          <div className="flex flex-col gap-2 max-w-2xl">
            <span className="font-mono text-xs text-primary font-bold tracking-wider uppercase">CORE CAPABILITIES</span>
            <h2 className="text-2xl sm:text-3xl text-on-surface font-bold">Engineered for forensic speed and institutional clarity</h2>
            <p className="text-secondary text-sm">
              Tear through millions of rows of nested transaction histories to reveal high-conviction criminal structures in milliseconds.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <MaterialIcon name="device_hub" className="text-2xl" />
                </div>
                <h3 className="text-lg text-on-surface font-bold">Network Explorer</h3>
                <p className="text-secondary text-sm leading-relaxed">
                  Uncover multi-hop relationships, mule clusters, and hidden layering between counterparties with instant graph traversal across high-volume ledgers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container-high flex items-center justify-between font-mono text-xs">
                <span className="text-slate-500 font-semibold uppercase">Mule Cluster Recognition</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Active · 14 Hops</span>
              </div>
            </div>
            <div className="group bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <MaterialIcon name="history" className="text-2xl" />
                </div>
                <h3 className="text-lg text-on-surface font-bold">Flow Timeline</h3>
                <p className="text-secondary text-sm leading-relaxed">
                  Replay network formation day-by-day (Day 1 → Day 47) to reveal intentional staging, smurfing cadences, and rapid capital dissipation paths before alerts cool off.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container-high flex items-center justify-between font-mono text-xs">
                <span className="text-slate-500 font-semibold uppercase">Cadence Sampling</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">T+0 to T+90 Replay</span>
              </div>
            </div>
            <div className="group bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <MaterialIcon name="psychology" className="text-2xl" />
                </div>
                <h3 className="text-lg text-on-surface font-bold">Explainable AI</h3>
                <p className="text-secondary text-sm leading-relaxed">
                  Plain-language investigative reasoning with cited transaction evidence (TXN-842193) ready for statutory filing without black-box guesswork or probabilistic hallucination.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container-high flex items-center justify-between font-mono text-xs">
                <span className="text-slate-500 font-semibold uppercase">SAR/STR Export</span>
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">FIU XML / PDF Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ZERO HALLUCINATION & LIVE CASE SYNTHESIS */}
      <section className="w-full py-16 px-6 bg-surface" id="engine">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono font-bold w-fit">
              <MaterialIcon name="verified" className="text-sm" /> FORENSIC PRECISION
            </div>
            <h2 className="text-2xl sm:text-3xl text-on-surface font-bold">Zero hallucination. Fully referenced audit trails.</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Every assertion made by FLOWSIGHT links directly back to raw banking telemetries, cryptographic hash chains, and clearinghouse acknowledgements.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                  <MaterialIcon name="check" className="text-base" />
                </div>
                <div>
                  <p className="text-sm text-on-surface font-bold">Deterministic Network Inference</p>
                  <p className="text-xs text-secondary">Probabilistic models verified strictly via rule-based clearing constraints.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                  <MaterialIcon name="check" className="text-base" />
                </div>
                <div>
                  <p className="text-sm text-on-surface font-bold">Native Multi-Rail Synthesis</p>
                  <p className="text-xs text-secondary">Correlate UPI, IMPS, NEFT, RTGS, SWIFT, and crypto on/off-ramps seamlessly in one canvas.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                  <MaterialIcon name="check" className="text-base" />
                </div>
                <div>
                  <p className="text-sm text-on-surface font-bold">Court-Admissible Evidence Ledger</p>
                  <p className="text-xs text-secondary">SHA-256 sealed transaction dossiers instantly portable for criminal prosecution.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 w-full bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/60 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container-highest">
              <div className="flex items-center gap-2">
                <span className="text-base text-on-surface font-bold">Case Synthesis Log: CS-9831</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span> NEW · 2s ago
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">Critical Alert</span>
            </div>
            <div className="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-xs space-y-2.5 border border-slate-800">
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold border-b border-slate-800 pb-2">
                <MaterialIcon name="psychology" className="text-sm" />
                <span>Investigation Note:</span>
                <span className="text-slate-300 font-normal">Entity cluster centered on <code className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">AC-9214</code> shows repetitive structuring across 47 hops.</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300 flex items-start justify-between gap-2">
                <div>
                  <span className="text-emerald-400 font-bold">&gt; TXN-842193:</span>
                  <span className="text-white font-semibold ml-1">₹3,50,000</span> transferred via IMPS at 03:14:22 UTC
                </div>
                <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[10px] whitespace-nowrap">Flag: Off-hours Velocity</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-red-800/80 text-slate-300 flex items-start justify-between gap-2 bg-red-950/20">
                <div>
                  <span className="text-emerald-400 font-bold">&gt; TXN-842194:</span>
                  <span className="text-white font-semibold ml-1">₹3,49,500</span> fanned out to 7 sub-accounts within 180s
                </div>
                <span className="px-1.5 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded text-[10px] whitespace-nowrap animate-pulse font-semibold">Flag: Smurfing Pattern [JUST FLAGGED]</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-1">
                <span className="text-emerald-400 font-bold">CONFIDENCE SCORE: 98.4%</span>
                <span className="text-slate-500 font-mono">EVIDENCE PACK SHA-256: 8f4e21a9...c4b2 VERIFIED BY FIU ADAPTER</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AUTHENTICATION & QUICK DEMO PORTAL */}
      <section className="w-full py-16 px-6 bg-surface-container-low border-t border-surface-container-highest" id="signin-box">
        <div className="max-w-xl mx-auto">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/60 p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/25 mb-1">
                <MaterialIcon name="timeline" className="text-2xl" />
              </div>
              <h2 className="text-2xl text-on-surface font-bold">Welcome back to FLOWSIGHT</h2>
              <p className="text-xs text-secondary">Select an instant access tier or authenticate with institutional credentials</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-secondary font-bold tracking-wider uppercase">QUICK ONE-CLICK DEMO ACCESS</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button className="p-3 bg-surface-container-low hover:bg-surface-container text-left rounded-xl transition-all border border-outline-variant/40 hover:border-primary/40 flex flex-col group cursor-pointer" onClick={() => navigate("/analyst/overview")} type="button">
                  <span className="text-sm text-primary flex items-center justify-between font-bold">
                    <span>Analyst Demo</span>
                    <MaterialIcon name="badge" className="text-base group-hover:scale-110 transition-transform" />
                  </span>
                  <span className="text-xs text-secondary mt-1">A. Sharma (L2 FIU Officer)</span>
                </button>
                <button className="p-3 bg-surface-container-low hover:bg-surface-container text-left rounded-xl transition-all border border-outline-variant/40 hover:border-primary/40 flex flex-col group cursor-pointer" onClick={() => navigate("/admin/overview")} type="button">
                  <span className="text-sm text-on-surface flex items-center justify-between font-bold">
                    <span>Admin Demo</span>
                    <MaterialIcon name="admin_panel_settings" className="text-base group-hover:scale-110 transition-transform" />
                  </span>
                  <span className="text-xs text-secondary mt-1">Risk Director Sandbox</span>
                </button>
              </div>
            </div>
            <div className="relative flex items-center justify-center my-1">
              <div className="w-full bg-surface-container-highest h-[1px]"></div>
              <span className="absolute bg-surface-container-lowest px-3 font-mono text-[11px] text-secondary font-medium uppercase">OR SIGN IN WITH SSO</span>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface font-semibold" htmlFor="landing-email">Institutional Email</label>
                <input className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors text-sm" id="landing-email" placeholder="investigator@vertexbank.com" required type="email" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-on-surface font-semibold" htmlFor="landing-password">Credential Key</label>
                  <a className="text-xs text-primary hover:underline" href="#">Reset key</a>
                </div>
                <input className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors text-sm" id="landing-password" placeholder="••••••••••••" required type="password" />
              </div>
              <div className="flex items-center gap-2">
                <input className="w-4 h-4 rounded text-primary focus:ring-0 border-outline-variant cursor-pointer" id="landing-remember" type="checkbox" />
                <label className="text-xs text-secondary cursor-pointer select-none" htmlFor="landing-remember">Remember hardware token for 8 hours</label>
              </div>
              <button className="w-full py-2.5 bg-primary-container text-white text-sm rounded-lg shadow-md hover:bg-primary transition-all text-center font-semibold cursor-pointer" type="submit">
                Sign In to Forensic Console
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL COMPLIANCE FOOTER */}
      <SiteFooter />
    </div>
  )
}

export default Landing