import SiteNav from "../../components/SiteNav.jsx"
import SiteFooter from "../../components/SiteFooter.jsx"
import NetworkGraphHero from "../../components/NetworkGraphHero.jsx"

function NetworkGraphPublic() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface text-on-surface antialiased font-sans">
      <SiteNav />
      <main className="w-full py-12 flex flex-col gap-6">
        <div className="max-w-7xl mx-auto w-full px-6 flex flex-col gap-1">
          <span className="font-mono text-xs text-primary font-bold tracking-wider uppercase">PUBLIC DEMO · INTERACTIVE FORENSIC GRAPH</span>
          <h1 className="text-2xl sm:text-3xl text-on-surface font-bold">Network Visualization Preview</h1>
          <p className="text-secondary text-sm max-w-2xl">
            A static, anonymous demo topology illustrating the kind of multi-hop layering structures FLOWSIGHT reveals across UPI, IMPS, RTGS, and SWIFT rails. Inside the analyst console you can inspect live nodes, velocities, and evidence packs.
          </p>
        </div>
        <NetworkGraphHero tall />
        <div className="max-w-7xl mx-auto w-full px-6 pt-2 text-xs text-secondary">
          All account identifiers, amounts, and entity names in this preview are simulated and do not represent real institutions, accounts, or transactions.
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default NetworkGraphPublic