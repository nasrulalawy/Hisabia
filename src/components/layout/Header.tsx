import { Input } from "@/components/ui/Input";
import { OutletSwitcher } from "./OutletSwitcher";
import type { Outlet } from "@/lib/database.types";

interface HeaderProps {
  title?: string;
  user?: { name?: string; role?: string } | null;
  outlets?: Outlet[] | null;
  currentOutletId?: string | null;
  orgId?: string;
  onMenuClick?: () => void;
}

export function Header({
  title = "Dashboard",
  user,
  outlets,
  currentOutletId,
  orgId,
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--background)] px-3 sm:h-16 sm:gap-4 sm:px-6">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] md:hidden"
          aria-label="Buka menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <div className="relative hidden w-full max-w-md sm:block">
          <span className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <Input className="pl-9" placeholder="Cari..." type="search" aria-label="Search" />
        </div>
        <h1 className="truncate text-lg font-semibold text-[var(--foreground)] sm:text-xl">{title}</h1>
        {outlets && outlets.length > 0 && orgId && (
          <div className="hidden shrink-0 sm:block">
            <OutletSwitcher outlets={outlets} currentOutletId={currentOutletId ?? null} onSwitch={() => {}} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {outlets && outlets.length > 0 && orgId && (
          <div className="sm:hidden">
            <OutletSwitcher outlets={outlets} currentOutletId={currentOutletId ?? null} onSwitch={() => {}} />
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 sm:px-3 sm:py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-medium text-white">
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
