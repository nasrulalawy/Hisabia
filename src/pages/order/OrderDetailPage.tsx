import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";

interface OrderDetail {
  id: string;
  order_token: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  created_at: string;
  customer_name: string | null;
  organization_name: string | null;
  items: { name: string; price: number; quantity: number }[];
}

export function OrderDetailPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link tidak valid");
      setLoading(false);
      return;
    }
    supabase
      .rpc("get_order_by_token", { p_token: token })
      .then(({ data, error: rpcError }) => {
        const res = data as { error?: string } & OrderDetail | null;
        if (rpcError) {
          setError(rpcError.message || "Gagal memuat");
          return;
        }
        if (res?.error) {
          setError(res.error);
          return;
        }
        if (res && "id" in res) setOrder(res);
      })
      .catch((err) => setError((err as Error).message || "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--muted)] p-6">
        <p className="text-center text-lg text-red-600">{error || "Pesanan tidak ditemukan"}</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    pending: "Menunggu Konfirmasi",
    paid: "Lunas",
    canceled: "Dibatalkan",
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-sm">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            {order.organization_name || "Detail Pesanan"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            #{order.id.slice(0, 8)} · {formatDate(order.created_at)}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
              order.status === "paid"
                ? "bg-emerald-100 text-emerald-700"
                : order.status === "canceled"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {statusLabel[order.status] || order.status}
          </span>

          {order.customer_name && (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Pelanggan: {order.customer_name}
            </p>
          )}

          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex justify-between text-sm"
              >
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatIdr(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Subtotal</span>
              <span>{formatIdr(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Diskon</span>
                <span>−{formatIdr(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-[var(--primary)]">{formatIdr(order.total)}</span>
            </div>
          </div>
          {order.notes && (
            <p className="mt-4 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted-foreground)]">
              Catatan: {order.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
