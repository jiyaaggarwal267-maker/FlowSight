import { useEffect, useRef, useState } from "react"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import { api } from "../../lib/api.js"

function InvestigationReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [query, setQuery] = useState("")
  const [toast, setToast] = useState({ msg: "", visible: false })
  const toastTimer = useRef(null)

  useEffect(() => {
    fetchReports()
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchReportDetail(selectedId)
    }
  }, [selectedId])

  const fetchReports = async () => {
    try {
      const data = await api.reports()
      setReports(data.items || [])
      if (data.items?.length > 0 && !selectedId) {
        setSelectedId(data.items[0].id)
      }
    } catch (err) {
      showToast(`Failed to load reports: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchReportDetail = async (id) => {
    try {
      const data = await api.report(id)
      setSelectedReport(data)
    } catch (err) {
      showToast(`Failed to load report detail: ${err.message}`)
    }
  }

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = (msg) => {
    setToast({ msg, visible: true })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3200)
  }

  const filtered = reports.filter(
    (r) => `${r.id} ${r.investigation_id} ${r.analyst}`.toLowerCase().includes(query.toLowerCase())
  )

  const formatContent = (key) => {
    if (!selectedReport?.content) return ""
    return selectedReport.content[key] || ""
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Top Command Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-base">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline-lg text-headline-lg text-on-surface">Investigation Reports</span>
            <span className="px-space-xs py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-label-caps uppercase tracking-wider">FIU-IND Ready</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">Generate, validate, and audit evidence-backed intelligence packages for regulatory dispatch.</p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button className="flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm shadow-sm transition-all cursor-pointer" type="button" onClick={() => showToast("Audit trail is being logged for all report mutations.")}>
            <MaterialIcon name="history" className="text-[18px]" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Operational Filter / Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-md p-space-sm rounded-xl bg-surface-container-lowest shadow-sm mb-space-base">
        <div className="flex items-center gap-space-sm flex-1 min-w-[280px]">
          <div className="relative w-full max-w-md flex items-center">
            <MaterialIcon name="search" className="absolute left-3 text-outline text-[18px]" />
            <input className="w-full h-9 pl-9 pr-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary-container transition-all" placeholder="Filter by Report ID or case number..." type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Primary Split View Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-base items-start">
        {/* LEFT PANEL: Reports Queue */}
        <div className="xl:col-span-4 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-space-xs">
            <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-on-surface-variant tracking-wider uppercase">
              <span>Investigation Reports</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface">{reports.length} TOTAL</span>
            </div>
          </div>
          {loading ? (
            <div className="p-space-xl text-center">Loading reports...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-space-xs py-12 rounded-xl bg-surface-container-lowest shadow-sm">
              <MaterialIcon name="folder_off" className="text-[28px] text-outline-variant" />
              <span className="font-headline-sm text-headline-sm text-on-surface">No reports found</span>
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className={`group relative flex flex-col gap-space-sm p-space-base rounded-xl bg-surface-container-lowest transition-all cursor-pointer ${selectedId === r.id ? "shadow-md ring-2 ring-primary" : "shadow-sm hover:shadow-md"}`} onClick={() => setSelectedId(r.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className={`font-headline-sm text-headline-sm ${selectedId === r.id ? "text-primary" : "text-on-surface"}`}>{r.id}</span>
                      <span className="text-outline">·</span>
                      <span className={`font-body-sm text-body-sm ${selectedId === r.id ? "text-on-surface font-semibold" : "text-on-surface-variant"}`}>{r.investigation_id}</span>
                    </div>
                    <span className="font-headline-md text-headline-md text-on-surface mt-0.5 font-semibold">Report for {r.investigation_id}</span>
                  </div>
                  <span className={`px-space-xs py-0.5 rounded font-label-caps text-label-caps bg-surface-container-high text-on-surface`}>{r.status}</span>
                </div>
                <div className="flex items-center justify-between pt-space-xs text-on-surface-variant font-body-sm text-body-sm">
                  <div className="flex items-center gap-space-xs">
                    <span>Analyst: {r.analyst}</span>
                  </div>
                  <div className="flex items-center gap-1 text-outline">
                    <MaterialIcon name="calendar_today" className="text-[14px]" />
                    <span>{new Date(r.generated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {/* RIGHT PANEL: Report Preview */}
        <div className="xl:col-span-8 flex flex-col gap-space-base">
          {selectedReport ? (
            <div className="relative bg-surface-container-lowest p-space-xl rounded-xl shadow-xl flex flex-col gap-space-lg overflow-hidden border border-surface-container">
              <div className="flex flex-col gap-space-xs pb-space-md border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-3 h-3 rounded bg-primary"></span>
                    <span className="font-headline-sm text-headline-sm tracking-wider uppercase text-on-surface font-bold">FLOWSIGHT FORENSIC INVESTIGATION REPORT</span>
                  </div>
                  <span className="font-label-caps text-label-caps px-space-xs py-0.5 rounded bg-error-container text-on-error-container font-semibold uppercase">CONFIDENTIAL</span>
                </div>
                <div className="flex flex-wrap items-center justify-between pt-space-xs text-on-surface-variant font-body-sm text-body-sm">
                  <div className="flex items-center gap-space-md">
                    <div><strong className="text-on-surface">Case Ref:</strong> {selectedReport.investigation_id}</div>
                    <div><strong className="text-on-surface">Report Ref:</strong> {selectedReport.id}</div>
                    <div><strong className="text-on-surface">Date:</strong> {new Date(selectedReport.generated_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {[
                { title: "Executive Summary", key: "executive_summary" },
                { title: "Network Overview", key: "network_overview" },
                { title: "Key Evidence", key: "key_evidence" },
                { title: "Transaction Paths", key: "transaction_paths" },
                { title: "Behavioral Deviations", key: "behavioral_deviations" },
                { title: "Linked Entities", key: "linked_entities" },
                { title: "Risk Assessment", key: "risk_assessment" },
                { title: "Recommended Action", key: "recommended_action" },
              ].map((section, idx) => (
                <div key={section.key} className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-caps text-label-caps text-primary font-bold">{String(idx + 1).padStart(2, "0")} //</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wide">{section.title}</span>
                  </div>
                  <div className="p-space-base rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md leading-relaxed whitespace-pre-wrap">
                    {formatContent(section.key)}
                  </div>
                </div>
              ))}

              <div className="pt-space-md flex flex-wrap items-end justify-between gap-space-base border-t mt-space-md">
                <div className="flex flex-col gap-1">
                  <span className="font-label-caps text-label-caps text-outline uppercase">PREPARED BY</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{selectedReport.analyst}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl shadow-sm border border-dashed border-outline">
              Select a report to view its contents
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div className={`fixed bottom-space-lg right-space-lg z-50 transform transition-all duration-300 ${toast.visible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-space-sm px-space-lg py-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-xl">
          <MaterialIcon name="check_circle" className="text-primary-fixed text-[22px]" />
          <span className="font-body-md text-body-md font-medium">{toast.msg}</span>
        </div>
      </div>
    </div>
  )
}

export default InvestigationReports