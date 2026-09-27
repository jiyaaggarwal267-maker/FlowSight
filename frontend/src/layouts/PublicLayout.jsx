import { Outlet } from "react-router-dom"
import ApiStatusBanner from "../components/ApiStatusBanner.jsx"

function PublicLayout() {
  return (
    <>
      <Outlet />
      <ApiStatusBanner />
    </>
  )
}

export default PublicLayout
