import { useOrg } from "@/contexts/OrgContext";
import {
  featureActionDeniedMessage,
  getEffectiveFeaturePermission,
  type FeaturePermission,
} from "@/lib/featurePermissions";
import type { OutletFeatureKey } from "@/lib/outletFeatures";

const ALL_ALLOWED: FeaturePermission = {
  can_create: true,
  can_read: true,
  can_update: true,
  can_delete: true,
};

export function useFeaturePermission(featureKey?: OutletFeatureKey): FeaturePermission {
  const { outletFeaturePermissions, employeeFeaturePermissions, currentEmployee } = useOrg();
  if (!featureKey) return ALL_ALLOWED;
  return getEffectiveFeaturePermission(
    featureKey,
    outletFeaturePermissions,
    employeeFeaturePermissions,
    !!currentEmployee
  );
}

export function useFeatureActionDenied(
  featureKey: OutletFeatureKey,
  action: "create" | "update" | "delete"
): string | null {
  const perm = useFeaturePermission(featureKey);
  return featureActionDeniedMessage(action, perm);
}
