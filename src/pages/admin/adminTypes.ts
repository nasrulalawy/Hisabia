export interface AdminStats {
  orgCount: number;
  userCount: number;
  activeSubscriptions: number;
  ordersToday: number;
  revenueMonth: number;
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  outlet_count: number;
  sub_status: string | null;
  sub_period_end: string | null;
  plan_name: string | null;
  plan_id: string | null;
}

export interface AdminOutletRow {
  id: string;
  name: string;
  outlet_type: string;
  is_default: boolean;
  created_at: string;
}
