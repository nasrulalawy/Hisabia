import type { EmployeeRoleFeaturePermission } from "@/lib/database.types";

export interface EmployeeFeaturePermission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  /** null = semua field boleh dilihat */
  visible_fields: string[] | null;
}

const DEFAULT_PERMISSION: EmployeeFeaturePermission = {
  can_create: true,
  can_read: true,
  can_update: true,
  can_delete: true,
  visible_fields: null,
};

export function normalizeEmployeePermissions(
  rows: EmployeeRoleFeaturePermission[] | {
    feature_key: string;
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
    visible_fields?: string[] | null;
  }[]
): Record<string, EmployeeFeaturePermission> {
  const map: Record<string, EmployeeFeaturePermission> = {};
  for (const row of rows) {
    map[row.feature_key] = {
      can_create: row.can_create,
      can_read: row.can_read,
      can_update: row.can_update,
      can_delete: row.can_delete,
      visible_fields: row.visible_fields ?? null,
    };
  }
  return map;
}

export function getEmployeeVisibleFields(
  featureKey: string,
  permissions: Record<string, EmployeeFeaturePermission> | null
): string[] | null {
  if (!permissions || !permissions[featureKey]) return null;
  return permissions[featureKey].visible_fields;
}

export function getEmployeeFeaturePermission(
  featureKey: string,
  permissions: Record<string, EmployeeFeaturePermission> | null
): EmployeeFeaturePermission {
  if (!permissions || !permissions[featureKey]) return DEFAULT_PERMISSION;
  return permissions[featureKey];
}

