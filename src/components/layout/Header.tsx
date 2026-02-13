import { Input } from "@/components/ui/Input";
import { OutletSwitcher } from "./OutletSwitcher";
import type { Outlet } from "@/lib/database.types";

interface HeaderProps {
  title?: string;
  user?: { name?: string; role?: string } | null;
  outlets?: Outlet[] | null;
  currentOutletId?: string | null;
  orgId?: string;
}

export function Header({
  title = "Dashboard",
  user,
  outlets,
  currentOutletId,
  orgId,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-[var(--background)] px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-md">
          <span className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <Input className="pl-9" placeholder="Cari..." type="search" aria-label="Search" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
        {outlets && outlets.length > 0 && orgId && (
          <OutletSwitcher outlets={outlets} currentOutletId={currentOutletId ?? null} onSwitch={() => {}} />
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-medium text-white">
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-[var(--foreground)]">{user?.name ?? "User"}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{user?.role ?? "Member"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
