import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import AdminSidebar from "../components/AdminSidebar.jsx"
import AdminHeader from "../components/AdminHeader.jsx"

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <AdminSidebar open={menuOpen} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <AdminHeader onMenu={() => setMenuOpen(true)} />
        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-space-lg lg:py-space-lg bg-surface">
          <div className="animate-page-in" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout