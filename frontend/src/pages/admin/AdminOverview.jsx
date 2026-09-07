import { useRef, useState, useEffect } from "react"
import { Link } from "react-router-dom"
import AnimatedNumber from "../../components/AnimatedNumber.jsx"
import { api } from "../../lib/api.js"

const RANGES = ["Last 24 Hours", "Last 7 Days", "Last 30 Days", "Custom Window"]

const BANKS = [
  { name: "HDFC Bank", rail: "UPI / RTGS" },
  { name: "ICICI Bank", rail: "IMPS / NEFT" },
  { name: "Axis Bank", rail: "UPI / IMPS" },
  { name: "State Bank (SBI)", rail: "CORE / SWIFT" },
]

function AdminOverview() {
  const [range, setRange] = useState(RANGES[0])
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const [health, setHealth] = useState(null)
  const [adminHealth, setAdminHealth] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])

  useEffect(() => {
    let alive = true
    api.health().then((d) => alive && setHealth(d)).catch(() => {})
    api.adminHealth().then((d) => alive && setAdminHealth(d)).catch(() => {})
    api.users().then((d) => alive && setUsers(d.items || [])).catch(() => {})
    api.auditLogs().then((d) => alive && setLogs(d.items || [])).catch(() => {})
    return () => { alive = false }
  }, [])

  const healthRows = (adminHealth?.services ? Object.entries(adminHealth.services).map(([key, val]) => ({
    name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    metric: adminHealth.status,
    node: val,
  })) : [])

  const logRows = logs.map((l) => ({
    initials: (l.user || "—").slice(0, 2).toUpperCase(),
    name: l.user || "—",
    detail: l.action?.replace(/_/g, " ") || "—",
    target: l.resource || "—",
    tag: l.result || "unknown",
    time: l.timestamp ? new Date(l.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—",
  }))

  const showToast = (message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Page Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-lg">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex items-center gap-space-xs">
            <span className="px-space-xs py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-label-caps text-label-caps uppercase tracking-wider">Node Ops Alpha</span>
            <span className="text-outline text-body-sm">/</span>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Telemetry Core</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">Admin Overview</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Monitor FLOWSIGHT operations, analysts and detection systems.</p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <div className="relative inline-flex items-center bg-surface-container-lowest rounded shadow-sm">
            <span className="material-symbols-outlined absolute left-space-sm text-outline text-[18px] pointer-events-none">calendar_today</span>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="appearance-none bg-transparent pl-8 pr-8 py-1.5 h-9 font-label-sm text-label-sm text-on-surface cursor-pointer focus:outline-none focus:bg-surface-container-low rounded transition-colors"
            >
              {RANGES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-space-xs text-outline text-[18px] pointer-events-none">expand_more</span>
          </div>
          <button
            onClick={() => showToast("System report export queued · SYS-RPT-2026-0911")}
            className="flex items-center gap-space-xs h-9 px-space-base rounded bg-primary text-on-primary font-label-sm text-label-sm hover:bg-on-primary-fixed-variant transition-colors shadow-sm active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export System Report</span>
          </button>
        </div>
      </div>
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-base mb-space-xl">
        {/* Card 1: Active Analysts */}
        <div className="bg-surface-container-lowest rounded-xl p-space-base shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-primary-fixed/20 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Active Analysts</span>
            <span className="w-7 h-7 rounded bg-secondary-container flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[16px]">badge</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-semibold"><AnimatedNumber value={users.length || 0} /></span>
            <div className="flex items-center text-label-sm font-label-sm text-on-secondary-fixed bg-secondary-container/60 px-1.5 py-0.5 rounded">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span className="ml-0.5 font-semibold">Active</span>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">Registered platform analysts</p>
        </div>
        {/* Card 2: Open Investigations */}
        <div className="bg-surface-container-lowest rounded-xl p-space-base shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-error-container/20 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Open Investigations</span>
            <span className="w-7 h-7 rounded bg-error-container flex items-center justify-center text-on-error-container">
              <span className="material-symbols-outlined text-[16px]">travel_explore</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-semibold"><AnimatedNumber value={health?.investigations || 0} /></span>
            <span className="px-2 py-0.5 rounded bg-error-container text-error font-label-sm text-label-sm font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
              {adminHealth?.counts?.alerts || 0} Alerts
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">Total investigation records on file</p>
        </div>
        {/* Card 3: Alerts Processed Today */}
        <div className="bg-surface-container-lowest rounded-xl p-space-base shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-secondary-container/20 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Alerts Processed Today</span>
            <span className="w-7 h-7 rounded bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[16px]">checklist_rtl</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-numeric-lg text-numeric-lg text-on-surface font-semibold"><AnimatedNumber value={health?.alerts || 0} /></span>
            <span className="font-label-sm text-label-sm text-primary font-semibold">active</span>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-space-xs overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: health?.alerts ? "100%" : "0%" }}></div>
          </div>
        </div>
        {/* Card 4: System Status */}
        <div className="bg-surface-container-lowest rounded-xl p-space-base shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-surface-container/60 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">System Status</span>
            <span className="w-7 h-7 rounded bg-surface-container-low flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[16px]">tune</span>
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              {adminHealth?.status || "…"}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs break-words">{health ? `${health.accounts} accounts · ${health.transactions} txns · ${health.investigations} investigations` : "Loading system telemetry…"}</p>
        </div>
      </div>
      {/* Main Content 2/3 and 1/3 Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left Column (8 of 12 cols = 2/3 width) */}
        <div className="lg:col-span-8 flex flex-col gap-space-lg min-w-0">
          {/* Chart Widget: Detection Activity & Ingestion Volume */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Detection Activity & Ingestion Volume</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Real-time throughput metrics across 24 hourly aggregation buckets</span>
              </div>
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded bg-primary"></span>
                  <span>Txn Volume (k/hr)</span>
                </div>
                <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                  <span>Anomaly Spikes</span>
                </div>
              </div>
            </div>
            {/* Telemetry Highlights Banner */}
            <div className="flex items-center gap-space-lg py-space-sm px-space-base bg-surface-container-low rounded mb-space-base">
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-outline">Hourly Peak</span>
                <span className="font-numeric-md text-numeric-md font-semibold text-on-surface">142,890 / hr</span>
              </div>
              <div className="h-6 w-px bg-surface-container-highest"></div>
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-outline">Average Stream</span>
                <span className="font-numeric-md text-numeric-md font-semibold text-on-surface">98,240 / hr</span>
              </div>
              <div className="h-6 w-px bg-surface-container-highest"></div>
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-outline">Anomalies Detected</span>
                <span className="font-numeric-md text-numeric-md font-semibold text-error">42 Critical Triggers</span>
              </div>
            </div>
            {/* Custom Inline High-Precision SVG Chart */}
            <div className="relative w-full h-64 select-none">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 780 200">
                <defs>
                  <linearGradient id="adminPrimaryAreaGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.22"></stop>
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.0"></stop>
                  </linearGradient>
                </defs>
                <line stroke="#eceef0" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="770" y1="20" y2="20"></line>
                <line stroke="#eceef0" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="770" y1="65" y2="65"></line>
                <line stroke="#eceef0" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="770" y1="110" y2="110"></line>
                <line stroke="#eceef0" strokeWidth="1" x1="40" x2="770" y1="155" y2="155"></line>
                <text fill="#747686" fontSize="10" textAnchor="end" x="32" y="24">160k</text>
                <text fill="#747686" fontSize="10" textAnchor="end" x="32" y="69">120k</text>
                <text fill="#747686" fontSize="10" textAnchor="end" x="32" y="114">80k</text>
                <text fill="#747686" fontSize="10" textAnchor="end" x="32" y="159">0k</text>
                <rect fill="#dae2fd" height="40" rx="1" width="8" x="65" y="115"></rect>
                <rect fill="#dae2fd" height="30" rx="1" width="8" x="95" y="125"></rect>
                <rect fill="#dae2fd" height="25" rx="1" width="8" x="125" y="130"></rect>
                <rect fill="#dae2fd" height="20" rx="1" width="8" x="155" y="135"></rect>
                <rect fill="#dae2fd" height="35" rx="1" width="8" x="185" y="120"></rect>
                <rect fill="#dae2fd" height="55" rx="1" width="8" x="215" y="100"></rect>
                <rect fill="#dae2fd" height="75" rx="1" width="8" x="245" y="80"></rect>
                <rect fill="#dae2fd" height="95" rx="1" width="8" x="275" y="60"></rect>
                <rect fill="#dae2fd" height="105" rx="1" width="8" x="305" y="50"></rect>
                <rect fill="#dae2fd" height="110" rx="1" width="8" x="335" y="45"></rect>
                <rect fill="#dae2fd" height="100" rx="1" width="8" x="365" y="55"></rect>
                <rect fill="#dae2fd" height="85" rx="1" width="8" x="395" y="70"></rect>
                <rect fill="#dae2fd" height="115" rx="1" width="8" x="425" y="40"></rect>
                <rect fill="#dae2fd" height="123" rx="1" width="8" x="455" y="32"></rect>
                <rect fill="#dae2fd" height="117" rx="1" width="8" x="485" y="38"></rect>
                <rect fill="#dae2fd" height="107" rx="1" width="8" x="515" y="48"></rect>
                <rect fill="#dae2fd" height="90" rx="1" width="8" x="545" y="65"></rect>
                <rect fill="#dae2fd" height="85" rx="1" width="8" x="575" y="70"></rect>
                <rect fill="#dae2fd" height="97" rx="1" width="8" x="605" y="58"></rect>
                <rect fill="#dae2fd" height="93" rx="1" width="8" x="635" y="62"></rect>
                <rect fill="#dae2fd" height="75" rx="1" width="8" x="665" y="80"></rect>
                <rect fill="#dae2fd" height="65" rx="1" width="8" x="695" y="90"></rect>
                <rect fill="#dae2fd" height="50" rx="1" width="8" x="725" y="105"></rect>
                <rect fill="#dae2fd" height="43" rx="1" width="8" x="755" y="112"></rect>
                <path d="M 69 110 Q 140 135, 219 95 T 339 42 T 459 28 T 579 65 T 699 85 T 759 108 L 759 155 L 69 155 Z" fill="url(#adminPrimaryAreaGrad)"></path>
                <path d="M 69 110 Q 140 135, 219 95 T 339 42 T 459 28 T 579 65 T 699 85 T 759 108" fill="none" stroke="#1d4ed8" strokeLinecap="round" strokeWidth="2.5"></path>
                <line stroke="#ba1a1a" strokeDasharray="2 2" strokeWidth="1.5" x1="339" x2="339" y1="42" y2="155"></line>
                <circle cx="339" cy="42" fill="#ba1a1a" r="5" stroke="#ffffff" strokeWidth="2"></circle>
                <circle className="animate-ping" cx="339" cy="42" fill="#ba1a1a" opacity="0.25" r="9"></circle>
                <rect fill="#ba1a1a" height="18" rx="2" width="60" x="309" y="12"></rect>
                <text fill="#ffffff" fontSize="9" fontWeight="600" textAnchor="middle" x="339" y="24">SPIKE +18%</text>
                <line stroke="#1d4ed8" strokeDasharray="2 2" strokeWidth="1.5" x1="459" x2="459" y1="28" y2="155"></line>
                <circle cx="459" cy="28" fill="#1d4ed8" r="5.5" stroke="#ffffff" strokeWidth="2"></circle>
                <rect fill="#0b1c30" height="18" rx="2" width="70" x="424" y="2"></rect>
                <text fill="#ffffff" fontSize="9" fontWeight="600" textAnchor="middle" x="459" y="14">PEAK 140.2k</text>
                <line stroke="#ba1a1a" strokeDasharray="2 2" strokeWidth="1.5" x1="609" x2="609" y1="58" y2="155"></line>
                <circle cx="609" cy="58" fill="#ba1a1a" r="5" stroke="#ffffff" strokeWidth="2"></circle>
                <rect fill="#ba1a1a" height="18" rx="2" width="56" x="581" y="26"></rect>
                <text fill="#ffffff" fontSize="9" fontWeight="600" textAnchor="middle" x="609" y="38">BURST 8.9k</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="69" y="174">00:00</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="185" y="174">04:00</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="305" y="174">08:00</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="425" y="174">12:00</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="545" y="174">16:00</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="665" y="174">20:00</text>
                <text fill="#747686" fontSize="10" textAnchor="middle" x="755" y="174">23:59</text>
              </svg>
            </div>
            <div className="flex items-center justify-between pt-space-md mt-space-sm border-t border-surface-container-high text-body-sm font-body-sm text-on-surface-variant">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">data_thresholding</span>
                Automated load balancing engaged · Kafka partitions: 48/48 synced
              </span>
              <Link to="/admin/health" className="font-label-sm text-label-sm text-primary hover:underline font-semibold flex items-center gap-0.5">
                View Live Ingestion Telemetry
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>
          {/* Recent Analyst Actions Table / Feed */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-space-md mb-space-sm">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Recent Analyst Actions</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Immutable administrative event stream across fraud and compliance suites</span>
              </div>
              <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface font-label-caps text-label-caps font-semibold">{logs.length} Logs Synced</span>
            </div>
            {/* Table View */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low h-9 text-outline font-label-caps text-label-caps uppercase tracking-wider">
                    <th className="px-space-md rounded-l">Analyst</th>
                    <th className="px-space-md">Action Detail</th>
                    <th className="px-space-md">Target Entity</th>
                    <th className="px-space-md">Severity / Tag</th>
                    <th className="px-space-md text-right rounded-r">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface divide-y divide-surface-container-high">
                  {logRows.map((a) => (
                    <tr key={`${a.time}-${a.target}`} className="h-11 hover:bg-surface-container-low/70 transition-colors">
                      <td className="px-space-md font-semibold flex items-center gap-space-xs py-2">
                        <div className={`w-6 h-6 rounded-full ${a.result === "success" ? "bg-primary-fixed text-on-primary-fixed" : "bg-error-container text-on-error-container"} flex items-center justify-center font-label-caps text-[10px] font-bold`}>{a.initials}</div>
                        <span>{a.name}</span>
                      </td>
                      <td className="px-space-md text-on-surface">{a.detail}</td>
                      <td className="px-space-md">
                        <span className={`font-numeric-md text-numeric-md font-mono font-semibold ${a.result === "success" ? "text-primary" : "text-on-surface"}`}>{a.target}</span>
                      </td>
                      <td className="px-space-md">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-caps text-label-caps font-semibold ${a.result === "success" ? "bg-secondary-container text-on-secondary-fixed-variant" : "bg-error-container text-error"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${a.result === "success" ? "bg-on-secondary-fixed" : "bg-error"}`}></span>
                          {a.tag}
                        </span>
                      </td>
                      <td className="px-space-md text-right text-on-surface-variant font-numeric-md text-numeric-md">{a.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-space-md mt-space-sm">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Showing latest verified operations across all active security analysts</span>
              <Link to="/admin/audit-logs" className="font-label-sm text-label-sm text-primary hover:text-on-primary-fixed-variant font-semibold flex items-center gap-1 transition-colors">
                <span>View Full Audit Vault</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </Link>
            </div>
          </div>
        </div>
        {/* Right Column (4 of 12 cols = 1/3 width) */}
        <div className="lg:col-span-4 flex flex-col gap-space-lg min-w-0">
          {/* System Health Summary Panel */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-space-base">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">System Health</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Live telemetry & node performance</span>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-label-caps font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                ALL OK
              </div>
            </div>
            <div className="flex flex-col gap-space-sm">
              {healthRows.length ? healthRows.map((h) => (
                <div key={h.name} className="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-space-2xs hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">{h.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[11px] font-label-caps font-semibold text-primary">{h.node}</span>
                  </div>
                  <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
                    <span className="capitalize">{h.metric}</span>
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      Operational
                    </span>
                  </div>
                </div>
              )) : (
                <div className="p-space-sm rounded bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">Loading live service telemetry…</div>
              )}
            </div>
            <div className="mt-space-base pt-space-sm border-t border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-outline">history</span>
                <span>Last automated diagnostics 48s ago</span>
              </div>
              <button onClick={() => showToast("Full diagnostics report generated")} className="font-label-sm text-label-sm text-primary font-semibold hover:underline">Full Diagnostics</button>
            </div>
          </div>
          {/* Licensing & Node Capacity Panel */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-space-base">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Licensing & Node Capacity</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Multi-bank production rail allocations</span>
              </div>
              <span className="material-symbols-outlined text-outline text-[20px]">hub</span>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-base mb-space-base">
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Transaction Throughput</span>
                <span className="font-label-sm text-label-sm font-bold text-on-surface">{health ? ((health.transactions / (health.transactions || 1)) * 100).toFixed(0) : "—"}%</span>
              </div>
              <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: health ? "100%" : "0%" }}></div>
              </div>
              <div className="flex items-center justify-between mt-space-xs font-numeric-md text-numeric-md">
                <span className="text-on-surface font-semibold">{(health?.transactions || 0).toLocaleString("en-IN")} txns</span>
                <span className="text-outline">live ledger</span>
              </div>
            </div>
            <div className="flex flex-col gap-space-xs mb-space-base">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Active Core Integrations (4)</span>
              <div className="grid grid-cols-2 gap-space-xs">
                {BANKS.map((b) => (
                  <div key={b.name} className="flex items-center justify-between px-space-sm py-2 rounded bg-surface-container-low">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">{b.name}</span>
                    </div>
                    <span className="font-label-caps text-label-caps text-outline">{b.rail}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-space-sm rounded bg-surface-container-low flex items-center justify-between text-body-sm font-body-sm">
              <div className="flex items-center gap-space-xs text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
                <span>Enterprise Cluster · Tier 3 Validated</span>
              </div>
              <span className="font-numeric-md text-numeric-md font-semibold text-primary">v{adminHealth?.version || "—"}</span>
            </div>
          </div>
          {/* Quick Action / System Notice Card */}
          <div className="rounded-xl p-space-base bg-secondary-container/40 flex items-start gap-space-sm">
            <span className="material-symbols-outlined text-on-secondary-fixed text-[20px] mt-0.5">info</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-semibold text-on-secondary-fixed">Scheduled Pipeline Maintenance</span>
              <p className="font-body-sm text-body-sm text-on-secondary-fixed-variant mt-0.5">Zero-downtime hot-swap planned for Node #3 at 02:00 AM IST. Parallel failover verified.</p>
            </div>
          </div>
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

export default AdminOverview