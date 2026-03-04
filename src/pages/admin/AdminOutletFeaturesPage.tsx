import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  OUTLET_FEATURE_LIST,
  type OutletFeatureKey,
  type OutletFeaturePermission,
} from "@/lib/outletFeatures";
import type { OrgRow, AdminOutletRow } from "./adminTypes";

export function AdminOutletFeaturesPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [featureOrgId, setFeatureOrgId] = useState<string>("");
  const [adminOutlets, setAdminOutlets] = useState<AdminOutletRow[]>([]);
  const [featureOutletId, setFeatureOutletId] = useState<string>("");
  const [featurePerms, setFeaturePerms] = useState<Record<string, OutletFeaturePermission>>({});
  const [featurePermsLoading, setFeaturePermsLoading] = useState(false);
  const [featurePermsSaving, setFeaturePermsSaving] = useState(false);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [outletsLoading, setOutletsLoading] = useState(false);

  useEffect(() => {
    supabase.rpc("get_admin_organizations").then(({ data }) => {
      const list = (data as OrgRow[] | null) ?? [];
      setOrgs(list);
      setOrgsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!featureOrgId) {
      setAdminOutlets([]);
      setFeatureOutletId("");
      setOutletsLoading(false);
      return;
    }
    setOutletsLoading(true);
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("get_admin_outlets", { p_org_id: featureOrgId });
      let list: AdminOutletRow[] = [];
      if (rpcError) {
        setAdminOutlets([]);
        setFeatureOutletId("");
      } else if (Array.isArray(data)) {
        list = data as AdminOutletRow[];
        setAdminOutlets(list);
        setFeatureOutletId(list[0]?.id ?? "");
      } else if (data && typeof data === "object" && "error" in data) {
        setAdminOutlets([]);
        setFeatureOutletId("");
      } else if (data && typeof data === "object" && data !== null) {
        const arr = (data as { data?: AdminOutletRow[] }).data;
        if (Array.isArray(arr)) {
          list = arr;
          setAdminOutlets(list);
          setFeatureOutletId(list[0]?.id ?? "");
        } else {
          setAdminOutlets([]);
          setFeatureOutletId("");
        }
      }
      setOutletsLoading(false);
    })();
  }, [featureOrgId]);

  useEffect(() => {
    if (!featureOutletId) {
      setFeaturePerms({});
      return;
    }
    setFeaturePermsLoading(true);
    (async () => {
      const { data } = await supabase
        .from("outlet_feature_permissions")
        .select("feature_key, can_create, can_read, can_update, can_delete")
        .eq("outlet_id", featureOutletId);
      const rows = (data ?? []) as {
        feature_key: string;
        can_create: boolean;
        can_read: boolean;
        can_update: boolean;
        can_delete: boolean;
      }[];
      const map: Record<string, OutletFeaturePermission> = {};
      for (const r of rows) {
        map[r.feature_key] = {
          can_create: r.can_create,
          can_read: r.can_read,
          can_update: r.can_update,
          can_delete: r.can_delete,
        };
      }
      setFeaturePerms(map);
      setFeaturePermsLoading(false);
    })();
  }, [featureOutletId]);

  function getFeaturePerm(key: OutletFeatureKey): OutletFeaturePermission {
    return (
      featurePerms[key] ?? {
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
      }
    );
  }

  function setFeaturePerm(key: OutletFeatureKey, field: keyof OutletFeaturePermission, value: boolean) {
    setFeaturePerms((prev) => ({
      ...prev,
      [key]: {
        ...getFeaturePerm(key),
        [field]: value,
      },
    }));
  }

  async function handleSaveFeaturePerms() {
    if (!featureOutletId) return;
    setFeaturePermsSaving(true);
    const rows = OUTLET_FEATURE_LIST.map(({ key }) => {
      const p = getFeaturePerm(key);
      return {
        outlet_id: featureOutletId,
        feature_key: key,
        can_create: p.can_create,
        can_read: p.can_read,
        can_update: p.can_update,
        can_delete: p.can_delete,
      };
    });
    await supabase.from("outlet_feature_permissions").upsert(rows, {
      onConflict: "outlet_id,feature_key",
    });
    setFeaturePermsSaving(false);
  }

  if (orgsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Fitur per Outlet</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Atur fitur mana yang tampil dan CRUD (Create, Read, Update, Delete) per outlet. Kosong = semua diizinkan.
          Berlaku tanpa tergantung paket langganan.
        </p>
      </div>

      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle>Fitur per Outlet</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Pilih organisasi lalu outlet, lalu ubah permission dan simpan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Organisasi</label>
              <select
                className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={featureOrgId}
                onChange={(e) => setFeatureOrgId(e.target.value)}
              >
                <option value="">— Pilih organisasi —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Outlet</label>
              <select
                className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60"
                value={featureOutletId}
                onChange={(e) => setFeatureOutletId(e.target.value)}
                disabled={!featureOrgId}
              >
                <option value="">
                  {!featureOrgId
                    ? "— Pilih organisasi dulu —"
                    : outletsLoading
                      ? "Memuat outlet..."
                      : adminOutlets.length === 0
                        ? "Tidak ada outlet"
                        : "— Pilih outlet —"}
                </option>
                {adminOutlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.outlet_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {featureOutletId && (
            <>
              {featurePermsLoading ? (
                <p className="text-sm text-[var(--muted-foreground)]">Memuat...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                        <th className="pb-2 font-medium">Fitur</th>
                        <th className="pb-2 text-center font-medium">Create</th>
                        <th className="pb-2 text-center font-medium">Read (tampil)</th>
                        <th className="pb-2 text-center font-medium">Update</th>
                        <th className="pb-2 text-center font-medium">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OUTLET_FEATURE_LIST.map(({ key, label }) => (
                        <tr key={key} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-2 font-medium">{label}</td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getFeaturePerm(key).can_create}
                              onChange={(e) => setFeaturePerm(key, "can_create", e.target.checked)}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getFeaturePerm(key).can_read}
                              onChange={(e) => setFeaturePerm(key, "can_read", e.target.checked)}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getFeaturePerm(key).can_update}
                              onChange={(e) => setFeaturePerm(key, "can_update", e.target.checked)}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getFeaturePerm(key).can_delete}
                              onChange={(e) => setFeaturePerm(key, "can_delete", e.target.checked)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Button
                onClick={handleSaveFeaturePerms}
                disabled={featurePermsSaving || featurePermsLoading}
                className="mt-4"
              >
                {featurePermsSaving ? "Menyimpan..." : "Simpan fitur outlet ini"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
