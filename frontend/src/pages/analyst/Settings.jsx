import SettingsPage from "../../components/SettingsPage.jsx"

const USER = {
  name: "A. Sharma",
  initials: "AS",
  role: "Senior Analyst · AML",
  region: "Mumbai",
  email: "a.sharma@flowsight.demo",
  phone: "+91 98201 44550",
  org: "FLOWSIGHT CRIME INTELLIGENCE",
}

function AnalystSettings() {
  return <SettingsPage roleTag="ANALYST WORKSPACE" user={USER} workspace="analyst workspace" />
}

export default AnalystSettings