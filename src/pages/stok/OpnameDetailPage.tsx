import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { StockOpnameSession, StockOpnameLine } from "@/lib/database.types";
import type { Product } from "@/lib/database.types";
import type { Warehouse } from "@/lib/database.types";

interface LineWithProduct extends StockOpnameLine {
  products?: { name: string; stock: number } | null;
}

interface SessionWithWarehouse extends StockOpnameSession {
  warehouses?: { name: string } | null;
}

const VARIANCE_REASONS: { value: string; label: string }[] = [
  { value: "", label: "— Pilih penyebab —" },
  { value: "hilang", label: "Hilang" },
  { value: "rusak", label: "Rusak" },
  { value: "kadaluarsa", label: "Kadaluarsa" },
  { value: "lebih", label: "Stok lebih (kelebihan)" },
  { value: "lainnya", label: "Lainnya" },
];

export function OpnameDetailPage() {
  const { orgId, sessionId } = useParams<{ orgId: string; sessionId: string }>();
  const { orgId: ctxOrgId } = useOrg();
  const navigate = useNavigate();
  const baseOrgId = orgId ?? ctxOrgId;

  const [session, setSession] = useState<SessionWithWarehouse | null>(null);
  const [lines, setLines] = useState<LineWithProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = sessionId === "baru";

  // Form for new session
  const [newWarehouseId, setNewWarehouseId] = useState<string>("");
  const [newNotes, setNewNotes] = useState("");

  // Local edits for physical_qty and variance_reason (draft only)
  const [physicalMap, setPhysicalMap] = useState<Record<string, string>>({});
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!baseOrgId) return;
    if (isNew) {
      Promise.all([
        supabase.from("products").select("*").eq("organization_id", baseOrgId).order("name"),
        supabase.from("warehouses").select("*").eq("organization_id", baseOrgId).order("name"),
      ]).then(([pRes, wRes]) => {
        setProducts(pRes.data ?? []);
        setWarehouses(wRes.data ?? []);
        setNewWarehouseId(wRes.data?.[0]?.id ?? "");
        setLoading(false);
      });
      return;
    }
    setLoading(true);
    supabase
      .from("stock_opname_sessions")
      .select("*, warehouses(name)")
      .eq("id", sessionId)
      .single()
      .then(({ data: sessData, error: sessErr }) => {
        if (sessErr || !sessData) {
          setSession(null);
          setLoading(false);
          return;
        }
        const sess = sessData as SessionWithWarehouse;
        setSession(sess);
        supabase
          .from("stock_opname_lines")
          .select("*, products(name, stock)")
          .eq("opname_session_id", sessionId)
          .order("created_at")
          .then(({ data: linesData }) => {
            const lineList = (linesData as LineWithProduct[]) ?? [];
            setLines(lineList);
            const physMap: Record<string, string> = {};
            const reasonMapInit: Record<string, string> = {};
            lineList.forEach((l) => {
              physMap[l.product_id] = l.physical_qty != null ? String(l.physical_qty) : "";
              reasonMapInit[l.product_id] = l.variance_reason ?? "";
            });
            setPhysicalMap(physMap);
            setReasonMap(reasonMapInit);
            setLoading(false);
          });
      });
  }, [baseOrgId, sessionId, isNew]);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!baseOrgId) return;
    setSaving(true);
    setError(null);
    const { data: sess, error: insErr } = await supabase
      .from("stock_opname_sessions")
      .insert({
        organization_id: baseOrgId,
        warehouse_id: newWarehouseId || null,
        status: "draft",
        notes: newNotes.trim() || null,
      })
      .select("id")
      .single();
    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }
    const sessionIdNew = sess.id;
    if (products.length > 0) {
      const lineRows = products.map((p) => ({
        opname_session_id: sessionIdNew,
        product_id: p.id,
        system_qty: Number(p.stock ?? 0),
        physical_qty: null,
        adjustment_qty: 0,
      }));
      const { error: linesErr } = await supabase.from("stock_opname_lines").insert(lineRows);
      if (linesErr) {
        setError(linesErr.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    navigate(`/org/${baseOrgId}/opname/${sessionIdNew}`, { replace: true });
  }

  function getAdjustment(line: LineWithProduct): number {
    const phys = physicalMap[line.product_id];
    if (phys === "" || phys == null) return 0;
    const p = parseFloat(phys);
    if (Number.isNaN(p)) return 0;
    return p - Number(line.system_qty);
  }

  async function saveDraft() {
    if (!sessionId || session?.status !== "draft") return;
    setSaving(true);
    setError(null);
    for (const line of lines) {
      const phys = physicalMap[line.product_id];
      const physical_qty = phys === "" || phys == null ? null : parseFloat(phys);
      const adjustment_qty = physical_qty != null ? physical_qty - Number(line.system_qty) : 0;
      const variance_reason = (reasonMap[line.product_id]?.trim() || null) as string | null;
      await supabase
        .from("stock_opname_lines")
        .update({
          physical_qty: physical_qty,
          adjustment_qty: adjustment_qty,
          variance_reason: variance_reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", line.id);
    }
    setSaving(false);
  }

  async function handleFinalize() {
    if (!sessionId || session?.status !== "draft") return;
    setError(null);
    setFinalizing(true);
    for (const line of lines) {
      const phys = physicalMap[line.product_id];
      const physical_qty = phys === "" || phys == null ? null : parseFloat(phys);
      const adjustment_qty = physical_qty != null ? physical_qty - Number(line.system_qty) : 0;
      const variance_reason = (reasonMap[line.product_id]?.trim() || null) as string | null;
      await supabase
        .from("stock_opname_lines")
        .update({
          physical_qty: physical_qty,
          adjustment_qty: adjustment_qty,
          variance_reason: variance_reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", line.id);
    }
    const { data, error: rpcErr } = await supabase.rpc("finalize_stock_opname", {
      p_session_id: sessionId,
    });
    setFinalizing(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const res = data as { error?: string; success?: boolean };
    if (res?.error) {
      setError(res.error);
      return;
    }
    const { data: updated } = await supabase
      .from("stock_opname_sessions")
      .select("*, warehouses(name)")
      .eq("id", sessionId)
      .single();
    if (updated) setSession(updated as SessionWithWarehouse);
  }

  if (loading && !isNew) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="space-y-6">
        <div>
          <Link to={`/org/${baseOrgId}/opname`} className="text-sm text-[var(--primary)] hover:underline">
            ← Daftar Opname
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Buat Sesi Opname Baru</h2>
          <p className="text-[var(--muted-foreground)]">Pilih lokasi dan buat daftar hitung fisik.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lokasi & Catatan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSession} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Lokasi</label>
                <select
                  value={newWarehouseId}
                  onChange={(e) => setNewWarehouseId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="">Stok Toko (tanpa gudang)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan (opsional)</label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Contoh: Opname akhir bulan"
                />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                Setelah dibuat, Anda akan mengisi stok fisik per produk lalu menyimpan dan finalisasi.
              </p>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Membuat..." : "Buat Sesi"}
                </Button>
                <Link to={`/org/${baseOrgId}/opname`}>
                  <Button type="button" variant="outline">Batal</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Link to={`/org/${baseOrgId}/opname`} className="text-sm text-[var(--primary)] hover:underline">
          ← Daftar Opname
        </Link>
        <p className="text-[var(--muted-foreground)]">Sesi tidak ditemukan.</p>
      </div>
    );
  }

  const isDraft = session.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/org/${baseOrgId}/opname`} className="text-sm text-[var(--primary)] hover:underline">
            ← Daftar Opname
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Stock Opname — {formatDate(session.created_at)}
          </h2>
          <p className="text-[var(--muted-foreground)]">
            {session.warehouse_id ? session.warehouses?.name ?? "Gudang" : "Stok Toko"}
            {" · "}
            <Badge variant={isDraft ? "warning" : "success"}>{isDraft ? "Draft" : "Finalized"}</Badge>
          </p>
        </div>
        {isDraft && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveDraft} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Draft"}
            </Button>
            <Button onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? "Memfinalisasi..." : "Finalisasi Opname"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {session.notes && (
        <p className="text-sm text-[var(--muted-foreground)]">Catatan: {session.notes}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Hitung (Stok Sistem vs Fisik)</CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="py-6 text-center text-[var(--muted-foreground)]">Belum ada baris. Buat sesi baru dengan produk.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Produk</th>
                    <th className="pb-2 font-medium text-right">Stok Sistem</th>
                    <th className="pb-2 font-medium text-right">Stok Fisik</th>
                    <th className="pb-2 font-medium text-right">Selisih</th>
                    <th className="pb-2 font-medium">Penyebab selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const adj = getAdjustment(line);
                    const reasonValue = isDraft ? (reasonMap[line.product_id] ?? "") : (line.variance_reason ?? "");
                    const reasonLabel = reasonValue ? (VARIANCE_REASONS.find((r) => r.value === reasonValue)?.label ?? reasonValue) : "—";
                    return (
                      <tr key={line.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2">{line.products?.name ?? "-"}</td>
                        <td className="py-2 text-right">{Number(line.system_qty)}</td>
                        <td className="py-2 text-right">
                          {isDraft ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-9 w-24 text-right"
                              value={physicalMap[line.product_id] ?? ""}
                              onChange={(e) =>
                                setPhysicalMap((m) => ({ ...m, [line.product_id]: e.target.value }))
                              }
                              placeholder="-"
                            />
                          ) : (
                            line.physical_qty != null ? Number(line.physical_qty) : "-"
                          )}
                        </td>
                        <td className={`py-2 text-right font-medium ${adj > 0 ? "text-emerald-600" : adj < 0 ? "text-red-600" : ""}`}>
                          {adj > 0 ? "+" : ""}{adj}
                        </td>
                        <td className="py-2">
                          {isDraft ? (
                            adj !== 0 ? (
                              <select
                                value={reasonMap[line.product_id] ?? ""}
                                onChange={(e) =>
                                  setReasonMap((m) => ({ ...m, [line.product_id]: e.target.value }))
                                }
                                className="h-9 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                              >
                                {VARIANCE_REASONS.map((r) => (
                                  <option key={r.value || "_"} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[var(--muted-foreground)]">—</span>
                            )
                          ) : (
                            <span className="text-[var(--muted-foreground)]">
                              {reasonLabel || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
