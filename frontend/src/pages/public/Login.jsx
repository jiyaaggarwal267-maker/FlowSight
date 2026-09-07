import { useNavigate } from "react-router-dom"
import MaterialIcon from "../../components/MaterialIcon.jsx"
import SiteNav from "../../components/SiteNav.jsx"
import SiteFooter from "../../components/SiteFooter.jsx"

function Login() {
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    navigate("/analyst/overview")
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface-container-low text-on-surface antialiased font-sans flex flex-col">
      <SiteNav />
      <main className="w-full flex-1 py-16 px-6 flex items-center justify-center">
        <div className="w-full max-w-xl">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/60 p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/25 mb-1">
                <MaterialIcon name="timeline" className="text-2xl" />
              </div>
              <h2 className="text-2xl text-on-surface font-bold">Welcome back to FLOWSIGHT</h2>
              <p className="text-xs text-secondary">Select an instant access tier or authenticate with institutional credentials</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-secondary font-bold tracking-wider uppercase">QUICK ONE-CLICK DEMO ACCESS</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  className="p-3 bg-surface-container-low hover:bg-surface-container text-left rounded-xl transition-all border border-outline-variant/40 hover:border-primary/40 flex flex-col group cursor-pointer"
                  onClick={() => navigate("/analyst/overview")}
                  type="button"
                >
                  <span className="text-sm text-primary flex items-center justify-between font-bold">
                    <span>Analyst Demo</span>
                    <MaterialIcon name="badge" className="text-base group-hover:scale-110 transition-transform" />
                  </span>
                  <span className="text-xs text-secondary mt-1">A. Sharma (L2 FIU Officer)</span>
                </button>
                <button
                  className="p-3 bg-surface-container-low hover:bg-surface-container text-left rounded-xl transition-all border border-outline-variant/40 hover:border-primary/40 flex flex-col group cursor-pointer"
                  onClick={() => navigate("/admin/overview")}
                  type="button"
                >
                  <span className="text-sm text-on-surface flex items-center justify-between font-bold">
                    <span>Admin Demo</span>
                    <MaterialIcon name="admin_panel_settings" className="text-base group-hover:scale-110 transition-transform" />
                  </span>
                  <span className="text-xs text-secondary mt-1">Risk Director Sandbox</span>
                </button>
              </div>
            </div>
            <div className="relative flex items-center justify-center my-1">
              <div className="w-full bg-surface-container-highest h-[1px]"></div>
              <span className="absolute bg-surface-container-lowest px-3 font-mono text-[11px] text-secondary font-medium uppercase">OR SIGN IN WITH SSO</span>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface font-semibold" htmlFor="login-email">Institutional Email</label>
                <input
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors text-sm"
                  id="login-email"
                  placeholder="investigator@vertexbank.com"
                  required
                  type="email"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-on-surface font-semibold" htmlFor="login-password">Credential Key</label>
                  <a className="text-xs text-primary hover:underline" href="#">Reset key</a>
                </div>
                <input
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors text-sm"
                  id="login-password"
                  placeholder="••••••••••••"
                  required
                  type="password"
                />
              </div>
              <div className="flex items-center gap-2">
                <input className="w-4 h-4 rounded text-primary focus:ring-0 border-outline-variant cursor-pointer" id="login-remember" type="checkbox" />
                <label className="text-xs text-secondary cursor-pointer select-none" htmlFor="login-remember">Remember hardware token for 8 hours</label>
              </div>
              <button className="w-full py-2.5 bg-primary-container text-white text-sm rounded-lg shadow-md hover:bg-primary transition-all text-center font-semibold cursor-pointer" type="submit">
                Sign In to Forensic Console
              </button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default Login