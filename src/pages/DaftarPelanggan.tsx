import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface InviteInfo {
  email: string;
  orgName: string;
  catalogUrl: string;
  catalogPath?: string;
  orgId?: string;
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
    let cancelled = false;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_invite_by_token", { p_token: token });
        if (cancelled) return;
        const res = data as { error?: string } & InviteInfo | null;
        if (rpcError) {
          setError(rpcError.message || "Gagal memuat undangan.");
          setInvite(null);
          return;
        }
        if (res?.error) {
          setError(res.error);
          setInvite(null);
        } else if (res && "email" in res) {
          const path = (res as { catalogPath?: string; orgId?: string }).catalogPath
            || (res as { catalogPath?: string; orgId?: string }).orgId;
          setInvite({
            ...res,
            catalogUrl: path ? `${window.location.origin}/katalog/${path}` : "",
          });
          setError(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!invite || !token) return;
    const linkIfLoggedIn = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if ((user.email || "").toLowerCase() !== invite.email.toLowerCase()) return;
      setLinking(true);
      const { data: linkData, error: linkErr } = await supabase.rpc("link_invite_token", { p_token: token });
      setLinking(false);
      const res = linkData as { linked?: boolean; catalogPath?: string; orgId?: string; error?: string } | null;
      if (linkErr) {
        setError(linkErr.message);
        return;
      }
      if (res?.error) {
        setError(res.error);
        return;
      }
      const path = res?.catalogPath || res?.orgId;
      if (res?.linked && path) {
        navigate(`/katalog/${path}`, { replace: true });
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
    const { data: linkData, error: linkErr } = await supabase.rpc("link_invite_token", { p_token: token });
    setSubmitLoading(false);
    const res = linkData as { linked?: boolean; catalogPath?: string; orgId?: string; error?: string } | null;
    if (linkErr) {
      setError(linkErr.message);
      return;
    }
    if (res?.error) {
      setError(res.error);
      return;
    }
    const path = res?.catalogPath || res?.orgId;
    if (res?.linked && path) {
      navigate(`/katalog/${path}`, { replace: true });
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
