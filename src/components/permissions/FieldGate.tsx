import type { ReactNode } from "react";
import { useFeatureFieldVisibility } from "@/hooks/useFeatureFieldVisibility";
import type { OutletFeatureKey } from "@/lib/outletFeatures";

interface FieldGateProps {
  feature: OutletFeatureKey;
  field: string;
  children: ReactNode;
}

/** Sembunyikan children jika karyawan tidak punya hak lihat field ini. */
export function FieldGate({ feature, field, children }: FieldGateProps) {
  const { canView } = useFeatureFieldVisibility(feature);
  if (!canView(field)) return null;
  return <>{children}</>;
}
