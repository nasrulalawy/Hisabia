export type OrgRole = "owner" | "admin" | "cashier" | "member";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface PlanFeaturePermission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly?: number | null;
  outlet_limit: number;
  member_limit: number;
  features: unknown;
  feature_permissions?: Record<string, PlanFeaturePermission> | null;
  show_on_landing?: boolean;
  sort_order?: number;
  is_addon?: boolean;
  addon_feature_key?: string | null;
  addon_feature_keys?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationAddonPlan {
  id: string;
  organization_id: string;
  plan_id: string;
  created_at: string;
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
  product_variant_id: string | null;
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
  barcode: string | null;
  image_url: string | null;
  is_available: boolean;
  /** F&B: true = HPP dihitung dari ingredients (product_ingredients) */
  use_ingredients_for_cost?: boolean;
  created_at: string;
  updated_at: string;
}

/** F&B: Bahan baku untuk resep. HPP produk = sum(ingredient.cost_per_unit * quantity). Punya stok dalam satuan unit_id. */
export interface Ingredient {
  id: string;
  organization_id: string;
  name: string;
  unit_id: string;
  cost_per_unit: number;
  stock: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** F&B: Resep/BOM - jumlah bahan per produk. Quantity dalam satuan ingredient. */
export interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  created_at: string;
}

/** F&B: Variant produk (size, rasa, level gula, dll). selling_price/cost_price null = pakai dari product. */
export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  selling_price: number | null;
  cost_price: number | null;
  /** replace = harga jual menggantikan harga produk; addon = tambahan di atas harga dasar. Default replace. */
  price_type?: "replace" | "addon";
  /** Tampil sebagai opsi di cetak label (nama produk - variant, harga variant). */
  show_on_label?: boolean;
  sort_order: number;
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

/** Izin fitur per organisasi (diberi super admin). Contoh: kredit_syariah */
export interface OrganizationFeatureGrant {
  organization_id: string;
  feature_key: string;
  granted_at: string;
}

export type KreditSyariahAkadStatus = "draft" | "aktif" | "lunas" | "macet";

export interface KreditSyariahAkad {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  customer_id: string;
  order_id: string | null;
  total_amount: number;
  tenor_bulan: number;
  angsuran_per_bulan: number;
  status: KreditSyariahAkadStatus;
  tanggal_mulai: string | null;
  tanggal_jatuh_tempo: string | null;
  catatan: string | null;
  harga_barang: number | null;
  margin_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface KreditSyariahAkadItem {
  id: string;
  akad_id: string;
  product_id: string;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface EmployeeRole {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRoleFeaturePermission {
  employee_role_id: string;
  feature_key: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  updated_at: string;
}

export interface Employee {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  user_id: string | null;
  employee_role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KreditSyariahAngsuran {
  id: string;
  akad_id: string;
  jumlah_bayar: number;
  tanggal_bayar: string;
  metode_bayar: string | null;
  catatan: string | null;
  created_at: string;
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
  warehouse_id: string | null;
  product_id: string;
  type: "in" | "out" | "adjust";
  quantity: number;
  notes: string | null;
  created_at: string;
}

export type StockOpnameStatus = "draft" | "finalized";

export interface StockOpnameSession {
  id: string;
  organization_id: string;
  warehouse_id: string | null;
  status: StockOpnameStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}

export interface StockOpnameLine {
  id: string;
  opname_session_id: string;
  product_id: string;
  system_qty: number;
  physical_qty: number | null;
  adjustment_qty: number;
  variance_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface ChartOfAccount {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  parent_id: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  organization_id: string;
  entry_date: string;
  number: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  memo: string | null;
  created_at: string;
}

export interface FixedAsset {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  purchase_date: string;
  purchase_value: number;
  residual_value: number;
  useful_life_months: number;
  depreciation_method: string;
  account_asset_code: string;
  account_accumulated_code: string;
  account_expense_code: string;
  status: "active" | "sold" | "disposed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedAssetDepreciation {
  id: string;
  fixed_asset_id: string;
  period_date: string;
  amount: number;
  journal_entry_id: string | null;
  created_at: string;
}

export type SalesQuoteStatus = "draft" | "sent" | "accepted" | "rejected";
export type SalesInvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "canceled";
export type SalesDeliveryStatus = "pending" | "partial" | "delivered";

export interface SalesQuote {
  id: string;
  organization_id: string;
  number: string;
  customer_id: string;
  quote_date: string;
  valid_until: string | null;
  status: SalesQuoteStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesQuoteLine {
  id: string;
  sales_quote_id: string;
  product_id: string | null;
  unit_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
}

export interface SalesInvoice {
  id: string;
  organization_id: string;
  number: string;
  sales_quote_id: string | null;
  customer_id: string;
  invoice_date: string;
  due_date: string | null;
  status: SalesInvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesInvoiceLine {
  id: string;
  sales_invoice_id: string;
  product_id: string | null;
  unit_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
}

export interface SalesDelivery {
  id: string;
  organization_id: string;
  number: string;
  sales_invoice_id: string;
  delivery_date: string;
  status: SalesDeliveryStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesDeliveryLine {
  id: string;
  sales_delivery_id: string;
  sales_invoice_line_id: string;
  quantity_delivered: number;
  created_at: string;
}
