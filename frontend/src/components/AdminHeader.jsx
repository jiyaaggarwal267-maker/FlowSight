import { Link } from "react-router-dom"
import Emblem from "./Emblem.jsx"
import MaterialIcon from "./MaterialIcon.jsx"
import ThemeToggle from "./ThemeToggle.jsx"
import BellMenu from "./BellMenu.jsx"
import { openPalette } from "../lib/runtime.js"

function AdminHeader({ onMenu = () => {} }) {
  return (
    <header className="sticky top-0 z-40 h-14 w-full bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-3 sm:px-5 lg:px-space-lg flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-space-md min-w-0">
        <button
          className="p-1.5 -ml-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors md:hidden"
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <MaterialIcon name="menu" className="text-[22px]" />
        </button>
        <div className="flex items-center gap-space-sm min-w-0">
          <Emblem />
          <span className="font-headline-sm text-headline-sm tracking-wider uppercase text-on-surface font-semibold whitespace-nowrap">
            FLOWSIGHT ADMIN CONSOLE
          </span>
        </div>
        <div className="hidden lg:block px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant font-label-caps text-label-caps font-semibold uppercase tracking-wider whitespace-nowrap">
          DEMO ENVIRONMENT · SIMULATED DATA
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-space-base min-w-0">
        <button
          className="hidden sm:flex items-center gap-2 h-9 px-2 pl-3 rounded-lg bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-on-surface-variant font-body-md text-body-md transition-colors hover:bg-surface-container cursor-pointer"
          onClick={openPalette}
          type="button"
        >
          <MaterialIcon name="search" className="text-[18px] text-outline" />
          <span className="hidden lg:inline text-outline">Search pages, rules, users…</span>
          <span className="hidden md:inline text-outline lg:hidden">Search…</span>
          <span className="ml-1 px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-caps text-label-caps">
            ⌘K
          </span>
        </button>
        <div className="flex items-center gap-1 sm:gap-space-xs">
          <BellMenu />
          <ThemeToggle />
        </div>
        <Link
          aria-label="Your profile"
          className="flex items-center gap-space-xs rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
          to="/admin/settings"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-label-sm font-semibold shadow-sm">
            RM
          </div>
        </Link>
      </div>
    </header>
  )
}

export default AdminHeader