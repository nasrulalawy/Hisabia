import { useCallback } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { canViewFeatureField } from "@/lib/featureFields";
import { getEmployeeVisibleFields } from "@/lib/employeeFeatures";
import type { OutletFeatureKey } from "@/lib/outletFeatures";

export function useFeatureFieldVisibility(featureKey: OutletFeatureKey) {
  const { employeeFeaturePermissions, currentEmployee } = useOrg();
  const isEmployee = !!currentEmployee;
  const visibleFields = isEmployee
    ? getEmployeeVisibleFields(featureKey, employeeFeaturePermissions)
    : null;

  const canView = useCallback(
    (fieldKey: string): boolean => {
      if (!isEmployee) return true;
      return canViewFeatureField(visibleFields, fieldKey);
    },
    [isEmployee, visibleFields]
  );

  const filterByField = useCallback(
    <T extends { key: string }>(items: T[]): T[] => {
      if (!isEmployee) return items;
      return items.filter((item) => canViewFeatureField(visibleFields, item.key));
    },
    [isEmployee, visibleFields]
  );

  return { canView, filterByField, visibleFields };
}
