import { useState } from "react"
import MaterialIcon from "./MaterialIcon.jsx"
import { getTheme, setTheme } from "../lib/runtime.js"

const TABS = [
  { key: "profile", label: "Profile", icon: "badge" },
  { key: "preferences", label: "Preferences", icon: "tune" },
  { key: "notifications", label: "Notifications", icon: "notifications_none" },
  { key: "security", label: "Security", icon: "lock" },
]

const NOTIF_OPTIONS = [
  { key: "alerts", label: "High-risk alert escalation", desc: "P1/P2 escalations and new circular-flow detections", on: true },
  { key: "cases", label: "Case assignments", desc: "When investigations are routed to your queue", on: true },
  { key: "rules", label: "Rule dry-runs & tweaks", desc: "AutoTune suggestions and sandbox outcomes", on: false },
  { key: "health", label: "System health events", desc: "Pipeline latency and connector degradation", on: true },
]

const SESSIONS = [
  { label: "Analyst Workstation", meta: "Mumbai · Chrome 126 · macOS", active: true },
  { label: "FLOWSIGHT Mobile", meta: "Mumbai · iOS 18", active: false },
]

function Toggle({ on, onToggle, disabled = false }) {
  return (
    <button
      aria-checked={on}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none ${on ? "bg-primary-container" : "bg-surface-container-highest"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-[2px]"}`}></span>
    </button>
  )
}

function CheckRow({ label, desc, on, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-space-md p-space-md rounded-lg bg-surface-container-low">
      <div className="flex flex-col min-w-0">
        <span className="font-headline-sm text-headline-sm text-on-surface">{label}</span>
        <span className="font-body-sm text-body-sm text-on-surface-variant">{desc}</span>
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  )
}

export default function SettingsPage({ user, workspace, roleTag }) {
  const [tab, setTab] = useState("profile")
  const [notifs, setNotifs] = useState(() => Object.fromEntries(NOTIF_OPTIONS.map((n) => [n.key, n.on])))
  const [prefs, setPrefs] = useState({ density: "Cozy", landing: "Overview" })
  const [mfa, setMfa] = useState(true)
  const [theme, setThemeState] = useState(() => getTheme())
  const [toast, setToast] = useState(null)
  const [profile, setProfile] = useState(user)

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3200)
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-lg">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex items-center gap-space-xs">
            <span className="px-space-xs py-0.5 rounded bg-secondary-container text-on-secondary-fixed-variant font-label-caps text-label-caps uppercase tracking-wider">{roleTag}</span>
            <span className="text-outline text-body-sm">/</span>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Account</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">Settings</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Manage your {workspace} profile, preferences, and security.</p>
        </div>
        <span className="hidden md:flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-lowest shadow-sm font-label-caps text-label-caps text-on-surface-variant uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Signed in · {user.name}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-space-lg items-start">
        {/* Tab rail */}
        <div className="w-full lg:w-56 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-space-sm whitespace-nowrap px-space-md py-2 rounded-lg font-body-md text-body-md transition-colors cursor-pointer ${
                tab === t.key ? "bg-primary-container text-on-primary font-semibold" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
              type="button"
            >
              <MaterialIcon className="text-[18px]" name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="flex-1 min-w-0 w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-lg">
          {tab === "profile" && (
            <div className="flex flex-col gap-space-lg animate-page-in">
              <div className="flex items-center gap-space-md">
                <div className="w-16 h-16 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center font-headline-md text-headline-md font-semibold shadow-sm">
                  {profile.initials}
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-md text-headline-md text-on-surface font-semibold">{profile.name}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{profile.role} · {profile.region}</span>
                  <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider mt-0.5">{profile.org}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">Full name</label>
                  <input className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setProfile({ ...profile, name: e.target.value })} value={profile.name} type="text" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">Work email</label>
                  <input className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setProfile({ ...profile, email: e.target.value })} value={profile.email} type="email" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">Mobile</label>
                  <input className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setProfile({ ...profile, phone: e.target.value })} value={profile.phone} type="tel" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">Region</label>
                  <select className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setProfile({ ...profile, region: e.target.value })} value={profile.region}>
                    {["Mumbai", "Bengaluru", "Delhi NCR", "Pune", "Hyderabad", "Remote"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                <button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-sm cursor-pointer" onClick={() => showToast("Profile updated · audit trail written")} type="button">
                  Save Profile
                </button>
              </div>
            </div>
          )}

          {tab === "preferences" && (
            <div className="flex flex-col gap-space-lg animate-page-in">
              <div className="flex items-center justify-between gap-space-md">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Appearance</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Choose the theme used across {workspace}.</span>
                </div>
                <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-lg">
                  <button
                    className={`px-space-md py-1 rounded font-label-sm text-label-sm transition-colors cursor-pointer ${theme === "light" ? "bg-surface-container-lowest text-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                    onClick={() => {
                      setThemeState("light")
                      setTheme("light")
                    }}
                    type="button"
                  >
                    Light
                  </button>
                  <button
                    className={`px-space-md py-1 rounded font-label-sm text-label-sm transition-colors cursor-pointer ${theme === "dark" ? "bg-surface-container-lowest text-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                    onClick={() => {
                      setThemeState("dark")
                      setTheme("dark")
                    }}
                    type="button"
                  >
                    Dark
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">UI density</label>
                  <select className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setPrefs({ ...prefs, density: e.target.value })} value={prefs.density}>
                    {["Compact", "Cozy", "Comfortable"].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">Default landing page</label>
                  <select className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary" onChange={(e) => setPrefs({ ...prefs, landing: e.target.value })} value={prefs.landing}>
                    {["Overview", "Network Explorer", "Alerts", "Flow Timeline"].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Workspace behavior</span>
                <CheckRow desc="Press ⌘K anywhere to open the navigator." label="Command palette" on onToggle={() => showToast("Palette shortcut preference updated")} />
                <CheckRow desc="Play subtle animations on data changes and navigation." label="Motion & transitions" on onToggle={() => showToast("Motion preference updated")} />
                <CheckRow desc="Push simulated alert events to the live feed and bell." label="Live demo telemetry feed" on onToggle={() => showToast("Live feed preference updated")} />
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="flex flex-col gap-space-sm animate-page-in">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Email & in-app alerts</span>
              {NOTIF_OPTIONS.map((n) => (
                <CheckRow key={n.key} desc={n.desc} label={n.label} on={notifs[n.key]} onToggle={() => setNotifs({ ...notifs, [n.key]: !notifs[n.key] })} />
              ))}
              <div className="flex items-center justify-end pt-space-xs">
                <button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-sm cursor-pointer" onClick={() => showToast("Notification preferences saved")} type="button">
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="flex flex-col gap-space-lg animate-page-in">
              <div className="flex flex-col gap-space-md p-space-md rounded-lg bg-surface-container-low">
                <span className="font-headline-sm text-headline-sm text-on-surface">Change password</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                  <input className="h-9 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Current password" type="password" />
                  <input className="h-9 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="New password" type="password" />
                  <input className="h-9 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Confirm new password" type="password" />
                </div>
                <button className="self-end px-space-md py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer" onClick={() => showToast("Password change cannot be simulated in the demo workspace")} type="button">
                  Update Password
                </button>
              </div>
              <CheckRow desc="Require a second factor on sign-in from new devices." label="Two-factor authentication (TOTP)" on={mfa} onToggle={() => setMfa(!mfa)} />
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Active sessions</span>
                {SESSIONS.map((s) => (
                  <div key={s.label} className="flex items-center justify-between p-space-md rounded-lg bg-surface-container-low">
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">{s.label}</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{s.meta}</span>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-label-caps text-label-caps font-semibold ${s.active ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container-high text-on-surface-variant"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.active ? "bg-primary" : "bg-outline"}`}></span>
                      {s.active ? "Active now" : "Idle"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-space-base py-2.5 rounded-lg bg-on-surface text-surface-container-low shadow-lg transition-transform duration-300 translate-y-0 animate-page-in">
          <MaterialIcon name="task_alt" className="text-[18px]" />
          <span className="font-label-sm text-label-sm">{toast}</span>
        </div>
      )}
    </div>
  )
}