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
  locked = false,
  onSwitch,
}: {
  outlets: Outlet[];
  currentOutletId: string | null;
  /** Karyawan terikat outlet: tidak bisa pindah ke outlet lain */
  locked?: boolean;
  onSwitch?: () => void;
}) {
  if (!outlets.length) return null;

  function selectOutlet(outletId: string) {
    if (locked) return;
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
        disabled={locked || outlets.length <= 1}
        title={locked ? "Akun ini terikat ke outlet ini" : undefined}
        className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-70"
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
