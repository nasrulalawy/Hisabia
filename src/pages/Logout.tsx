import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.signOut().then(() => {
      navigate("/", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <p className="text-[var(--muted-foreground)]">Keluar...</p>
    </div>
  );
}
