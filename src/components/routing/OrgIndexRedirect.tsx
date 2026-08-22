import { Navigate } from "react-router-dom";
import { useOrgLandingHref } from "@/hooks/useOrgLandingPath";

/** Redirect /org/:orgId ke halaman pertama yang boleh diakses user (bukan selalu dashboard). */
export function OrgIndexRedirect() {
  const landingHref = useOrgLandingHref();
  return <Navigate to={landingHref} replace />;
}
