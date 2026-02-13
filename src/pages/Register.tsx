import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || undefined } },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/onboarding", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--primary)] text-2xl font-bold text-white">
            H
          </div>
          <CardTitle>Daftar Hisabia</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">Buat akun untuk memulai.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
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
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="nama@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses..." : "Daftar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            Sudah punya akun?{" "}
            <Link to="/login" className="font-medium text-[var(--primary)] hover:underline">
              Masuk
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
