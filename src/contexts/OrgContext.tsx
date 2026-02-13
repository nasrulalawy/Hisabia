import { createContext, useContext, type ReactNode } from "react";
import type { Outlet, OutletType } from "@/lib/database.types";

interface OrgContextValue {
  orgId: string;
  outlets: Outlet[];
  currentOutletId: string | null;
  currentOutlet: Outlet | null;
  currentOutletType: OutletType;
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
