/**
 * Base URL backend (Express) untuk integrasi n8n, notify, dll.
 * Set VITE_API_URL di .env.local (mis. http://localhost:3001).
 */
export const API_SERVER_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  "";

export async function getApiServerToken(): Promise<string | null> {
  const { data: { session } } = await import("@/lib/supabase").then((m) => m.supabase.auth.getSession());
  return session?.access_token ?? null;
}

/** POST ke endpoint integrasi n8n/notify (event dari app ke n8n). Fire-and-forget. */
export async function notifyN8n(organizationId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  if (!API_SERVER_URL) return;
  const token = await getApiServerToken();
  if (!token) return;
  try {
    await fetch(`${API_SERVER_URL}/api/integrations/n8n/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ organization_id: organizationId, event, payload }),
    });
  } catch {
    // ignore
  }
}
