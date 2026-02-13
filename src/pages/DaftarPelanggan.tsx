import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getApiBase } from "@/lib/utils";

interface InviteInfo {
  email: string;
  orgName: string;
  catalogUrl: string;
  orgId: string;
}

export function DaftarPelanggan() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token")?.trim() ?? null;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Link undangan tidak valid. Minta toko mengirim link baru.");
      setLoading(false);
      return;
    }
    const encodedToken = encodeURIComponent(token);
    const apiBase = getApiBase();
    const url = apiBase ? `${apiBase}/invite/${encodedToken}` : `/api/invite/${encodedToken}`;
    fetch(url)
      .then(async (r) => {
        const text = (await r.text()).trim();
        let data: { error?: string } & InviteInfo;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          if (r.status === 404) {
            setError(
              "Link undangan tidak ditemukan. Pastikan server API berjalan (npm run server di folder project) dan link yang dibuka sama persis dengan yang dikirim toko."
            );
          } else {
            setError(r.ok ? "Respons tidak valid" : `Gagal memuat (${r.status}). Pastikan server API berjalan.`);
          }
          setInvite(null);
          setLoading(false);
          return;
        }
        if (!r.ok) {
          setError(data.error || `Gagal memuat (${r.status})`);
          setInvite(null);
          setLoading(false);
          return;
        }
        if (data.error) {
          setError(data.error);
          setInvite(null);
        } else {
          setInvite(data);
          setError(null);
        }
      })
      .catch((err) => {
        const msg = err?.message || "";
        setError(
          msg.includes("Failed to fetch") || msg.includes("NetworkError")
            ? "Tidak bisa terhubung ke server. Pastikan aplikasi (npm run dev) dan server API (npm run server) berjalan, lalu coba lagi."
            : msg
            ? `Gagal memuat undangan: ${msg}`
            : "Gagal memuat undangan. Cek link atau minta toko kirim link baru."
        );
        setInvite(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!invite || !token) return;
    const linkIfLoggedIn = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if ((user.email || "").toLowerCase() !== invite.email.toLowerCase()) return;
      setLinking(true);
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      if (!accessToken) {
        setLinking(false);
        return;
      }
      const linkUrl = getApiBase() ? `${getApiBase()}/invite/${encodeURIComponent(token)}/link` : `/api/invite/${encodeURIComponent(token)}/link`;
      const res = await fetch(linkUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      setLinking(false);
      if (data.catalogUrl) {
        navigate(data.catalogUrl, { replace: true });
      } else if (data.error) {
        setError(data.error);
      }
    };
    linkIfLoggedIn();
  }, [invite, token, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || !token) return;
    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter");
      return;
    }
    if (password !== confirmPassword) {
      setError("Kata sandi dan konfirmasi tidak sama");
      return;
    }
    setError(null);
    setSubmitLoading(true);
    const { error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName || undefined } },
    });
    if (signUpErr) {
      setError(signUpErr.message);
      setSubmitLoading(false);
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    const accessToken = session?.access_token;
    if (!accessToken) {
      setError("Pendaftaran berhasil. Cek email untuk konfirmasi, lalu buka lagi link ini.");
      setSubmitLoading(false);
      return;
    }
    const linkUrl = getApiBase() ? `${getApiBase()}/invite/${encodeURIComponent(token)}/link` : `/api/invite/${encodeURIComponent(token)}/link`;
    const res = await fetch(linkUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    setSubmitLoading(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    if (data.catalogUrl) {
      navigate(data.catalogUrl, { replace: true });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (linking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">Menghubungkan akun...</p>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--muted)] p-6">
        <p className="text-center text-lg text-red-600">{error}</p>
        <Button variant="outline" onClick={() => navigate("/login")}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--primary)] text-2xl font-bold text-white">
            H
          </div>
          <CardTitle>Daftar akun pelanggan</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Buat akun untuk belanja di <strong>{invite.orgName}</strong>. Gunakan email di bawah.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Email (dari undangan)
              </label>
              <Input
                type="email"
                value={invite.email}
                readOnly
                className="bg-[var(--muted)]"
              />
            </div>
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Nama lengkap
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="Nama Anda"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Kata sandi
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Konfirmasi kata sandi
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Ulangi kata sandi"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitLoading}>
              {submitLoading ? "Memproses..." : "Daftar & buka katalog"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            Sudah punya akun?{" "}
            <a href="/login" className="font-medium text-[var(--primary)] hover:underline">
              Masuk
            </a>
            {" "}lalu buka link undangan ini lagi untuk menghubungkan akun.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
