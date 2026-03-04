import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OrgProvider } from "@/contexts/OrgContext";
import { normalizeOutletPermissions } from "@/lib/outletFeatures";
import { normalizeEmployeePermissions } from "@/lib/employeeFeatures";
import type {
  Outlet as OutletType,
  Employee,
  EmployeeRoleFeaturePermission,
} from "@/lib/database.types";

const OUTLET_COOKIE = "hisabia-current-outlet";

function getOutletIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(^| )${OUTLET_COOKIE}=([^;]+)`));
  return m ? m[2] : null;
}

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  cashier: "Kasir",
  member: "Member",
};

export function OrgLayout() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [role, setRole] = useState<string>("member");
  const [outlets, setOutlets] = useState<OutletType[] | null>(null);
  const [currentOutletId, setCurrentOutletId] = useState<string | null>(null);
  const [outletFeaturePermissions, setOutletFeaturePermissions] = useState<Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> | null>(null);
  const [organizationFeatureGrants, setOrganizationFeatureGrants] = useState<string[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [employeeFeaturePermissions, setEmployeeFeaturePermissions] = useState<
    Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    const run = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigate("/login", { replace: true });
        return;
      }
      setUser(u);

      const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", u.id)
        .single();
      if (!membership) {
        const { data: customerOrg } = await supabase
          .from("customers")
          .select("organization_id")
          .eq("user_id", u.id)
          .limit(1)
          .maybeSingle();
        if (customerOrg?.organization_id) {
          navigate(`/katalog/${customerOrg.organization_id}`, { replace: true });
        } else {
          navigate("/onboarding", { replace: true });
        }
        return;
      }
      setRole(roleLabels[membership.role] ?? membership.role);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.id)
        .single();
      setProfile(profileData ?? null);

      const { data: outletsData } = await supabase
        .from("outlets")
        .select("*")
        .eq("organization_id", orgId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      setOutlets(outletsData ?? []);

      const cookieOutlet = getOutletIdFromCookie();
      const validOutlet =
        cookieOutlet && outletsData?.some((o) => o.id === cookieOutlet)
          ? cookieOutlet
          : outletsData?.[0]?.id ?? null;
      setCurrentOutletId(validOutlet);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("organization_id", orgId)
        .maybeSingle();
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const now = new Date();
      // Paket dianggap habis jika period_end sudah lewat (trialing/active/past_due) atau status canceled
      const periodExpired = !!(sub && periodEnd && periodEnd < now);
      const subscriptionExpired = periodExpired || sub?.status === "canceled";
      setTrialExpired(!!subscriptionExpired);

      const { data: grantsData } = await supabase
        .from("organization_feature_grants")
        .select("feature_key")
        .eq("organization_id", orgId);
      setOrganizationFeatureGrants((grantsData ?? []).map((r: { feature_key: string }) => r.feature_key));

      // Karyawan & hak akses kategori karyawan untuk user login (jika ada)
      const { data: employeeData } = await supabase
        .from("employees")
        .select("*")
        .eq("organization_id", orgId)
        .eq("user_id", u.id)
        .maybeSingle();
      if (employeeData) {
        const emp = employeeData as Employee;
        setCurrentEmployee(emp);
        if (emp.employee_role_id) {
          const { data: empPermRows } = await supabase
            .from("employee_role_feature_permissions")
            .select("employee_role_id, feature_key, can_create, can_read, can_update, can_delete")
            .eq("employee_role_id", emp.employee_role_id);
          setEmployeeFeaturePermissions(
            normalizeEmployeePermissions(
              (empPermRows ?? []) as EmployeeRoleFeaturePermission[]
            )
          );
        } else {
          setEmployeeFeaturePermissions(null);
        }
      } else {
        setCurrentEmployee(null);
        setEmployeeFeaturePermissions(null);
      }

      setLoading(false);
    };
    run();
  }, [orgId, navigate]);

  // Load outlet feature permissions when current outlet changes
  useEffect(() => {
    if (!currentOutletId) {
      setOutletFeaturePermissions(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("outlet_feature_permissions")
        .select("feature_key, can_create, can_read, can_update, can_delete")
        .eq("outlet_id", currentOutletId);
      if (!cancelled && data) {
        setOutletFeaturePermissions(normalizeOutletPermissions(data));
      } else if (!cancelled) {
        setOutletFeaturePermissions({});
      }
    })();
    return () => { cancelled = true; };
  }, [currentOutletId]);

  if (loading || !orgId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const basePath = `/org/${orgId}`;
  const location = useLocation();
  const isPosPage = location.pathname === `${basePath}/pos`;
  const isSubscriptionPage = location.pathname === `${basePath}/subscription`;

  const currentOutlet =
    outlets?.find((o) => o.id === currentOutletId) ?? outlets?.[0] ?? null;
  const currentOutletType: import("@/lib/database.types").OutletType =
    currentOutlet?.outlet_type ?? "mart";

  // POS: full-screen tanpa sidebar & header (page baru) — blokir jika paket expired
  if (isPosPage) {
    if (trialExpired) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] p-4">
          <p className="text-center font-medium text-amber-800">Masa berlaku paket telah berakhir.</p>
          <Link
            to={`${basePath}/subscription`}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Ke halaman Langganan
          </Link>
        </div>
      );
    }
    return (
      <OrgProvider
        value={{
          orgId,
          outlets: outlets ?? [],
          currentOutletId,
          currentOutlet,
          currentOutletType,
          outletFeaturePermissions,
          organizationFeatureGrants,
          currentEmployee,
          employeeFeaturePermissions,
        }}
      >
        <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
          <Outlet />
        </div>
      </OrgProvider>
    );
  }

  return (
    <OrgProvider
      value={{
        orgId,
        outlets: outlets ?? [],
        currentOutletId,
        currentOutlet,
        currentOutletType,
        outletFeaturePermissions,
        organizationFeatureGrants,
        currentEmployee,
        employeeFeaturePermissions,
      }}
    >
      <div className="flex h-screen overflow-hidden bg-[var(--muted)]">
        <Sidebar
          basePath={basePath}
          outletType={currentOutletType}
          mobileOpen={sidebarMobileOpen}
          onMobileClose={() => setSidebarMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            user={{
              name: profile?.full_name ?? user?.email ?? undefined,
              role,
            }}
            outlets={outlets}
            currentOutletId={currentOutletId}
            orgId={orgId}
            onMenuClick={() => setSidebarMobileOpen(true)}
          />
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {trialExpired && !isSubscriptionPage && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-800">
                <p className="text-lg font-semibold">Masa berlaku paket telah berakhir</p>
                <p className="mt-2 text-sm">Perpanjang atau upgrade paket untuk melanjutkan menggunakan Hisabia.</p>
                <Link
                  to={`${basePath}/subscription`}
                  className="mt-4 inline-block rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Ke halaman Langganan →
                </Link>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </OrgProvider>
  );
}
