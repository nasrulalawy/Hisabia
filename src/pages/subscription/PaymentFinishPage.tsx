import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

/**
 * Halaman redirect dari Midtrans (finish_url) setelah pembayaran.
 * Query params dari Midtrans: order_id, transaction_status, status_code, merchant_id.
 * transaction_status: settlement, capture = sukses; pending = menunggu; deny, cancel, expire = gagal.
 */
export function PaymentFinishPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id") ?? "";
  const transactionStatus = searchParams.get("transaction_status") ?? "";
  const statusCode = searchParams.get("status_code") ?? "";

  const isSuccess =
    transactionStatus === "settlement" ||
    transactionStatus === "capture" ||
    statusCode === "200";
  const isPending =
    transactionStatus === "pending" ||
    statusCode === "201" ||
    (Number(statusCode) >= 200 && Number(statusCode) < 300 && !isSuccess);
  const isFailed =
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire";

  const statusLabel = isFailed
    ? "Pembayaran tidak berhasil"
    : isPending
      ? "Menunggu pembayaran"
      : "Pembayaran berhasil";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isFailed
                ? "bg-red-100"
                : isPending
                  ? "bg-amber-100"
                  : "bg-emerald-100"
            }`}
          >
            {isFailed ? (
              <svg
                className="h-10 w-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : isPending ? (
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
            {statusLabel}
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {isFailed
              ? "Transaksi dibatalkan atau gagal. Silakan coba lagi dari halaman Langganan."
              : isPending
                ? "Pembayaran Anda sedang diproses. Langganan akan diaktifkan setelah pembayaran dikonfirmasi."
                : "Terima kasih! Pembayaran Anda telah kami terima. Langganan Anda telah diaktifkan."}
          </p>
          {orderId && (
            <p className="mt-4 text-xs text-[var(--muted-foreground)]">
              No. order: {orderId}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {orgId ? (
              <>
                <Link to={`/org/${orgId}/dashboard`}>
                  <Button>Ke Dashboard</Button>
                </Link>
                <Link to={`/org/${orgId}/subscription`}>
                  <Button variant="outline">
                    {isFailed ? "Coba lagi" : "Lihat Langganan"}
                  </Button>
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
