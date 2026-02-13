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
import { ArusKasPage } from "@/pages/crud/ArusKasPage";
import { HutangPiutangPage } from "@/pages/crud/HutangPiutangPage";
import { GudangPage } from "@/pages/crud/GudangPage";
import { StokPage } from "@/pages/stok/StokPage";
import { StokTokoPage } from "@/pages/stok/StokTokoPage";
import { PembelianPage } from "@/pages/pembelian/PembelianPage";
import { OutletsPage } from "@/pages/crud/OutletsPage";
import { PosPage } from "@/pages/pos/PosPage";
import { LaporanPage } from "@/pages/reports/LaporanPage";
import { SubscriptionPage } from "@/pages/subscription/SubscriptionPage";
import { PaymentSuccessPage } from "@/pages/subscription/PaymentSuccessPage";
import { ShopPage } from "@/pages/shop/ShopPage";
import { CatalogPage } from "@/pages/shop/CatalogPage";
import { OrderDetailPage } from "@/pages/order/OrderDetailPage";
import { TokoPage } from "@/pages/settings/TokoPage";
import { DaftarPelanggan } from "@/pages/DaftarPelanggan";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { InstallPWA } from "@/components/InstallPWA";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeRedirect, setHomeRedirect] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u as { id: string } | null);
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
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/org/:orgId" element={<OrgLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="kategori" element={<KategoriPage />} />
          <Route path="produk" element={<ProdukListPage />} />
          <Route path="produk/tambah" element={<ProdukFormPage />} />
          <Route path="produk/:id/edit" element={<ProdukFormPage />} />
          <Route path="produk/:id" element={<ProdukDetailPage />} />
          <Route path="satuan" element={<SatuanPage />} />
          <Route path="supplier" element={<SupplierPage />} />
          <Route path="pelanggan" element={<PelangganPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="arus-kas" element={<ArusKasPage />} />
          <Route path="hutang-piutang" element={<HutangPiutangPage />} />
          <Route path="accounting" element={<LaporanPage />} />
          <Route path="pembelian" element={<PembelianPage />} />
          <Route path="stok" element={<StokPage />} />
          <Route path="stok-toko" element={<StokTokoPage />} />
          <Route path="gudang" element={<GudangPage />} />
          <Route path="outlets" element={<OutletsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="subscription/success" element={<PaymentSuccessPage />} />
          <Route path="toko" element={<TokoPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthGuard>
  );
}
