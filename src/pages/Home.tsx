import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--muted)] p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)] text-3xl font-bold text-white">
        H
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Hisabia</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Accounting & POS untuk segala jenis usaha
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-[var(--primary)] px-6 font-medium text-white transition-colors hover:opacity-90"
        >
          Masuk
        </Link>
        <Link
          to="/register"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-6 font-medium hover:bg-[var(--muted)]"
        >
          Daftar
        </Link>
      </div>
    </div>
  );
}
