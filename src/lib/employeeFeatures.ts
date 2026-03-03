import type { EmployeeRoleFeaturePermission } from "@/lib/database.types";

export interface EmployeeFeaturePermission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

const DEFAULT_PERMISSION: EmployeeFeaturePermission = {
  can_create: true,
  can_read: true,
  can_update: true,
  can_delete: true,
};

export function normalizeEmployeePermissions(
  rows: EmployeeRoleFeaturePermission[] | { feature_key: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }[]
): Record<string, EmployeeFeaturePermission> {
  const map: Record<string, EmployeeFeaturePermission> = {};
  for (const row of rows) {
    map[row.feature_key] = {
      can_create: row.can_create,
      can_read: row.can_read,
      can_update: row.can_update,
      can_delete: row.can_delete,
    };
  }
  return map;
}

export function getEmployeeFeaturePermission(
  featureKey: string,
  permissions: Record<string, EmployeeFeaturePermission> | null
): EmployeeFeaturePermission {
  if (!permissions || !permissions[featureKey]) return DEFAULT_PERMISSION;
  return permissions[featureKey];
}

