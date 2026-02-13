import { Link } from "react-router-dom";

const features = [
  {
    icon: "🧾",
    title: "POS Terintegrasi",
    desc: "Kasir cepat, struk otomatis, dan sinkron stok real-time.",
  },
  {
    icon: "📊",
    title: "Laporan Lengkap",
    desc: "Arus kas, hutang piutang, laba rugi—semua dalam satu dashboard.",
  },
  {
    icon: "🏪",
    title: "Multi-Outlet",
    desc: "Kelola banyak cabang, gudang, dan transfer stok dengan mudah.",
  },
  {
    icon: "🛒",
    title: "Toko Online",
    desc: "Kirim link katalog ke pelanggan, terima order tanpa marketplace.",
  },
  {
    icon: "📱",
    title: "PWA",
    desc: "Install di HP, jalan offline, seperti aplikasi native.",
  },
  {
    icon: "🔐",
    title: "Cloud & Aman",
    desc: "Data tersimpan di cloud, tidak perlu server atau instalasi.",
  },
];

export function Home() {
  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#1a1a2e]">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#e8eaed]/80 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1D8B7A] font-bold text-white">
              H
            </div>
            <span className="text-lg font-bold tracking-tight">Hisabia</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="hidden text-sm font-medium text-[#5f6368] transition hover:text-[#1a1a2e] sm:inline"
            >
              Masuk
            </Link>
            <Link
              to="/register"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1D8B7A] px-5 text-sm font-semibold text-white shadow-lg shadow-[#1D8B7A]/25 transition hover:bg-[#177a6b] hover:shadow-[#1D8B7A]/30"
            >
              Daftar Gratis
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(29,139,122,0.12),transparent)]" />
        <div className="absolute right-0 top-20 h-72 w-96 rounded-full bg-[#1D8B7A]/5 blur-3xl" />
        <div className="absolute bottom-20 left-0 h-48 w-64 rounded-full bg-[#1D8B7A]/5 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#1D8B7A]/20 bg-[#1D8B7A]/5 px-4 py-1.5 text-sm font-medium text-[#1D8B7A]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#1D8B7A]" />
            Trial 14 hari gratis · Tidak perlu kartu kredit
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-[#1a1a2e] sm:text-5xl md:text-6xl">
            Kelola usaha Anda dengan{" "}
            <span className="bg-gradient-to-r from-[#1D8B7A] to-[#25a88f] bg-clip-text text-transparent">
              satu aplikasi
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#5f6368] sm:text-xl">
            Accounting, POS, inventori, dan toko online—semua dalam satu platform.
            Mulai gratis, bayar hanya Rp 99.000/bulan setelah trial.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#1D8B7A] px-8 text-base font-semibold text-white shadow-xl shadow-[#1D8B7A]/30 transition hover:bg-[#177a6b] hover:shadow-[#1D8B7A]/40 sm:w-auto"
            >
              Coba Gratis 14 Hari
            </Link>
            <Link
              to="/login"
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl border-2 border-[#e8eaed] bg-white px-8 text-base font-semibold text-[#1a1a2e] transition hover:border-[#1D8B7A]/30 hover:bg-[#1D8B7A]/5 sm:w-auto"
            >
              Sudah punya akun? Masuk
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-[#e8eaed] bg-white/60 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-6 text-center text-sm text-[#5f6368]">
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-[#1D8B7A]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Trial 14 hari
          </span>
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-[#1D8B7A]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Rp 99.000/bulan
          </span>
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-[#1D8B7A]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Batal kapan saja
          </span>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-[#1a1a2e] sm:text-4xl">
            Semua yang Anda butuhkan
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-[#5f6368]">
            Satu platform untuk mengelola keuangan, penjualan, dan inventori bisnis Anda.
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-sm transition hover:border-[#1D8B7A]/30 hover:shadow-lg hover:shadow-[#1D8B7A]/5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1D8B7A]/10 text-2xl transition group-hover:bg-[#1D8B7A]/15">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-[#1a1a2e]">{f.title}</h3>
                <p className="mt-2 text-[#5f6368]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1D8B7A] to-[#177a6b] p-10 shadow-2xl sm:p-14">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Mulai hari ini, tanpa risiko
              </h2>
              <p className="mt-4 text-lg text-white/90">
                Trial 14 hari gratis. Setelah itu hanya Rp 99.000/bulan untuk 1 outlet dan 2 user.
              </p>
              <Link
                to="/register"
                className="mt-8 inline-flex h-14 items-center justify-center rounded-2xl bg-white px-10 text-base font-semibold text-[#1D8B7A] shadow-lg transition hover:bg-white/95"
              >
                Daftar Sekarang — Gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e8eaed] bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D8B7A] font-bold text-white">
                H
              </div>
              <span className="font-bold">Hisabia</span>
            </Link>
            <div className="flex gap-8 text-sm text-[#5f6368]">
              <Link to="/login" className="hover:text-[#1D8B7A]">Masuk</Link>
              <Link to="/register" className="hover:text-[#1D8B7A]">Daftar</Link>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-[#9aa0a6] sm:text-left">
            © {new Date().getFullYear()} Hisabia. Accounting & POS untuk segala jenis usaha.
          </p>
        </div>
      </footer>
    </div>
  );
}
