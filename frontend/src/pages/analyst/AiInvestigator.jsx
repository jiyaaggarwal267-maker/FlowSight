import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import { api } from "../../lib/api.js"
import { inrToWords, TTS_LANGUAGES, getTtsLanguage, persistTtsLanguage } from "../../lib/runtime.js"

const PRESETS = [
  { icon: "psychology", text: "Why was this network flagged?" },
  { icon: "route", text: "Show shortest path between AC-20491 and AC-19281" },
  { icon: "account_tree", text: "Trace all outflows from AC-84729 in last 72 hours" },
  { icon: "radar", text: "Detect smurfing patterns under ₹5L threshold" },
  { icon: "fingerprint", text: "Compare device fingerprint overlaps across mule nodes" },
]

function AiInvestigator() {
  const [searchParams] = useSearchParams()
  const investigationId = searchParams.get("id") || ""
  
  const [query, setQuery] = useState("Why was this network flagged and what is the primary layering scheme?")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showGuide, setShowGuide] = useState(true)
  const [toast, setToast] = useState({ msg: "", visible: false })
  const [appendBusy, setAppendBusy] = useState(false)
  const [ttsState, setTtsState] = useState("")
  const [ttsError, setTtsError] = useState("")
  const [ttsLanguage, setTtsLanguage] = useState(getTtsLanguage)
  const toastTimer = useRef(null)
  const inputRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => () => { clearTimeout(toastTimer.current); audioRef.current?.pause() }, [])

  const changeTtsLanguage = (code) => {
    setTtsLanguage(code)
    persistTtsLanguage(code)
  }

  const showToast = (msg) => {
    setToast({ msg, visible: true })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3200)
  }

  const submitAnalysis = async (e) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    
    stopAudio()
    setLoading(true)
    try {
      const data = await api.aiQuery({
        question: query,
        investigation_id: investigationId
      })
      setResult(data)
      setShowGuide(false)
    } catch (err) {
      showToast(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const appendFindings = async () => {
    if (!result || appendBusy) return
    setAppendBusy(true)
    try {
      await api.appendFinding(investigationId, {
        finding: result.finding || query,
        evidence: Array.isArray(result.evidence) ? result.evidence.join(", ") : String(result.evidence || ""),
        patterns: Array.isArray(result.patterns) ? result.patterns : [],
        risk_score: result.risk_score,
      })
      showToast(`Findings appended to ${investigationId} dossier.`)
    } catch (err) {
      showToast(`Append failed: ${err.message}`)
    } finally {
      setAppendBusy(false)
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setTtsState("")
    setTtsError("")
  }

  const buildNarration = (res) => {
    const evs = Array.isArray(res?.evidence) ? res.evidence : []
    const lines = []
    if (res?.finding) lines.push(`Finding: ${res.finding}`)
    if (evs.length) {
      const evLines = evs.slice(0, 4).map((ev, i) => {
        const parts = []
        if (ev.txn_id) parts.push(ev.txn_id)
        if (ev.amount > 0) parts.push(inrToWords(ev.amount))
        if (ev.from && ev.to) parts.push(`from ${ev.from} to ${ev.to}`)
        else if (ev.detail) parts.push(ev.detail)
        return `item ${i + 1}: ${parts.join(", ")}`
      })
      if (evs.length > 4) evLines.push(`and ${evs.length - 4} more traced items`)
      lines.push(`Evidence: ${evLines.join(". ")}`)
    }
    return lines.join(". ")
  }

  const readAloud = async () => {
    if (!result || ttsState === "generating") return
    if (ttsState === "playing") { stopAudio(); return }
    setTtsError("")
    const text = buildNarration(result)
    if (!text) { showToast("Nothing to read for this response."); return }
    setTtsState("generating")
    try {
      const blob = await api.speak(text, ttsLanguage)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (audioRef.current === audio) audioRef.current = null
        setTtsState("")
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (audioRef.current === audio) audioRef.current = null
        setTtsState("")
        setTtsError("Audio playback failed. Please try again.")
      }
      await audio.play()
      setTtsState("playing")
    } catch (err) {
      setTtsState("")
      setTtsError(err.message || "Unable to generate audio.")
    }
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Investigation Scope & Status Ribbon */}
      <section className="w-full mb-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-space-md p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-wrap items-center gap-space-md min-w-0">
            <div className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-secondary-container text-on-secondary-fixed-variant">
              <MaterialIcon name="terminal" className="text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Active Workspace</span>
            </div>
            <div className="h-4 w-px bg-surface-container-highest"></div>
            <div className="flex items-center gap-space-xs">
              <MaterialIcon name="folder_open" className="text-[18px] text-primary" />
              <span className="font-headline-sm text-headline-sm text-on-surface">
                {investigationId ? `Investigation ${investigationId}` : "General Network Analysis"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-error-container text-on-error-container font-label-caps text-label-caps">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              <span>LIVE DATA STREAM</span>
            </div>
          </div>
        </div>
        {/* Page Title & Operational Premise */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm pt-space-xs px-space-xs">
          <div>
            <div className="flex items-center gap-space-xs mb-1">
              <span className="font-label-caps text-label-caps tracking-widest text-primary uppercase">Forensic Intelligence Engine</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-caps text-[10px]">COGNITIVE-v4.1</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">AI Investigator</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Ask deterministically audited queries across entity relationship graphs, hardware fingerprint trails, and cross-rail settlement flows.</p>
          </div>
        </div>
      </section>

      {/* Query Formulation Center */}
      <section className="w-full mb-space-xl">
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-md">
          <form className="flex flex-col gap-space-md" onSubmit={submitAnalysis}>
            <div className="relative flex items-center">
              <div className="absolute left-space-md flex items-center gap-space-xs text-primary pointer-events-none">
                <MaterialIcon name="troubleshoot" className="text-[24px]" />
              </div>
              <input ref={inputRef} className="w-full h-14 pl-12 pr-28 sm:pl-14 sm:pr-36 rounded-lg bg-surface-container-low text-on-surface font-body-md sm:font-body-lg text-body-md sm:text-body-lg placeholder-outline focus:outline-none focus:bg-surface-container-lowest focus:shadow-sm transition-all" placeholder="Ask about this network or forensic anomalies..." type="text" value={query} onChange={(e) => setQuery(e.target.value)} disabled={loading} />
              <div className="absolute right-space-sm flex items-center gap-space-xs">
                {query && !loading && (
                  <button className="p-2 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer" title="Clear query" type="button" onClick={() => { setQuery(""); inputRef.current?.focus() }}>
                    <MaterialIcon name="close" className="text-[18px]" />
                  </button>
                )}
                <button className="flex items-center justify-center gap-space-xs h-10 w-10 px-0 sm:h-10 sm:w-auto sm:px-space-lg rounded bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary-container active:scale-[0.98] shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none" type="submit" disabled={loading || !query}>
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <MaterialIcon name="auto_awesome" className="text-[18px]" />
                  )}
                  <span className="hidden sm:inline">{loading ? "Analyzing..." : "Analyze"}</span>
                </button>
              </div>
            </div>
            {/* Query Presets & Hypotheses Chips */}
            <div className="flex flex-col gap-space-xs pt-space-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Suggested Hypothesis &amp; Graph Inquiries</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-space-xs">
                {PRESETS.map((p) => (
                  <button key={p.text} className="group flex items-center gap-1.5 px-space-sm py-1.5 rounded-full bg-surface-container-low hover:bg-secondary-container hover:text-on-secondary-fixed text-on-surface active:scale-[0.98] font-body-sm text-body-sm transition-all text-left shadow-sm cursor-pointer" type="button" onClick={() => setQuery(p.text)} disabled={loading}>
                    <MaterialIcon name={p.icon} className="text-[14px] text-primary group-hover:text-primary transition-colors" />
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Primary Intelligence Findings Workspace */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {result ? (
          <div className="xl:col-span-12 flex flex-col gap-space-lg">
            <article className="p-space-lg rounded-xl bg-surface-container-lowest shadow-md flex flex-col gap-space-lg">
              <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm bg-surface-container-low/40 p-space-md rounded-lg">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
                    <MaterialIcon name="policy" className="text-[20px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-space-xs">
                      <h2 className="font-headline-md text-headline-md text-on-surface">Forensic Synthesis Report</h2>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-caps text-label-caps font-semibold">GROUNDED IN REAL DATA</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {ttsError && <span className="font-body-sm text-body-sm text-error">{ttsError}</span>}
                  <div className="flex items-center gap-space-sm">
                    <div className="relative flex items-center">
                      <MaterialIcon name="translate" className="absolute left-2 text-on-surface-variant text-[16px] pointer-events-none" />
                      <select
                        className="h-9 pl-8 pr-7 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm outline-none hover:bg-surface-container transition-colors cursor-pointer appearance-none"
                        value={ttsLanguage}
                        onChange={(e) => changeTtsLanguage(e.target.value)}
                        disabled={ttsState === "generating" || ttsState === "playing"}
                        title="Read aloud language"
                        aria-label="Read aloud language"
                      >
                        {Object.entries(TTS_LANGUAGES).map(([code, name]) => (
                          <option key={code} value={code}>{name}</option>
                        ))}
                      </select>
                      <MaterialIcon name="expand_more" className="absolute right-1.5 text-on-surface-variant text-[16px] pointer-events-none" />
                    </div>
                    <button className={`h-9 flex items-center gap-space-xs pl-space-sm pr-space-base rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:pointer-events-none ${ttsState === "playing" ? "text-primary" : ""}`} type="button" onClick={readAloud} disabled={ttsState === "generating"}>
                      {ttsState === "generating" ? (
                        <div className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <MaterialIcon name="volume_up" className="text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} />
                      )}
                      <span>{ttsState === "generating" ? "Generating audio…" : ttsState === "playing" ? "🔊 Playing…" : "🔊 Read Aloud"}</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs">
                  <MaterialIcon name="verified_user" className="text-primary text-[18px]" />
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">01. Key Finding</span>
                </div>
                <div className="p-space-md rounded-lg bg-surface-container-low text-on-surface font-body-lg text-body-lg leading-relaxed shadow-sm">
                  <p>{result.finding}</p>
                </div>
              </div>

              {result.evidence && result.evidence.length > 0 && (
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <MaterialIcon name="fact_check" className="text-primary text-[18px]" />
                      <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">02. Cited Evidence</span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{result.evidence.length} trace items</span>
                  </div>
                  {result.evidence.map((ev, idx) => (
                    <div key={idx} className="group p-space-md rounded-lg bg-surface-container-lowest hover:bg-surface-container-low shadow-sm transition-all border border-surface-container">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                        <div className="flex items-start gap-space-sm min-w-0">
                          <div className="p-2 rounded bg-surface-container text-primary mt-0.5">
                            <MaterialIcon name={ev.txn_id ? "north_east" : "info"} className="text-[20px]" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-wrap items-center gap-space-xs">
                              {ev.txn_id && <span className="font-headline-sm text-headline-sm text-on-surface font-mono">{ev.txn_id}</span>}
                              {ev.detail && <span className="font-body-md text-body-md text-on-surface-variant italic">"{ev.detail}"</span>}
                            </div>
                            {(ev.from || ev.to) && (
                              <div className="flex items-center gap-space-xs mt-1 font-body-md text-body-md text-on-surface">
                                <span className="font-mono font-medium text-primary">{ev.from}</span>
                                <MaterialIcon name="arrow_forward" className="text-[16px] text-outline" />
                                <span className="font-mono font-medium text-on-surface">{ev.to}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {ev.amount > 0 && (
                          <div className="text-right">
                            <span className="font-numeric-lg text-numeric-lg text-on-surface">{formatCurrency(ev.amount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-space-sm pt-space-md">
                {investigationId && (
                  <button className="flex items-center gap-space-xs px-space-base py-2.5 rounded bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary-container shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60" type="button" onClick={appendFindings} disabled={appendBusy}>
                    <MaterialIcon name="post_add" className="text-[18px]" />
                    <span>{appendBusy ? "Appending…" : "Append Findings to Dossier"}</span>
                  </button>
                )}
                {investigationId && (
                  <button className="flex items-center gap-space-xs px-space-base py-2.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-headline-sm text-headline-sm transition-colors cursor-pointer" type="button" onClick={async () => {
                    try {
                      await api.generateReport({ investigation_id: investigationId });
                      showToast(`Statutory SAR draft generated for ${investigationId}.`);
                    } catch (err) {
                      showToast(`Report generation failed: ${err.message}`);
                    }
                  }}>
                    <MaterialIcon name="assignment_late" className="text-[18px] text-error" />
                    <span>Generate Statutory SAR Draft</span>
                  </button>
                )}
              </div>
            </article>
          </div>
        ) : (
          <div className="xl:col-span-12 p-space-xl text-center flex flex-col items-center gap-space-md bg-surface-container-lowest rounded-xl shadow-sm">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">
              <MaterialIcon name="psychology" className="text-[40px]" />
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Awaiting Inquiry</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Select a preset or enter a custom question to begin forensic synthesis.</p>
            </div>
          </div>
        )}
      </section>

      {/* Notification Toast Container */}
      <div className={`fixed bottom-space-lg right-space-lg z-50 transform transition-all duration-300 ${toast.visible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-space-sm px-space-lg py-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-xl">
          <MaterialIcon name="check_circle" className="text-primary-fixed text-[22px]" />
          <span className="font-body-md text-body-md font-medium">{toast.msg}</span>
        </div>
      </div>
    </div>
  )
}

export default AiInvestigator