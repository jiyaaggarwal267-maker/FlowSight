import SettingsPage from "../../components/SettingsPage.jsx"

const USER = {
  name: "R. Mehta",
  initials: "RM",
  role: "Compliance Admin · Platform Ops",
  region: "Mumbai",
  email: "r.mehta@flowsight.demo",
  phone: "+91 99307 22108",
  org: "FLOWSIGHT ADMIN CONSOLE",
}

function AdminSettings() {
  return <SettingsPage roleTag="ADMIN CONSOLE" user={USER} workspace="admin console" />
}

export default AdminSettings