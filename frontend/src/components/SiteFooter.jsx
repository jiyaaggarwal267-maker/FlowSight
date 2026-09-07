import MaterialIcon from "./MaterialIcon.jsx"

function SiteFooter() {
  return (
    <footer className="w-full bg-slate-950 text-slate-400 px-6 py-12 border-t border-slate-800" id="compliance">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-white">
                <MaterialIcon name="timeline" className="text-base" />
              </div>
              <span className="text-base text-white font-bold tracking-tight">FLOWSIGHT</span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Explainable financial crime intelligence platform engineered for transaction forensics, AML investigative graphs, and real-time alert triage. Built in alignment with FATF Recommendations.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-white font-bold tracking-wider uppercase">PRODUCT</span>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="/#network-explorer-preview">Network Traversal</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="/#capabilities">Flow Replay</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="/#engine">SAR Automations</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="/#network-explorer-preview">Mule Ring Triage</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-white font-bold tracking-wider uppercase">COMPLIANCE</span>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">FIU Standards</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">FATF Guideline V.2</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">Auditing Protocols</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">Model Risk Mgmt</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-white font-bold tracking-wider uppercase">INSTITUTION</span>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">SOC2 Type II</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">Air-Gapped Vault</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">Security Whitepaper</a>
            <a className="text-xs text-slate-400 hover:text-white transition-colors" href="#">Contact Triage</a>
          </div>
        </div>
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 text-xs text-slate-500">
          <p>© 2025 FLOWSIGHT Intelligence Inc. Operating in strict alignment with statutory reporting directives.</p>
          <div className="flex items-center gap-4">
            <a className="hover:text-slate-300 transition-colors" href="#">Data Retention Policy</a>
            <a className="hover:text-slate-300 transition-colors" href="#">Audit Framework</a>
            <span className="text-slate-400">System Status: <strong className="text-emerald-400 font-mono font-bold">100% Operational</strong></span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter