import type { Outlet, OutletType } from "@/lib/database.types";

const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  gudang: "Gudang",
  mart: "Mart",
  fnb: "F&B",
  barbershop: "Barbershop",
};

const OUTLET_COOKIE = "hisabia-current-outlet";

export function OutletSwitcher({
  outlets,
  currentOutletId,
  onSwitch,
}: {
  outlets: Outlet[];
  currentOutletId: string | null;
  onSwitch?: () => void;
}) {
  if (!outlets.length) return null;

  function selectOutlet(outletId: string) {
    document.cookie = `${OUTLET_COOKIE}=${outletId};path=/;max-age=31536000`;
    onSwitch?.();
    window.location.reload();
  }

  const current = currentOutletId
    ? outlets.find((o) => o.id === currentOutletId) ?? outlets[0]
    : outlets.find((o) => o.is_default) ?? outlets[0];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="outlet-switcher" className="text-sm text-[var(--muted-foreground)]">
        Outlet:
      </label>
      <select
        id="outlet-switcher"
        value={current?.id ?? ""}
        onChange={(e) => selectOutlet(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      >
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({OUTLET_TYPE_LABELS[(o.outlet_type as OutletType) ?? "mart"]})
            {o.is_default ? " • default" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
