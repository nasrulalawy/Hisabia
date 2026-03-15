import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Onboarding } from "@/pages/Onboarding";
import { Logout } from "@/pages/Logout";
import { OrgLayout } from "@/pages/OrgLayout";
import { Dashboard } from "@/pages/dashboard/Dashboard";
import { KategoriPage } from "@/pages/crud/KategoriPage";
import { SatuanPage } from "@/pages/crud/SatuanPage";
import { SupplierPage } from "@/pages/crud/SupplierPage";
import { PelangganPage } from "@/pages/crud/PelangganPage";
import { ProdukListPage } from "@/pages/crud/ProdukListPage";
import { ProdukFormPage } from "@/pages/crud/ProdukFormPage";
import { ProdukDetailPage } from "@/pages/produk/ProdukDetailPage";
import { BahanPage } from "@/pages/crud/BahanPage";
import { ArusKasPage } from "@/pages/crud/ArusKasPage";
import { HutangPiutangPage } from "@/pages/crud/HutangPiutangPage";
import { GudangPage } from "@/pages/crud/GudangPage";
import { StokPage } from "@/pages/stok/StokPage";
import { StokTokoPage } from "@/pages/stok/StokTokoPage";
import { OpnameListPage } from "@/pages/stok/OpnameListPage";
import { OpnameDetailPage } from "@/pages/stok/OpnameDetailPage";
import { PembelianPage } from "@/pages/pembelian/PembelianPage";
import { PembelianBahanPage } from "@/pages/pembelian/PembelianBahanPage";
import { OutletsPage } from "@/pages/crud/OutletsPage";
import { PosPage } from "@/pages/pos/PosPage";
import { LaporanPage } from "@/pages/reports/LaporanPage";
import { JurnalUmumPage } from "@/pages/accounting/JurnalUmumPage";
import { BukuBesarPage } from "@/pages/accounting/BukuBesarPage";
import { NeracaPage } from "@/pages/accounting/NeracaPage";
import { LabaRugiPage } from "@/pages/accounting/LabaRugiPage";
import { NeracaSaldoPage } from "@/pages/accounting/NeracaSaldoPage";
import { TutupBukuPage } from "@/pages/accounting/TutupBukuPage";
import { LaporanAgingPage } from "@/pages/accounting/LaporanAgingPage";
import { DashboardKeuanganPage } from "@/pages/accounting/DashboardKeuanganPage";
import { FixedAssetListPage } from "@/pages/accounting/FixedAssetListPage";
import { FixedAssetFormPage } from "@/pages/accounting/FixedAssetFormPage";
import { PenawaranListPage } from "@/pages/sales/PenawaranListPage";
import { PenawaranFormPage } from "@/pages/sales/PenawaranFormPage";
import { InvoiceListPage } from "@/pages/sales/InvoiceListPage";
import { InvoiceFormPage } from "@/pages/sales/InvoiceFormPage";
import { PengirimanListPage } from "@/pages/sales/PengirimanListPage";
import { PengirimanFormPage } from "@/pages/sales/PengirimanFormPage";
import { SubscriptionPage } from "@/pages/subscription/SubscriptionPage";
import { PaymentSuccessPage } from "@/pages/subscription/PaymentSuccessPage";
import { PaymentFinishPage } from "@/pages/subscription/PaymentFinishPage";
import { SubscriptionPayPage } from "@/pages/subscription/SubscriptionPayPage";
import { ShopPage } from "@/pages/shop/ShopPage";
import { CatalogPage } from "@/pages/shop/CatalogPage";
import { OrderDetailPage } from "@/pages/order/OrderDetailPage";
import { TokoPage } from "@/pages/settings/TokoPage";
import { ReceiptSettingsPage } from "@/pages/settings/ReceiptSettingsPage";
import { IntegrasiPage } from "@/pages/settings/IntegrasiPage";
import { KreditSyariahPage } from "@/pages/kredit-syariah/KreditSyariahPage";
import { KreditSyariahFormPage } from "@/pages/kredit-syariah/KreditSyariahFormPage";
import { KreditSyariahDetailPage } from "@/pages/kredit-syariah/KreditSyariahDetailPage";
import { KaryawanPage } from "@/pages/crud/KaryawanPage";
import { KategoriKaryawanPage } from "@/pages/crud/KategoriKaryawanPage";
import { DaftarPelanggan } from "@/pages/DaftarPelanggan";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminOrganisationsPage } from "@/pages/admin/AdminOrganisationsPage";
import { AdminPlansPage } from "@/pages/admin/AdminPlansPage";
import { AdminOutletFeaturesPage } from "@/pages/admin/AdminOutletFeaturesPage";
import { InstallPWA } from "@/components/InstallPWA";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeRedirect, setHomeRedirect] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user: u } }) => {
        setUser(u as { id: string } | null);
      })
      .catch(() => {
        // Koneksi gagal (timeout, offline, dll): anggap tidak ada session agar loading berhenti
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as { id: string } | undefined) ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || location.pathname !== "/") return;
    setHomeRedirect(null);
    (async () => {
      const { data: isOwner } = await supabase.rpc("is_saas_owner");
      if (isOwner === true) {
        setHomeRedirect("/admin");
        return;
      }
      const { data: orgData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (orgData?.organization_id) {
        setHomeRedirect(`/org/${orgData.organization_id}/dashboard`);
        return;
      }
      const { data: customerData } = await supabase
        .from("customers")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (customerData?.organization_id) {
        setHomeRedirect(`/katalog/${customerData.organization_id}`);
        return;
      }
      setHomeRedirect("/onboarding");
    })();
  }, [user, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user && location.pathname.startsWith("/org")) {
    return <Navigate to="/login" replace />;
  }
  if (!user && location.pathname.startsWith("/admin")) {
    return <Navigate to="/login" replace />;
  }
  if (!user && location.pathname === "/onboarding") {
    return <Navigate to="/login" replace />;
  }
  if (user && (location.pathname === "/login" || location.pathname === "/register")) {
    return <Navigate to="/" replace />;
  }
  if (user && location.pathname === "/") {
    if (!homeRedirect) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      );
    }
    return <Navigate to={homeRedirect} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthGuard>
      <InstallPWA />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/shop/:token" element={<ShopPage />} />
        <Route path="/katalog/:orgId" element={<CatalogPage />} />
        <Route path="/daftar-pelanggan" element={<DaftarPelanggan />} />
        <Route path="/order/:token" element={<OrderDetailPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="organisations" element={<AdminOrganisationsPage />} />
          <Route path="plans" element={<AdminPlansPage />} />
          <Route path="outlet-features" element={<AdminOutletFeaturesPage />} />
        </Route>
        <Route path="/org/:orgId" element={<OrgLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="kategori" element={<KategoriPage />} />
          <Route path="produk" element={<ProdukListPage />} />
          <Route path="produk/tambah" element={<ProdukFormPage />} />
          <Route path="produk/:id/edit" element={<ProdukFormPage />} />
          <Route path="produk/:id" element={<ProdukDetailPage />} />
          <Route path="bahan" element={<BahanPage />} />
          <Route path="satuan" element={<SatuanPage />} />
          <Route path="supplier" element={<SupplierPage />} />
          <Route path="pelanggan" element={<PelangganPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="penawaran" element={<PenawaranListPage />} />
          <Route path="penawaran/tambah" element={<PenawaranFormPage />} />
          <Route path="penawaran/:id/edit" element={<PenawaranFormPage />} />
          <Route path="invoice-penjualan" element={<InvoiceListPage />} />
          <Route path="invoice-penjualan/tambah" element={<InvoiceFormPage />} />
          <Route path="invoice-penjualan/:id/edit" element={<InvoiceFormPage />} />
          <Route path="pengiriman" element={<PengirimanListPage />} />
          <Route path="pengiriman/tambah" element={<PengirimanFormPage />} />
          <Route path="pengiriman/:id/edit" element={<PengirimanFormPage />} />
          <Route path="arus-kas" element={<ArusKasPage />} />
          <Route path="hutang-piutang" element={<HutangPiutangPage />} />
          <Route path="jurnal" element={<JurnalUmumPage />} />
          <Route path="aset-tetap" element={<FixedAssetListPage />} />
          <Route path="aset-tetap/tambah" element={<FixedAssetFormPage />} />
          <Route path="aset-tetap/:id/edit" element={<FixedAssetFormPage />} />
          <Route path="neraca-saldo" element={<NeracaSaldoPage />} />
          <Route path="buku-besar" element={<BukuBesarPage />} />
          <Route path="neraca" element={<NeracaPage />} />
          <Route path="laba-rugi" element={<LabaRugiPage />} />
          <Route path="tutup-buku" element={<TutupBukuPage />} />
          <Route path="umur-piutang-hutang" element={<LaporanAgingPage />} />
          <Route path="dashboard-keuangan" element={<DashboardKeuanganPage />} />
          <Route path="accounting" element={<LaporanPage />} />
          <Route path="pembelian" element={<PembelianPage />} />
          <Route path="pembelian-bahan" element={<PembelianBahanPage />} />
          <Route path="stok" element={<StokPage />} />
          <Route path="stok-toko" element={<StokTokoPage />} />
          <Route path="opname" element={<OpnameListPage />} />
          <Route path="opname/:sessionId" element={<OpnameDetailPage />} />
          <Route path="gudang" element={<GudangPage />} />
          <Route path="outlets" element={<OutletsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="subscription/pay/:planId" element={<SubscriptionPayPage />} />
          <Route path="subscription/success" element={<PaymentSuccessPage />} />
          <Route path="subscription/finish" element={<PaymentFinishPage />} />
          <Route path="toko" element={<TokoPage />} />
          <Route path="pengaturan-struk" element={<ReceiptSettingsPage />} />
          <Route path="integrasi" element={<IntegrasiPage />} />
          <Route path="karyawan" element={<KaryawanPage />} />
          <Route path="kategori-karyawan" element={<KategoriKaryawanPage />} />
          <Route path="kredit-syariah" element={<KreditSyariahPage />} />
          <Route path="kredit-syariah/baru" element={<KreditSyariahFormPage />} />
          <Route path="kredit-syariah/:akadId" element={<KreditSyariahDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthGuard>
  );
}
