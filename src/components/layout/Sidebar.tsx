import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import type { OutletType } from "@/lib/database.types";

const SIDEBAR_EXPANDED_KEY = "hisabia-sidebar-expanded";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  outletTypes?: OutletType[];
}
interface NavGroup {
  label: string;
  items: NavItem[];
  outletTypes?: OutletType[];
}

const allNavGroups: NavGroup[] = [
  { label: "Utama", items: [{ href: "dashboard", label: "Dashboard", icon: "M4 6h16M4 12h16M4 18h16" }] },
  {
    label: "Master",
    items: [
      { href: "kategori", label: "Kategori", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", outletTypes: ["mart", "fnb", "barbershop"] },
      { href: "produk", label: "Produk", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
      { href: "satuan", label: "Satuan", icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2a1 1 0 11-2 0V7m0 2v2a1 1 0 102 0V9m0 2a1 1 0 100 2", outletTypes: ["mart", "fnb", "barbershop"] },
      { href: "supplier", label: "Supplier", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { href: "pelanggan", label: "Pelanggan", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", outletTypes: ["mart", "fnb", "barbershop"] },
    ],
  },
  {
    label: "Penjualan",
    items: [
      { href: "pos", label: "POS", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
      { href: "stok-toko", label: "Stok Toko", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
    ],
    outletTypes: ["mart", "fnb", "barbershop"],
  },
  {
    label: "Keuangan",
    items: [
      { href: "arus-kas", label: "Arus Kas", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { href: "hutang-piutang", label: "Hutang Piutang", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
      { href: "accounting", label: "Laporan", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    ],
    outletTypes: ["mart", "fnb", "barbershop"],
  },
  {
    label: "Gudang",
    items: [
      { href: "pembelian", label: "Pembelian", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
      { href: "stok", label: "Stok", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
      { href: "gudang", label: "Pergudangan", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    ],
    outletTypes: ["gudang"],
  },
  {
    label: "Pengaturan",
    items: [
      { href: "outlets", label: "Outlets", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { href: "toko", label: "Info Toko", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
      { href: "subscription", label: "Subscription", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
    ],
  },
];

function getNavGroupsForOutletType(outletType: OutletType): NavGroup[] {
  return allNavGroups
    .filter((g) => !g.outletTypes || g.outletTypes.includes(outletType))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.outletTypes || item.outletTypes.includes(outletType)),
    }))
    .filter((g) => g.items.length > 0);
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export function Sidebar({
  basePath,
  outletType = "mart",
}: {
  basePath: string;
  outletType?: OutletType;
}) {
  const location = useLocation();
  const pathname = location.pathname;
  const [expanded, setExpanded] = useState(true);
  const navGroups = getNavGroupsForOutletType(outletType);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored !== null) setExpanded(stored === "1");
  }, []);

  function toggleSidebar() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? "1" : "0");
  }

  return (
    <aside
      className={`flex shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200 ${expanded ? "w-56" : "w-16"}`}
    >
      <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-3">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <span className="text-lg font-bold">H</span>
          </div>
          {expanded && <span className="truncate text-sm font-semibold">Hisabia</span>}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          title={expanded ? "Persempit sidebar" : "Perlebar sidebar"}
        >
          <svg className={`h-5 w-5 transition-transform ${expanded ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {navGroups.map((group) => (
          <div key={group.label}>
            {expanded && (
              <p className="mb-1 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--sidebar-foreground)]/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const fullHref = `${basePath}/${item.href}`;
              const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
              return (
                <Link
                  key={item.href}
                  to={fullHref}
                  className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${expanded ? "px-3" : "justify-center"} ${isActive ? "bg-[var(--primary)] text-white" : "hover:bg-white/10"}`}
                  title={item.label}
                >
                  <NavIcon d={item.icon} />
                  {expanded && <span className="truncate text-sm">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--border)] p-2">
        <Link to="/logout" className={`flex items-center rounded-lg p-3 hover:bg-white/10 ${expanded ? "gap-3 px-3" : "justify-center"}`} title="Keluar">
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {expanded && <span className="text-sm">Keluar</span>}
        </Link>
      </div>
    </aside>
  );
}
