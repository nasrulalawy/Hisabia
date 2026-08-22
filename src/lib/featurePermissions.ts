import type { EmployeeFeaturePermission } from "@/lib/employeeFeatures";
import { getEmployeeFeaturePermission } from "@/lib/employeeFeatures";
import {
  getFeaturePermission,
  type OutletFeatureKey,
  type OutletFeaturePermission,
} from "@/lib/outletFeatures";

export type FeaturePermission = OutletFeaturePermission;

const DEFAULT: FeaturePermission = {
  can_create: true,
  can_read: true,
  can_update: true,
  can_delete: true,
};

function mergePermission(
  outlet: OutletFeaturePermission,
  employee: EmployeeFeaturePermission
): FeaturePermission {
  return {
    can_create: outlet.can_create && employee.can_create,
    can_read: outlet.can_read && employee.can_read,
    can_update: outlet.can_update && employee.can_update,
    can_delete: outlet.can_delete && employee.can_delete,
  };
}

/**
 * Gabungkan hak outlet + karyawan. Karyawan tidak punya baris = semua diizinkan (sesuai outlet).
 * Owner/admin (bukan karyawan) hanya terikat outlet permissions.
 */
export function getEffectiveFeaturePermission(
  featureKey: OutletFeatureKey,
  outletPermissions: Record<string, OutletFeaturePermission> | null,
  employeePermissions: Record<string, EmployeeFeaturePermission> | null,
  isEmployee: boolean
): FeaturePermission {
  const outlet = getFeaturePermission(featureKey, outletPermissions);
  if (!isEmployee) return outlet;
  const employee = getEmployeeFeaturePermission(featureKey, employeePermissions);
  return mergePermission(outlet, employee);
}

export function featureActionDeniedMessage(
  action: "create" | "update" | "delete",
  perm: FeaturePermission = DEFAULT
): string | null {
  if (action === "create" && !perm.can_create) {
    return "Anda tidak memiliki izin untuk menambah data.";
  }
  if (action === "update" && !perm.can_update) {
    return "Anda tidak memiliki izin untuk mengubah data.";
  }
  if (action === "delete" && !perm.can_delete) {
    return "Anda tidak memiliki izin untuk menghapus data.";
  }
  return null;
}
