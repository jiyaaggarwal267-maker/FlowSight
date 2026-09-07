import { useRef, useState, useEffect } from "react"
import { api } from "../../lib/api.js"

const ROLE_DEFS = [
  { key: "all", label: "All" },
  { key: "senior-analyst", label: "Senior Analyst" },
  { key: "analyst", label: "L1 Analyst" },
  { key: "compliance", label: "Compliance" },
  { key: "admin", label: "Admin" },
]

const ROLE_OPTIONS = [
  "L1 Analyst (Triage & Intake)",
  "Senior Analyst (L2) (Forensic Graph Lead)",
  "Compliance Director (Regulatory Signoff)",
  "Admin (Full System Privilege)",
]

const ENTITY_OPTIONS = [
  "FlowSight National Clearing Node (Primary)",
  "FIU Special Enforcement Unit",
  "Cross-Border Remittance Clearing",
  "UPI High-Frequency Monitoring Division",
]

const SCOPES = [
  { granted: true, label: "Read-write Graph Visualizer & Transaction Ledger" },
  { granted: true, label: "STR/SAR Generation to Central Compliance Gate" },
  { granted: false, label: "Root Policy Mutation (Admin Only)" },
]

function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState(ROLE_OPTIONS[1])
  const [entity, setEntity] = useState(ENTITY_OPTIONS[0])
  const [submitting, setSubmitting] = useState(false)
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
      .users()
      .then((d) => {
        if (!alive) return
        setUsers(d.items || [])
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setLoading(false)
        showToast(`Failed to load users: ${err.message}`)
      })
    return () => {
      alive = false
    }
  }, [])

  const roleCount = (key) => (key === "all" ? users.length : users.filter((u) => u.role_key === key).length)
  const ROLES = ROLE_DEFS.map((r) => ({ ...r, count: roleCount(r.key) }))

  const ROLE_STYLE = {
    "senior-analyst": { roleClass: "bg-secondary-container text-on-secondary-fixed", roleDot: "bg-primary-container", avatar: "bg-secondary-fixed text-on-secondary-fixed" },
    analyst: { roleClass: "bg-surface-container-high text-on-surface", roleDot: "bg-secondary", avatar: "bg-secondary text-on-secondary" },
    compliance: { roleClass: "bg-tertiary-fixed text-on-tertiary-fixed", roleDot: "bg-tertiary", avatar: "bg-tertiary-fixed text-on-tertiary-fixed" },
    admin: { roleClass: "bg-primary-fixed text-on-primary-fixed", roleDot: "bg-primary", avatar: "bg-primary text-on-primary" },
  }

  const fmtActive = (iso) => {
    if (!iso) return "—"
    const d = new Date(iso)
    const now = Date.now()
    const mins = Math.max(1, Math.round((now - d.getTime()) / 60000))
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
    return `${Math.round(hrs / 24)} day${Math.round(hrs / 24) === 1 ? "" : "s"} ago`
  }

  const usernames = (u) => `${u.name} ${u.email} ${u.unit} ${u.role || ""}`

  const filtered = users
    .map((u) => {
      const style = ROLE_STYLE[u.role_key] || ROLE_STYLE.analyst
      const initials = (u.name || u.username || "—").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || (u.username || "—").slice(0, 2).toUpperCase()
      return {
        ...u,
        initials,
        roleKey: u.role_key,
        roleClass: style.roleClass,
        roleDot: style.roleDot,
        avatar: style.avatar,
        unitIcon: "domain",
        status: String(u.status || "active").toUpperCase(),
        statusClass: String(u.status) === "active" ? "bg-emerald-50 text-emerald-800" : "bg-surface-container-high text-on-surface-variant",
        statusDot: String(u.status) === "active" ? "bg-emerald-500" : "bg-outline",
        pulse: String(u.status) === "active",
        lastActive: fmtActive(u.last_active),
        inv: "—",
        invClass: "bg-surface-container text-on-surface-variant",
        canDeactivate: u.role_key !== "admin",
      }
    })
    .filter(
      (u) =>
        (activeFilter === "all" || u.roleKey === activeFilter) &&
        (query === "" || usernames(u).toLowerCase().includes(query.toLowerCase()))
    )

  const submitInvite = async () => {
    const recipient = name.trim() || "Rohini Deshmukh"
    const mail = email.trim() || "r.deshmukh@flowsight.internal"
    const roleKey = role.includes("Senior") ? "senior-analyst" : role.includes("Compliance") ? "compliance" : role.startsWith("Admin") ? "admin" : "analyst"
    setSubmitting(true)
    try {
      const created = await api.createUser({
        name: recipient,
        email: mail,
        role: role.replace(/\s*\(.*\)/, "").trim() || recipient,
        role_key: roleKey,
        unit: entity.includes("National Clearing") ? "National Clearing Node" : entity.includes("Enforcement") ? "FIU Special Enforcement Unit" : entity.includes("Remittance") ? "Cross-Border Remittance Clearing" : "UPI High-Frequency Monitoring Division",
      })
      setUsers((prev) => [created, ...prev])
      setDrawerOpen(false)
      setName("")
      setEmail("")
      setRole(ROLE_OPTIONS[1])
      setEntity(ENTITY_OPTIONS[0])
      showToast(`Invitation dispatched to ${recipient} · ${mail}`)
    } catch (err) {
      showToast(`Invite failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Role", "Role Key", "Unit", "Status", "Last Active"],
      ...users.map((u) => [u.name, u.email, u.role, u.role_key, u.unit, u.status, u.last_active]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `roster_${users.length}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`User roster exported · roster_${users.length}.csv`)
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Visual Ambient Gradient Scrim */}
      <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm mb-space-lg p-space-lg">
        <div className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-secondary-container/40 blur-3xl pointer-events-none"></div>
        <div className="absolute right-72 -bottom-28 w-72 h-72 rounded-full bg-primary-fixed/30 blur-2xl pointer-events-none"></div>
        {/* Header & Top Level KPI Teletype */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-secondary uppercase tracking-widest mb-space-xs">
              <span>Identity Governance</span>
              <span className="text-outline-variant">•</span>
              <span className="text-primary font-semibold">Directory v4.18</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Users & Roles</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs max-w-xl">
              Manage analyst access and platform permissions across active financial crime investigation units.
            </p>
          </div>
          {/* Quick Metrics Ribbon */}
          <div className="flex items-center gap-space-base">
            <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-xs rounded shadow-sm">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps text-secondary uppercase">Active Users</span>
                <span className="font-numeric-md text-numeric-md text-on-surface font-semibold">{users.length} {loading ? "…" : "Enrolled"}</span>
              </div>
            </div>
            <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-xs rounded shadow-sm">
              <span className="material-symbols-outlined text-[18px] text-primary">security_update_good</span>
              <div className="flex flex-col">
                <span className="font-label-caps text-label-caps text-secondary uppercase">Enforce 2FA</span>
                <span className="font-numeric-md text-numeric-md text-on-surface font-semibold">100% Policy</span>
              </div>
            </div>
            <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-space-xs bg-primary-container hover:bg-primary text-on-primary px-space-base py-space-sm rounded font-headline-sm text-headline-sm shadow-sm transition-all">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>
      {/* Command Control Bar: Search & Role Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md mb-space-base bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
        {/* Search Box */}
        <div className="relative flex items-center flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-space-sm text-outline text-[18px]">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 rounded bg-surface-container-low text-on-surface font-body-md text-body-md placeholder-outline focus:outline-none focus:bg-surface-container-lowest shadow-sm transition-all"
            placeholder="Search users by name, email, or institutional unit..."
            type="text"
          />
          <span className="absolute right-space-sm font-label-caps text-label-caps text-outline bg-surface-container-high px-1 py-0.5 rounded">⌘K</span>
        </div>
        {/* Filter Switches & Export Action */}
        <div className="flex flex-wrap items-center gap-space-xs">
          <span className="font-label-caps text-label-caps text-secondary uppercase mr-space-xs">Role Filter:</span>
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setActiveFilter(r.key)}
              className={[
                "px-space-sm py-space-2xs rounded font-label-sm text-label-sm transition-colors",
                activeFilter === r.key ? "bg-primary-container text-on-primary shadow-sm" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              ].join(" ")}
            >
              {r.label} ({r.count})
            </button>
          ))}
          <div className="w-px h-6 bg-surface-container-highest mx-space-2xs"></div>
          <button onClick={exportCsv} title="Export User Roster" className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm transition-colors">
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>
      {/* Users Table Card */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-caps text-label-caps uppercase tracking-wider h-9">
                <th className="pl-space-base pr-space-sm font-semibold">Name & Profile</th>
                <th className="px-space-sm font-semibold">Assigned Role</th>
                <th className="px-space-sm font-semibold">Institutional Unit</th>
                <th className="px-space-sm font-semibold">Status</th>
                <th className="px-space-sm font-semibold">Last Active</th>
                <th className="px-space-sm font-semibold text-right">Investigations</th>
                <th className="pr-space-base pl-space-sm font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-body-md text-body-md text-on-surface">
              {filtered.map((u) => (
                <tr key={u.email} className="hover:bg-surface-container-low/60 transition-colors group h-table-row-h">
                  <td className="pl-space-base pr-space-sm py-space-xs">
                    <div className="flex items-center gap-space-sm">
                      <div className={`w-8 h-8 rounded-full ${u.avatar} flex items-center justify-center font-label-sm text-label-sm font-semibold shadow-sm ring-1 ring-surface-container-high`}>{u.initials}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold group-hover:text-primary transition-colors truncate">{u.name}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-space-sm py-space-xs">
                    <span className={`inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${u.roleClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.roleDot}`}></span>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-space-sm py-space-xs">
                    <div className="flex items-center gap-space-2xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">{u.unitIcon}</span>
                      <span>{u.unit}</span>
                    </div>
                  </td>
                  <td className="px-space-sm py-space-xs">
                    <span className={`inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full font-label-caps text-label-caps font-semibold ${u.statusClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.statusDot} ${u.pulse ? "animate-ping" : ""}`}></span>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface-variant">{u.lastActive}</td>
                  <td className="px-space-sm py-space-xs text-right">
                    <span className={`inline-block px-space-xs py-0.5 rounded font-numeric-md text-numeric-md ${u.invClass} ${u.inv === "0 (Admin)" ? "" : "font-semibold"}`}>{u.inv}</span>
                  </td>
                  <td className="pr-space-base pl-space-sm py-space-xs text-right">
                    <div className="inline-flex items-center gap-space-2xs opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => showToast(`Activity log open · ${u.name}`)} title="View Activity Log" className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[18px]">history</span>
                      </button>
                      <button onClick={() => showToast(`Edit role & scopes · ${u.name}`)} title="Edit Role & Scopes" className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[18px]">edit_square</span>
                      </button>
                      {u.canDeactivate ? (
                        <button onClick={() => showToast(`Deactivation flagged for review · ${u.name}`)} title="Deactivate User" className="p-1 rounded hover:bg-error-container text-error transition-colors">
                          <span className="material-symbols-outlined text-[18px]">person_off</span>
                        </button>
                      ) : (
                        <button className="p-1 rounded text-outline-variant cursor-not-allowed" disabled="" title="Cannot deactivate root admin">
                          <span className="material-symbols-outlined text-[18px]">lock</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {loading && (
                <tr><td colSpan="7" className="px-space-base py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">Loading credentialed platform users…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="7" className="px-space-base py-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">No users match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Table Footer with Pagination & Summary */}
        <div className="flex items-center justify-between px-space-base py-space-sm bg-surface-container-lowest">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
            <span>Showing <strong className="text-on-surface">{filtered.length}</strong> of <strong className="text-on-surface">{users.length}</strong> credentialed platform users</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <button className="p-1 rounded bg-surface-container-low text-outline-variant cursor-not-allowed" disabled="">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button onClick={() => showToast(`Page 1 of ${Math.max(1, users.length)} roster`)} className="w-7 h-7 rounded bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center justify-center font-semibold">1</button>
            <button onClick={() => showToast("Page 2 of 8 roster")} className="w-7 h-7 rounded hover:bg-surface-container text-on-surface-variant font-label-sm text-label-sm flex items-center justify-center transition-colors">2</button>
            <button onClick={() => showToast("Page 3 of 8 roster")} className="w-7 h-7 rounded hover:bg-surface-container text-on-surface-variant font-label-sm text-label-sm flex items-center justify-center transition-colors">3</button>
            <button onClick={() => showToast("Page 4 of 8 roster")} className="p-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
      {/* Slide-out Drawer: Add User Dialog Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-on-background/30 backdrop-blur-sm z-50">
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-surface-container-lowest shadow-2xl flex flex-col justify-between">
            {/* Drawer Header */}
            <div className="p-space-lg bg-surface-container-low flex items-start justify-between">
              <div>
                <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-primary uppercase font-semibold">
                  <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                  <span>Identity Provisioning</span>
                </div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">Add Platform User</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Issue signed cryptographic credentials and assign investigation nodes.</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-space-xs rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {/* Drawer Form Body */}
            <div className="p-space-lg flex-1 overflow-y-auto flex flex-col gap-space-base">
              {/* Field 1: Full Name */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-sm text-label-sm text-on-surface font-medium flex items-center justify-between">
                  <span>Full Legal Name</span>
                  <span className="text-error font-label-caps text-label-caps">Required</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-space-sm text-outline text-[18px]">badge</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-9 pl-9 pr-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-sm transition-all" placeholder="e.g. Rohini Deshmukh" type="text" />
                </div>
              </div>
              {/* Field 2: Institutional Email */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-sm text-label-sm text-on-surface font-medium flex items-center justify-between">
                  <span>Institutional Email</span>
                  <span className="text-error font-label-caps text-label-caps">Required</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-space-sm text-outline text-[18px]">alternate_email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-9 pl-9 pr-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-sm transition-all" placeholder="r.deshmukh@flowsight.internal" type="email" />
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Must belong to an approved institutional whitelist domain.</span>
              </div>
              {/* Field 3: Role Dropdown */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-sm text-label-sm text-on-surface font-medium">Platform Role & Access Tier</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-space-sm text-outline text-[18px]">shield</span>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-9 pl-9 pr-8 rounded bg-surface-container-low text-on-surface font-body-md text-body-md appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-sm cursor-pointer transition-all">
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-space-sm text-outline text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
              {/* Field 4: Bank Entity Assignment */}
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-sm text-label-sm text-on-surface font-medium">Bank Entity Assignment</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-space-sm text-outline text-[18px]">account_balance</span>
                  <select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-full h-9 pl-9 pr-8 rounded bg-surface-container-low text-on-surface font-body-md text-body-md appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-sm cursor-pointer transition-all">
                    {ENTITY_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-space-sm text-outline text-[18px] pointer-events-none">expand_more</span>
                </div>
              </div>
              {/* Security Scopes Checkboxes */}
              <div className="bg-surface-container-low p-space-sm rounded flex flex-col gap-space-xs mt-space-2xs">
                <span className="font-label-caps text-label-caps text-secondary uppercase font-semibold">Default Granted Scopes:</span>
                {SCOPES.map((s) => (
                  <div key={s.label} className={`flex items-center gap-space-xs font-body-sm text-body-sm ${s.granted ? "text-on-surface" : "text-outline"}`}>
                    {s.granted ? (
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">radio_button_unchecked</span>
                    )}
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Drawer Actions Footer */}
            <div className="p-space-lg bg-surface-container-low flex items-center justify-end gap-space-sm">
              <button onClick={() => setDrawerOpen(false)} className="px-space-base py-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold transition-colors">
                Cancel
              </button>
              <button onClick={submitInvite} disabled={submitting} className="flex items-center gap-space-xs px-space-base py-space-sm rounded bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm shadow-sm transition-all disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">key</span>
                <span>{submitting ? "Provisioning…" : "Send Invite & Generate Token"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Minimal Feedback Toast Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-space-base py-space-sm rounded shadow-lg flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">verified</span>
          <span className="font-body-md text-body-md">{toast}</span>
        </div>
      )}
    </div>
  )
}

export default AdminUsers