export type OrgRole = "owner" | "admin" | "cashier" | "member";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  outlet_limit: number;
  member_limit: number;
  features: unknown;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_id: string | null;
  logo_url: string | null;
  phone: string | null;
  catalog_public?: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  updated_at: string;
}

export type OutletType = "gudang" | "mart" | "fnb" | "barbershop";

export interface Outlet {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  timezone: string;
  is_default: boolean;
  outlet_type?: OutletType;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithPlan extends Organization {
  subscription_plans: SubscriptionPlan | null;
}

export interface OutletWithOrg extends Outlet {
  organizations: Pick<Organization, "name" | "slug"> | null;
}

export type OrderStatus = "draft" | "pending" | "paid" | "canceled";

export interface MenuCategory {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  organization_id: string;
  outlet_id: string;
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  initial_cash: number;
  end_cash: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  organization_id: string;
  outlet_id: string;
  shift_id: string | null;
  created_by: string | null;
  customer_id: string | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  product_id: string | null;
  unit_id: string | null;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  organization_id: string;
  name: string;
  symbol: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  shop_token: string | null;
  user_id: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  category_id: string | null;
  supplier_id: string | null;
  name: string;
  description: string | null;
  default_unit_id: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductUnit {
  id: string;
  product_id: string;
  unit_id: string;
  conversion_to_base: number;
  is_base: boolean;
  created_at: string;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  unit_id: string | null;
  customer_id: string | null;
  price: number;
  price_type: string;
  created_at: string;
  updated_at: string;
}

export interface CashFlow {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  type: "in" | "out";
  amount: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Receivable {
  id: string;
  organization_id: string;
  customer_id: string | null;
  order_id: string | null;
  amount: number;
  paid: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payable {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  amount: number;
  paid: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  organization_id: string;
  warehouse_id: string;
  product_id: string;
  type: "in" | "out" | "adjust";
  quantity: number;
  notes: string | null;
  created_at: string;
}
