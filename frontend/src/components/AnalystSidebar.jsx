import { useEffect, useState } from "react"
import { NavLink, Link } from "react-router-dom"
import MaterialIcon from "./MaterialIcon.jsx"
import { bus } from "../lib/runtime.js"

const NAV_ITEMS = [
  { to: "/analyst/overview", end: true, label: "Overview", icon: "grid_view" },
  { to: "/analyst/network-explorer", end: true, label: "Network Explorer", icon: "hub" },
  { to: "/analyst/alerts", end: true, label: "Alerts", icon: "warning", badge: "12" },
  { to: "/analyst/investigations/INV-001", end: false, label: "Investigations", icon: "policy" },
  { to: "/analyst/flow-timeline", end: true, label: "Flow Timeline", icon: "timeline" },
  { to: "/analyst/entities/AC-10316", end: false, label: "Entities", icon: "corporate_fare" },
  { to: "/analyst/ai-investigator", end: true, label: "AI Investigator", icon: "auto_awesome", badge: "BETA" },
  { to: "/analyst/reports", end: true, label: "Reports", icon: "description" },
]

const FOOTER_NAV_ITEMS = [
  { to: "/analyst/settings", end: true, label: "Settings", icon: "settings" },
]

const BASE_LINK_CLASS =
  "flex items-center justify-between px-space-sm py-space-xs rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-body-md text-body-md"

const ACTIVE_LINK_CLASS =
  "flex items-center justify-between px-space-sm py-space-xs transition-colors bg-primary-container text-on-primary font-headline-sm rounded"

function SideNavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => (isActive ? ACTIVE_LINK_CLASS : BASE_LINK_CLASS)}
    >
      <div className="flex items-center gap-space-sm">
        <MaterialIcon name={item.icon} className="text-[20px]" />
        <span>{item.label}</span>
      </div>
      {item.badge && (
        <span
          className={`px-space-xs py-0.5 rounded-full ${
            item.badge === "BETA"
              ? "bg-secondary-container text-on-secondary-fixed-variant"
              : "bg-error-container text-on-error-container"
          } font-label-caps text-label-caps`}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  )
}

function AnalystSidebar({ open = false }) {
  const [context, setContext] = useState({ case: "INV-042", entity: "AC-20491" })

  useEffect(() => {
    return bus.on("case-context", setContext)
  }, [])

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-[70] w-panel-sidebar-w bg-surface-container-lowest flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] select-none overflow-y-auto md:overflow-y-visible md:sticky md:top-0 md:h-screen md:z-40 md:flex md:translate-x-0 transition-transform duration-200 ${
        open ? "flex translate-x-0" : "hidden -translate-x-full"
      }`}
    >
      <div className="flex flex-col">
        <div className="h-14 px-space-base flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center justify-between w-full px-space-sm py-space-xs rounded bg-surface-container-low hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Analyst Workspace</span>
            </div>
            <MaterialIcon name="unfold_more" className="text-on-surface-variant text-[18px]" />
          </div>
        </div>
        <div className="px-space-sm pt-space-sm">
          <nav className="flex flex-col gap-space-2xs">
            {NAV_ITEMS.map((item) => (
              <SideNavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>
        <div className="px-space-sm pt-space-sm">
          <Link
            className="flex items-center justify-between px-space-sm py-2 rounded-lg bg-secondary-container/60 hover:bg-secondary-container transition-colors ring-1 ring-inset ring-secondary-fixed-dim"
            to="/analyst/flow-timeline"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-wider">Active Case</span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">{context.case}</span>
              <span className="font-label-sm text-label-sm text-on-secondary-fixed-variant font-mono truncate">focus: {context.entity}</span>
            </div>
            <MaterialIcon name="chevron_right" className="text-on-secondary-fixed-variant text-[18px]" />
          </Link>
        </div>
      </div>
      <div className="p-space-sm flex flex-col gap-space-xs bg-surface-container-lowest">
        <nav className="flex flex-col gap-space-2xs">
          {FOOTER_NAV_ITEMS.map((item) => (
            <SideNavItem key={item.to} item={item} />
          ))}
        </nav>
        <Link
          className="flex items-center justify-between px-space-sm py-space-xs rounded bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
          to="/analyst/settings"
        >
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-7 h-7 rounded bg-tertiary-container text-on-tertiary flex items-center justify-center font-label-sm text-label-sm font-semibold">
              AS
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">A. Sharma</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">Senior Analyst</span>
            </div>
          </div>
          <MaterialIcon name="more_vert" className="text-on-surface-variant text-[18px]" />
        </Link>
      </div>
    </aside>
  )
}

export default AnalystSidebar