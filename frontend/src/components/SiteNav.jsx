import { useNavigate } from "react-router-dom"
import MaterialIcon from "./MaterialIcon.jsx"

function SiteNav() {
  const navigate = useNavigate()

  return (
    <>
      <aside className="w-full bg-slate-900 text-slate-300 py-1.5 px-4 border-b border-slate-800 text-center flex items-center justify-center overflow-hidden">
        <p className="text-[11px] font-mono tracking-wider flex items-center justify-center gap-2 whitespace-nowrap">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-white">STATUTORY DEFENSE SYSTEM ACTIVE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 hidden sm:inline">DEMO ENVIRONMENT · SIMULATED FINANCIAL TELEMETRY · EXPLAINABLE AI READY FOR FIU REPORTING</span>
        </p>
      </aside>

      <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md px-6 py-3 border-b border-surface-container-highest transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md text-white shadow-primary/20">
                <MaterialIcon name="timeline" className="text-lg" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-on-surface leading-none">FLOWSIGHT</span>
                <span className="text-[9px] font-mono tracking-widest text-primary font-bold mt-0.5">FORENSIC CORE</span>
              </div>
            </a>
            <nav className="hidden lg:flex items-center gap-5 pl-4 text-secondary text-xs font-medium">
              <a href="/#capabilities">Capabilities</a>
              <a href="/#network-explorer-preview">Interactive Graph</a>
              <a href="/#engine">Detection Engine</a>
              <a href="/#compliance">Compliance &amp; FIU</a>
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-secondary hover:text-on-surface bg-surface-container hover:bg-surface-container-highest transition-colors cursor-pointer"
              type="button"
              onClick={() => navigate("/login")}
            >
              Request Access
            </button>
            <button
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary-container text-white shadow-sm hover:bg-primary transition-all flex items-center gap-1.5 cursor-pointer"
              type="button"
              onClick={() => navigate("/login")}
            >
              <span>Sign In / Demo</span>
              <MaterialIcon name="terminal" className="text-sm" />
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

export default SiteNav