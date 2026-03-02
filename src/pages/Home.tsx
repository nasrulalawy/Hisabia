import { useState } from "react";
import { Link } from "react-router-dom";


// Nav items (mirror referensi: Produk, Solusi, Harga, dll)
const navLinks = [
  { label: "Fitur", href: "#solusi" },
  { label: "Keuntungan", href: "#keuntungan" },
  { label: "Harga", href: "#cta" },
  { label: "Integrasi", href: "#integrasi" },
  { label: "FAQ", href: "#faq" },
];

// Feature sidebar untuk section "Solusi terbaik"
const featureNavItems = [
  { id: "stok", label: "Manajemen Stok", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { id: "keuangan", label: "Manajemen Keuangan", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "penjualan", label: "POS & Penjualan", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { id: "akuntansi", label: "Akuntansi", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "gudang", label: "Gudang & Pembelian", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
];

// Mengapa membutuhkan Hisabia - 3 cards
const whyCards = [
  {
    title: "Otomatisasi Laporan Keuangan",
    desc: "Laporan neraca, laba rugi, arus kas, dan jurnal terupdate otomatis dari setiap transaksi. Tidak perlu input manual berulang.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "Terintegrasi Online",
    desc: "Satu platform untuk POS, gudang, pembelian, dan toko online. Data tersinkronisasi real-time di semua perangkat.",
    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z",
  },
  {
    title: "Keamanan Data Terjamin",
    desc: "Data disimpan aman di cloud dengan backup teratur. Period lock dan akses per user agar laporan keuangan tetap terkontrol.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];

// Keuntungan - 6 cards
const advantageCards = [
  { title: "Multi Gudang", desc: "Kelola banyak gudang dan outlet. Stok per lokasi, transfer antar gudang, dan opname terpisah.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { title: "Cloud Based", desc: "Akses dari mana saja. Tidak perlu instalasi atau server. Data tersimpan aman di cloud.", icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" },
  { title: "Keamanan Tingkat Tinggi", desc: "Backup teratur, period lock, dan kontrol akses per user. Data keuangan Anda terlindungi.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { title: "Tim Support Profesional", desc: "Dukungan siap membantu Anda memulai dan memaksimalkan penggunaan Hisabia.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { title: "Akurasi Data", desc: "Satu sumber data dari transaksi ke laporan. Jurnal otomatis dari POS dan pembelian mengurangi kesalahan.", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: "Laporan Realtime", desc: "Dashboard keuangan, arus kas, hutang piutang, dan laporan aging selalu terupdate real-time.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

// FAQ
const faqItems = [
  { q: "Apa itu Hisabia?", a: "Hisabia adalah platform akuntansi dan operasional bisnis terintegrasi. Satu sistem untuk mengelola POS, gudang, pembelian, keuangan, laporan, dan toko online—cocok untuk toko, F&B, dan UMKM." },
  { q: "Apakah ada trial gratis?", a: "Ya. Anda bisa coba gratis 14 hari tanpa kartu kredit. Setelah trial, berlangganan Rp 99.000/bulan untuk 1 outlet dan 2 user. Batal kapan saja." },
  { q: "Apakah data saya aman?", a: "Data disimpan di cloud dengan keamanan tinggi, backup teratur, dan kontrol akses. Fitur tutup buku dan period lock menjaga integritas laporan keuangan." },
  { q: "Bisa untuk multi outlet?", a: "Ya. Hisabia mendukung multi outlet dan multi gudang. Anda bisa menambah outlet sesuai paket langganan." },
  { q: "Apakah bisa integrasi dengan sistem lain?", a: "Ya. Hisabia menyediakan integrasi dengan n8n (workflow automation) dan API untuk menghubungkan dengan e-commerce, payment gateway, atau tools lain." },
];

// Footer links
const footerProduct = [
  { label: "POS & Kasir", href: "#solusi" },
  { label: "Akuntansi", href: "#solusi" },
  { label: "Gudang & Stok", href: "#solusi" },
  { label: "Toko Online", href: "#solusi" },
];
const footerCompany = [
  { label: "Tentang Kami", href: "#" },
  { label: "Hubungi Kami", href: "#cta" },
  { label: "Karir", href: "#" },
];
const footerResources = [
  { label: "Blog", href: "#" },
  { label: "Panduan", href: "#" },
  { label: "FAQ", href: "#faq" },
];

function IconPath({ d }: { d: string }) {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export function Home() {
  const [activeFeature, setActiveFeature] = useState("keuangan");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-[#1a1a2e]">
      {/* ========== PRE-HEADER (dark bar) ========== */}
      <div className="bg-[#0d3d36] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-sm">
          <div className="flex items-center gap-6">
            <Link to="/register" className="font-medium text-white/95 hover:text-white">
              Gratis coba 14 hari
            </Link>
            <a href="tel:+6285156514096" className="flex items-center gap-1.5 text-white/90 hover:text-white">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.586a1 1 0 01.707.293L8 5.586A1 1 0 018.414 7L6.293 9.121a1 1 0 00-.293.707v6a1 1 0 001 1h6a1 1 0 001-1v-2.586a1 1 0 01.293-.707L13 11.586a1 1 0 01.707-.293H17a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" />
              </svg>
              0851 5651 4096
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="#!" className="text-white/80 hover:text-white" aria-label="Facebook">f</a>
            <a href="#!" className="text-white/80 hover:text-white" aria-label="Instagram">ig</a>
            <a href="#!" className="text-white/80 hover:text-white" aria-label="LinkedIn">in</a>
            <a href="#!" className="text-white/80 hover:text-white" aria-label="Email">@</a>
          </div>
        </div>
      </div>

      {/* ========== MAIN HEADER / NAV ========== */}
      <header className="sticky top-0 z-50 border-b border-[#e8eaed] bg-white">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1D8B7A] font-bold text-white">
              H
            </div>
            <span className="text-xl font-bold tracking-tight text-[#1a1a2e]">Hisabia</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-[#5f6368] hover:text-[#1a1a2e]">
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#cta"
              className="hidden rounded-xl border-2 border-[#1D8B7A] bg-white px-4 py-2 text-sm font-semibold text-[#1D8B7A] transition hover:bg-[#1D8B7A]/5 sm:inline-block"
            >
              Hubungi Sales
            </a>
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1D8B7A] px-5 text-sm font-semibold text-white shadow-md transition hover:bg-[#177a6b]"
            >
              Login
            </Link>
          </div>
        </nav>
      </header>

      {/* ========== HERO (two columns: text left, illustration right) ========== */}
      <section className="border-b border-[#e8eaed] bg-white py-16 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 lg:flex-row lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl font-extrabold leading-tight text-[#1a1a2e] sm:text-5xl">
              Satu sistem untuk kelola operasional dan finansial bisnis Anda.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[#5f6368]">
              Kelola akuntansi, keuangan, inventori, laporan, dan operasional bisnis lainnya dalam satu platform terintegrasi. Hisabia akan bantu bisnis tumbuh lebih cepat.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-4">
              <Link
                to="/register"
                className="inline-flex h-14 items-center justify-center rounded-xl bg-[#1D8B7A] px-8 text-base font-semibold text-white shadow-lg transition hover:bg-[#177a6b]"
              >
                Coba Gratis Sekarang
              </Link>
              <a
                href="#cta"
                className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-[#1D8B7A] bg-white px-8 text-base font-semibold text-[#1D8B7A] transition hover:bg-[#1D8B7A]/5"
              >
                Jadwalkan Demo
              </a>
            </div>
            <p className="mt-6 text-sm text-[#9aa0a6]">Tersedia di browser • Install sebagai PWA di HP & desktop</p>
          </div>
          <div className="flex-1">
            {/* Free asset: Unsplash - business/finance; alternatif: unDraw.co/illustrations/financial-data */}
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=85"
              alt="Kelola bisnis dengan Hisabia"
              className="mx-auto h-80 w-full max-w-md rounded-2xl object-cover object-top shadow-xl sm:h-96"
            />
          </div>
        </div>
      </section>

      {/* ========== DIPERCAYA OLEH (logo strip) ========== */}
      <section className="border-b border-[#e8eaed] bg-[#f8f9fa] py-10">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-8 text-center text-sm font-medium text-[#5f6368]">Dipercaya oleh bisnis Indonesia</p>
          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-14">
            {["Retail", "F&B", "Grosir", "Toko Online", "UMKM"].map((name) => (
              <span key={name} className="text-lg font-semibold uppercase tracking-wider text-[#9aa0a6]">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ========== MENGAPA BISNIS ANDA MEMBUTUHKAN HISABIA (3 cards) ========== */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-[#1a1a2e] sm:text-4xl">
            Mengapa bisnis Anda membutuhkan Hisabia?
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {whyCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[#e8eaed] bg-white p-8 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1D8B7A]/10 text-[#1D8B7A]">
                  <IconPath d={card.icon} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-[#1a1a2e]">{card.title}</h3>
                <p className="mt-3 text-[#5f6368]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SOLUSI TERBAIK (sidebar kiri + screenshot kanan) ========== */}
      <section id="solusi" className="scroll-mt-20 border-t border-[#e8eaed] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-[#1a1a2e] sm:text-4xl">
            Solusi terbaik untuk setiap operasional bisnis Anda.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[#5f6368]">
            Kelola stok & gudang, buat transaksi POS, rekap keuangan, hingga laporan pajak siap pakai. Semua di Hisabia.
          </p>
          <div className="mt-14 flex flex-col gap-8 lg:flex-row">
            <div className="w-full rounded-2xl bg-[#1D8B7A] p-6 lg:w-72 lg:shrink-0">
              <nav className="flex flex-col gap-1">
                {featureNavItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveFeature(item.id)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                      activeFeature === item.id ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    <IconPath d={item.icon} />
                    {item.label}
                  </button>
                ))}
              </nav>
              <a
                href="#solusi"
                className="mt-6 flex w-full items-center justify-center rounded-lg border-2 border-white bg-transparent py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Lihat Semua Fitur
              </a>
            </div>
            <div className="min-h-[400px] flex-1 overflow-hidden rounded-2xl border border-[#e8eaed] bg-[#f8f9fa] shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
                alt="Dashboard Hisabia"
                className="h-full w-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========== KEUNTUNGAN MENGGUNAKAN HISABIA (6 grid) ========== */}
      <section id="keuntungan" className="scroll-mt-20 border-t border-[#e8eaed] bg-[#f8f9fa] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-[#1a1a2e] sm:text-4xl">
            Keuntungan menggunakan Hisabia
          </h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {advantageCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1D8B7A]/10 text-[#1D8B7A]">
                  <IconPath d={card.icon} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#1a1a2e]">{card.title}</h3>
                <p className="mt-2 text-sm text-[#5f6368]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== INTEGRASI ========== */}
      <section id="integrasi" className="scroll-mt-20 border-t border-[#e8eaed] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl bg-[#f8f9fa] p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md">
                <span className="text-2xl font-bold text-[#1D8B7A]">n8n</span>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md">
                <span className="text-sm font-semibold text-[#5f6368]">API</span>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md">
                <span className="text-sm font-semibold text-[#5f6368]">Webhook</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] sm:text-3xl">
                Dapatkan integrasi dengan aplikasi yang buat operasional bisnis Anda lebih maksimal.
              </h2>
              <p className="mt-4 text-[#5f6368]">
                Hisabia terintegrasi dengan n8n untuk otomasi workflow, API untuk koneksi ke e-commerce atau tools lain, dan webhook untuk event real-time. Kelola transaksi dan data secara akurat di satu tempat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONI ========== */}
      <section className="border-t border-[#e8eaed] bg-[#f8f9fa] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-[#1a1a2e] sm:text-3xl">
            Bagaimana Hisabia Mengembangkan Bisnis Berbagai Industri
          </h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1D8B7A]">Testimoni Pelanggan</p>
              <blockquote className="mt-4 text-lg text-[#5f6368]">
                &ldquo;Sejak pakai Hisabia, laporan keuangan dan stok jadi satu tempat. POS dan gudang terhubung, jadi kami tidak perlu input ulang. Sangat memudahkan operasional toko.&rdquo;
              </blockquote>
              <div className="mt-4 flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} aria-hidden>★</span>
                ))}
              </div>
              <p className="mt-2 font-semibold text-[#1a1a2e]">Pelaku UMKM Retail</p>
              <p className="text-sm text-[#5f6368]">Toko Serba Ada</p>
              <div className="mt-6 flex gap-3">
                <a href="#!" className="rounded-lg border-2 border-[#1D8B7A] bg-white px-4 py-2 text-sm font-semibold text-[#1D8B7A] hover:bg-[#1D8B7A]/5">
                  Baca Testimoni Lain
                </a>
                <a href="#cta" className="rounded-lg bg-[#1D8B7A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#177a6b]">
                  Lihat Case Study
                </a>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-[#1a1a2e]">
              <img
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80"
                alt="Testimoni pelanggan Hisabia"
                className="h-80 w-full object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
                <p className="text-sm font-medium">Dapatkan tips pengembangan bisnis dan keuangan Anda lewat panduan kami.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="scroll-mt-20 border-t border-[#e8eaed] bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-[#1a1a2e] sm:text-3xl">Apa itu Hisabia?</h2>
          <div className="mt-8 space-y-2">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#e8eaed] bg-white transition hover:border-[#1D8B7A]/30"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-[#1a1a2e]"
                >
                  {item.q}
                  <svg
                    className={`h-5 w-5 shrink-0 text-[#5f6368] transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="border-t border-[#e8eaed] px-5 pb-4 pt-2 text-sm text-[#5f6368]">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA BAND (pre-footer dark) ========== */}
      <section id="cta" className="scroll-mt-20 bg-[#0d3d36] py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Butuh solusi untuk kelola bisnis Anda?
            </h2>
            <p className="mt-2 text-white/90">
              Hubungi kami dan konsultasikan kebutuhan bisnis Anda bersama ahlinya.
            </p>
          </div>
          <a
            href="tel:+6285156514096"
            className="shrink-0 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#0d3d36] transition hover:bg-white/95"
          >
            Hubungi Sales
          </a>
        </div>
      </section>

      {/* ========== FOOTER (multi-column) ========== */}
      <footer className="bg-[#1a1a2e] text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1D8B7A] font-bold text-white">
                  H
                </div>
                <span className="text-xl font-bold">Hisabia</span>
              </Link>
              <p className="mt-4 max-w-sm text-sm text-white/70">
                Solusi akuntansi online terintegrasi untuk kelola keuangan, stok, laporan, dan operasional bisnis.
              </p>
              <div className="mt-6 flex gap-4">
                <a href="#!" className="text-white/70 hover:text-white" aria-label="Facebook">f</a>
                <a href="#!" className="text-white/70 hover:text-white" aria-label="Instagram">ig</a>
                <a href="#!" className="text-white/70 hover:text-white" aria-label="LinkedIn">in</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white">Produk</h4>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {footerProduct.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-white">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white">Perusahaan</h4>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {footerCompany.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-white">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white">Resources</h4>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {footerResources.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-white">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} Hisabia. Kebijakan Privasi · Syarat & Ketentuan
            </p>
            <p className="text-sm text-white/60">0851-5651-4096 · hisabia@example.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
