import { useLocation } from "react-router-dom";

export function PlaceholderPage() {
  const location = useLocation();
  const name = location.pathname.split("/").filter(Boolean).pop() ?? "Halaman";
  const label = name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{label}</h2>
        <p className="text-[var(--muted-foreground)]">
          Halaman ini akan segera dilengkapi. Fitur sama seperti versi Next.js.
        </p>
      </div>
    </div>
  );
}
