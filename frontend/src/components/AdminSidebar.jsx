import { NavLink } from "react-router-dom"
import MaterialIcon from "./MaterialIcon.jsx"

const NAV_ITEMS = [
  { to: "/admin/overview", end: true, label: "Admin Overview", icon: "dashboard" },
  { to: "/admin/users", end: true, label: "Users & Roles", icon: "manage_accounts" },
  { to: "/admin/rules", end: true, label: "Detection Rules", icon: "rule" },
  { to: "/admin/audit-logs", end: true, label: "Audit Logs", icon: "receipt_long" },
  { to: "/admin/health", end: true, label: "System Health", icon: "health_and_safety" },
]

const FOOTER_NAV_ITEMS = [
  { to: "/admin/settings", end: true, label: "Settings", icon: "tune" },
  { to: "/", end: true, label: "Sign out", icon: "logout" },
]

const BASE_PILL_CLASS = "flex items-center gap-space-sm px-space-sm py-space-xs rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md"
const ACTIVE_PILL_CLASS = "flex items-center gap-space-sm px-space-sm py-space-xs transition-colors bg-primary-container text-on-primary font-headline-sm rounded"

function AdminNavItem({ item }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => (isActive ? ACTIVE_PILL_CLASS : BASE_PILL_CLASS)}>
      <MaterialIcon name={item.icon} className="text-[20px]" />
      <span>{item.label}</span>
    </NavLink>
  )
}

function AdminSidebar({ open = false }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-[70] w-panel-sidebar-w bg-surface-container-lowest flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-y-auto md:overflow-y-visible md:sticky md:top-0 md:h-screen md:z-40 md:flex md:translate-x-0 transition-transform duration-200 ${
        open ? "flex translate-x-0" : "hidden -translate-x-full"
      }`}
    >
      <div className="flex flex-col">
        <div className="h-14 px-space-base flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center justify-between w-full px-space-sm py-space-xs rounded bg-primary-container text-on-primary">
            <div className="flex items-center gap-space-xs">
              <MaterialIcon name="shield_person" className="text-[18px]" />
              <span className="font-headline-sm text-headline-sm font-semibold">Admin Console</span>
            </div>
            <MaterialIcon name="admin_panel_settings" className="text-on-primary-container text-[18px]" />
          </div>
        </div>
        <div className="px-space-sm pt-space-sm">
          <nav className="flex flex-col gap-space-2xs">
            {NAV_ITEMS.map((item) => (
              <AdminNavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>
      </div>
      <div className="p-space-sm flex flex-col gap-space-xs bg-surface-container-lowest">
        <nav className="flex flex-col gap-space-2xs">
          {FOOTER_NAV_ITEMS.map((item) => (
            <AdminNavItem key={item.to + item.label} item={item} />
          ))}
        </nav>
      </div>
    </aside>
  )
}

export default AdminSidebar