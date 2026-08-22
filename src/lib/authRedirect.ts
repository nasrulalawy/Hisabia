import type { SupabaseClient } from "@supabase/supabase-js";

/** Path tujuan setelah login / buka app (bukan onboarding jika user adalah karyawan). */
export async function resolveAuthDestination(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: isOwner } = await supabase.rpc("is_saas_owner");
  if (isOwner === true) return "/admin";

  await supabase.rpc("ensure_employee_org_membership");

  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (orgMember?.organization_id) {
    return `/org/${orgMember.organization_id}`;
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (employee?.organization_id) {
    return `/org/${employee.organization_id}`;
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (customer?.organization_id) {
    return `/katalog/${customer.organization_id}`;
  }

  return "/onboarding";
}

/** Cek apakah user boleh akses org (member atau karyawan aktif). */
export async function userCanAccessOrg(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<{ allowed: boolean; role: string | null }> {
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership) {
    return { allowed: true, role: membership.role };
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (employee) {
    await supabase.rpc("ensure_employee_org_membership");
    return { allowed: true, role: "cashier" };
  }

  return { allowed: false, role: null };
}
