import { useOrg } from "@/contexts/OrgContext";
import {
  getDefaultOrgLandingHref,
  getDefaultOrgLandingPath,
} from "@/lib/outletFeatures";

export function useOrgLandingHref(): string {
  const {
    currentOutletType,
    outletFeaturePermissions,
    employeeFeaturePermissions,
    organizationFeatureGrants,
  } = useOrg();
  return getDefaultOrgLandingHref(
    currentOutletType,
    outletFeaturePermissions,
    employeeFeaturePermissions,
    organizationFeatureGrants
  );
}

export function useOrgLandingPath(): string {
  const { orgId, currentOutletType, outletFeaturePermissions, employeeFeaturePermissions, organizationFeatureGrants } =
    useOrg();
  return getDefaultOrgLandingPath(
    orgId,
    currentOutletType,
    outletFeaturePermissions,
    employeeFeaturePermissions,
    organizationFeatureGrants
  );
}
