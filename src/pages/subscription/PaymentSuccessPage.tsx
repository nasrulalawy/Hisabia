import { Link, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatIdr } from "@/lib/utils";

export function PaymentSuccessPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const location = useLocation();
  const state = location.state as { planName?: string; amount?: number; pending?: boolean } | null;
  const planName = state?.planName ?? "Langganan";
  const amount = state?.amount ?? 0;
  const isPending = state?.pending ?? false;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isPending ? "bg-amber-100" : "bg-emerald-100"
            }`}
          >
            {isPending ? (
              <svg
                className="h-10 w-10 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-10 w-10 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {isPending ? "Menunggu Pembayaran" : "Pembayaran Berhasil"}
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {isPending
              ? "Pembayaran Anda sedang diproses. Subscription akan diaktifkan setelah pembayaran dikonfirmasi."
              : "Terima kasih! Pembayaran Anda telah kami terima."}
          </p>
          {planName && (
            <div className="mt-6 rounded-lg bg-[var(--muted)]/50 px-4 py-3">
              <p className="text-sm text-[var(--muted-foreground)]">Paket</p>
              <p className="font-semibold text-[var(--foreground)]">{planName}</p>
              {amount > 0 && (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {formatIdr(amount)} / bulan
                </p>
              )}
            </div>
          )}
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            {isPending
              ? "Anda akan menerima notifikasi setelah pembayaran berhasil diproses."
              : "Subscription Anda telah diaktifkan. Anda dapat melanjutkan menggunakan semua fitur Hisabia."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {orgId ? (
              <>
                <Link to={`/org/${orgId}/dashboard`}>
                  <Button>Ke Dashboard</Button>
                </Link>
                <Link to={`/org/${orgId}/subscription`}>
                  <Button variant="outline">Lihat Subscription</Button>
                </Link>
              </>
            ) : (
              <Link to="/">
                <Button>Kembali ke Beranda</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
