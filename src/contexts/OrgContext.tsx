import { createContext, useContext, type ReactNode } from "react";
import type { Outlet, OutletType, Employee } from "@/lib/database.types";
import type { EmployeeFeaturePermission } from "@/lib/employeeFeatures";
import type { OutletFeaturePermission } from "@/lib/outletFeatures";

interface OrgContextValue {
  orgId: string;
  outlets: Outlet[];
  currentOutletId: string | null;
  currentOutlet: Outlet | null;
  currentOutletType: OutletType;
  /** Permission per fitur untuk outlet aktif. Null = belum load. Kosong/tidak ada key = semua diizinkan. */
  outletFeaturePermissions: Record<string, OutletFeaturePermission> | null;
  /** Fitur yang diizinkan untuk org ini oleh super admin (mis. kredit_syariah). Hanya tampil jika outlet_type sesuai. */
  organizationFeatureGrants: string[];
  /** Data karyawan terhubung ke user login (jika ada) */
  currentEmployee: Employee | null;
  /** Hak akses karyawan per fitur (berdasarkan kategori karyawan). Kosong/null = semua diizinkan. */
  employeeFeaturePermissions: Record<string, EmployeeFeaturePermission> | null;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: OrgContextValue;
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgLayout");
  return ctx;
}
