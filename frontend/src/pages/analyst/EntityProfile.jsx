import { useState, useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import { api } from "../../lib/api.js"
import Skeleton, { useDemoLoad } from "../../components/Skeleton.jsx"

function EntityProfile() {
  const { id = "" } = useParams()
  const [account, setAccount] = useState(null)
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [freezeSent, setFreezeSent] = useState(false)
  const [freezeBusy, setFreezeBusy] = useState(false)
  const [freezeMsg, setFreezeMsg] = useState("")
  const demoLoad = useDemoLoad(500)

  useEffect(() => {
    let alive = true
    if (!id) { setLoading(false); return }
    api.account(id).then((data) => {
      if (!alive) return
      setAccount(data)
    }).catch(() => {}).finally(() => {
      if (alive) setLoading(false)
    })
    api.transactions({ account: id, limit: "500" }).then((data) => {
      if (!alive) return
      setTxns(data.items || [])
    }).catch(() => {}).finally(() => {})
    return () => { alive = false }
  }, [id])

  const filtered = txns.filter((r) =>
    `${r.txn_id || r.id} ${r.from_account || r.from} ${r.channel}`.toLowerCase().includes(query.toLowerCase())
  )

  const confirmFreeze = () => {
    setFreezeOpen(false)
    setFreezeBusy(true)
    setFreezeMsg("")
    api
      .updateAccount(id, { frozen: true, freeze_reason: "Frozen by analyst SIU review" })
      .then(() => {
        setFreezeSent(true)
        setFreezeMsg("Account freeze submitted and persisted to backend.")
      })
      .catch((err) => setFreezeMsg(`Freeze failed: ${err.message}`))
      .finally(() => setFreezeBusy(false))
  }

  const fmt = (v) => {
    try {
      const n = Number(v || 0)
      if (Math.abs(n) >= 1e7) return `₹${(n/1e7).toFixed(2)} Cr`
      if (Math.abs(n) >= 1e5) return `₹${(n/1e5).toFixed(1)} L`
      return `₹${n.toLocaleString("en-IN")}`
    } catch { return "—" }
  }

  if (demoLoad) {
    return (
      <div className="flex flex-col w-full pb-space-2xl">
        <div className="h-8 bg-surface-container-high rounded w-64 animate-pulse mb-space-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md mb-space-lg">
          {[1,2,3,4].map(i => <div key={i} className="h-36 bg-surface-container-high rounded animate-pulse" />)}
        </div>
        <div className="h-64 bg-surface-container-high rounded animate-pulse" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="flex flex-col w-full pb-space-2xl gap-space-lg">
        <div className="flex items-center gap-space-sm">
          <Link className="hover:text-primary transition-colors" to="/analyst/network-explorer">Back to Network Explorer</Link>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col items-center justify-center text-center gap-space-sm py-16">
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Account Not Found</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">{id} could not be loaded from the database.</span>
          <Link className="px-space-md py-1.5 rounded bg-primary text-on-primary font-label-sm font-semibold" to="/analyst/network-explorer">Browse Accounts</Link>
        </div>
      </div>
    )
  }

  const riskLabel = account.risk_score >= 60 ? "critical" : account.risk_score >= 40 ? "high" : account.risk_score >= 25 ? "medium" : "low"
  const totalSent = account.total_sent || 0
  const totalReceived = account.total_received || 0

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Top Forensic Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-md">
        <div className="flex items-center gap-space-sm">
          <Link className="inline-flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors font-body-sm" to="/analyst/network-explorer">
            <MaterialIcon name="arrow_back" className="text-[18px] group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Network Explorer</span>
            <span className="text-outline">/</span>
            <span className="font-semibold text-on-surface">Investigation {id}</span>
          </Link>
              <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant font-label-caps text-label-caps uppercase tracking-wider">Active Incident</span>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Link className="inline-flex items-center gap-space-xs px-space-md h-9 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-all shadow-sm font-label-sm" to="/analyst/network-explorer">
            <MaterialIcon name="hub" className="text-[18px] text-primary" />
            <span>View in Network Graph</span>
          </Link>
          <button className={`inline-flex items-center gap-space-xs px-space-md h-9 rounded shadow-sm font-label-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 ${freezeSent ? "bg-surface-container-high text-on-surface-variant" : "bg-error text-on-error hover:bg-red-700"}`} type="button" onClick={() => !freezeSent && !freezeBusy && setFreezeOpen(true)} disabled={freezeBusy}>
            <MaterialIcon name={freezeSent ? "verified" : freezeBusy ? "progress_activity" : "lock_clock"} className="text-[18px]" />
            <span>{freezeBusy ? "Freezing…" : freezeSent ? "Freeze Submitted" : "Freeze Account"}</span>
          </button>
          {freezeMsg && <span className="w-full order-last text-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><MaterialIcon name={freezeMsg.includes("failed") ? "error" : "task_alt"} className="text-[14px] text-primary" />{freezeMsg}</span>}
        </div>
      </div>

      {/* Primary Header */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm p-space-lg mb-space-lg">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <div className="flex flex-wrap items-center gap-space-sm">
              <span className="font-headline-lg text-headline-lg tracking-tight text-on-surface">{account.id}</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps text-label-caps font-bold">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                {riskLabel.toUpperCase()} · SCORE {account.risk_score}/100
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary font-label-caps text-label-caps tracking-wide">PRIMARY SUSPECT HUB</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Account {account.entity} at {account.bank} · {account.city} · Category: {account.category}
            </p>
          </div>
          <div className="flex items-center gap-space-md p-space-sm px-space-md rounded-lg bg-surface-container-low self-start lg:self-auto">
            <div className="flex flex-col text-right">
              <span className="font-label-caps text-label-caps uppercase text-outline">Total Sent</span>
              <span className="font-headline-sm text-headline-sm text-error font-bold">{fmt(totalSent)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="font-label-caps text-label-caps uppercase text-outline">Total Received</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">{fmt(totalReceived)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Entity Summary + Behavioral Baseline */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg mb-space-lg">
        <div className="xl:col-span-5 flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="flex flex-col gap-space-base">
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded bg-primary-fixed text-on-primary flex items-center justify-center">
                  <MaterialIcon name="badge" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Entity Credentials</h2>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-error/10 text-error font-label-caps text-label-caps font-semibold uppercase">Flagged for Freeze</span>
            </div>
            <div className="grid grid-cols-2 gap-space-md pt-space-xs">
              <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Account ID</span>
                <span className="font-body-md text-body-md text-on-surface font-mono mt-1 block">{account.id}</span>
              </div>
              <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Legal Entity</span>
                <span className="font-body-md text-body-md text-on-surface truncate mt-1 block">{account.entity}</span>
              </div>
              <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Account Type</span>
                <span className="font-body-md text-body-md text-on-surface mt-1 block">{account.type}</span>
              </div>
              <div className="p-space-sm rounded bg-surface-container-low flex flex-col">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Bank</span>
                <span className="font-body-md text-body-md text-on-surface mt-1 block">{account.bank} · {account.city}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-md">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded bg-secondary-container text-on-secondary-fixed flex items-center justify-center">
                  <MaterialIcon name="ssid_chart" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Behavioral Baseline</h2>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{txns.length} Transactions in Scope</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-error/10 text-error font-label-caps text-label-caps font-bold">
                <MaterialIcon name="trending_up" className="text-[14px]" />
                CRITICAL ANOMALY DETECTED
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
              <div className="flex flex-col p-space-md rounded-lg bg-surface-container-low justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase font-semibold">Total Sent</span>
                    <p className="font-numeric-lg text-numeric-lg text-error font-bold mt-1">{fmt(totalSent)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-caps text-label-caps font-bold">ANOMALOUS</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                  Account shows elevated risk score of {account.risk_score}/100 based on transaction patterns.
                </span>
              </div>
              <div className="flex flex-col p-space-md rounded-lg bg-surface-container-low justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase font-semibold">Total Received</span>
                    <p className="font-numeric-lg text-numeric-lg text-primary font-bold mt-1">{fmt(totalReceived)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-caps text-label-caps font-bold">{account.risk_score >= 40 ? "HIGH" : "ELEVATED"}</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                  Account {account.id} — {account.entity}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chronological Forensic Transaction Ledger */}
      <div className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col">
        <div className="p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold">
              <MaterialIcon name="receipt_long" className="text-[20px]" />
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Transaction Ledger</h2>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{filtered.length} Transactions</span>
            </div>
          </div>
          <div className="relative">
            <MaterialIcon name="filter_alt" className="absolute left-2.5 top-2 text-outline text-[18px]" />
            <input className="h-8 pl-8 pr-3 w-64 rounded bg-surface-container-low text-on-surface font-body-sm focus:bg-surface-container-lowest outline-none transition-colors" placeholder="Filter by Txn ID, Node, Rail..." type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-body-md text-body-sm border-collapse">
            <thead className="bg-surface-container-high font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
              <tr>
                <th className="py-2 px-space-md">Txn Reference</th>
                <th className="py-2 px-space-md">Direction</th>
                <th className="py-2 px-space-md">Counterparty</th>
                <th className="py-2 px-space-md text-right">Amount (₹)</th>
                <th className="py-2 px-space-md text-center">Rail</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {filtered.length === 0 && (
                <tr><td colSpan="5" className="py-8 text-center text-on-surface-variant font-body-sm">No transactions match the filter.</td></tr>
              )}
              {filtered.map((t) => (
                <tr key={t.txn_id || t.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-2 px-space-md font-mono font-semibold text-primary">{t.txn_id || t.id}</td>
                  <td className="py-2 px-space-md">
                    <span className={`inline-flex items-center gap-1 font-label-sm font-semibold ${t.from_account === account.id ? "text-error" : "text-emerald-700"}`}>
                      {t.from_account === account.id ? "Outflow" : "Inflow"}
                    </span>
                  </td>
                  <td className="py-2 px-space-md font-mono">
                    {t.from_account === account.id ? t.to_account : t.from_account}
                  </td>
                  <td className="py-2 px-space-md text-right font-numeric-md text-numeric-md font-bold">{fmt(t.amount)}</td>
                  <td className="py-2 px-space-md text-center">{t.channel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Freeze Confirmation Modal */}
      {freezeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md" onClick={() => setFreezeOpen(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md p-space-lg flex flex-col gap-space-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-space-xs">
              <MaterialIcon name="lock_clock" className="text-[20px] text-error" />
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">Freeze {account.id}?</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              This submits a freeze request for {account.entity} ({account.bank} · {account.city}) to the compliance queue for dual authorization.
            </p>
            <div className="flex justify-end gap-space-xs">
              <button className="px-space-md py-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold transition-colors cursor-pointer" type="button" onClick={() => setFreezeOpen(false)}>Cancel</button>
              <button className="px-space-md py-1.5 rounded bg-error text-on-error font-label-sm text-label-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer" type="button" onClick={confirmFreeze}>{freezeBusy ? "Freezing…" : "Confirm Freeze"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EntityProfile