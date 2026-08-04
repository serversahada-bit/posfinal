// =====================================================
// Types sesuai skema database db_sahada_order
// =====================================================

// --- USERS (tabel: users) ---
export type UserRole = 'admin' | 'finance' | 'warehouse' | 'cs' | 'owner' | 'cs_crm';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[] | null;
  photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// --- PRODUCTS (tabel: products) ---
export type ProductStatus = 'active' | 'inactive';

export interface Product {
  id: number;
  product_name: string;
  sku: string | null;
  price: number;
  weight_gram: number;
  status: ProductStatus;
  created_at?: string;
  updated_at?: string;
}

// --- CUSTOMERS (tabel: customers) ---
export type CustomerStatus = 'active' | 'banned';

export interface Customer {
  id: number;
  name: string;
  whatsapp_number: string | null;
  email: string | null;
  status: CustomerStatus;
  created_at?: string;
  updated_at?: string;
}

// --- CUSTOMER ADDRESSES (tabel: customer_addresses) ---
export interface CustomerAddress {
  id: number;
  customer_id: number;
  receiver_name: string;
  whatsapp_number: string | null;
  address: string;
  district: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  is_default: boolean;
  created_at?: string;
}

// --- ORDERS (tabel: orders) ---
export type OrderType = 'normal' | 'endorse' | 'reseller' | 'free_order';
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'cod' | 'ewallet' | 'free';

export interface Order {
  id: number;
  order_code: string;
  customer_id: number;
  customer_address_id: number | null;
  order_type: OrderType;
  order_source: string | null;
  order_status: OrderStatus;
  total_product_price: number;
  product_discount: number;
  shipping_cost: number;
  other_fee: number;
  total_payment: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  customer_name?: string;
}

// --- ORDER ITEMS (tabel: order_items) ---
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  qty: number;
  price: number;
  subtotal: number;
  created_at?: string;
}

// --- PAYMENTS (tabel: payments) ---
export type PaymentStatus = 'unpaid' | 'waiting_confirmation' | 'paid' | 'rejected';

export interface Payment {
  id: number;
  order_id: number;
  payment_method: PaymentMethod;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  payment_proof_url: string | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
  created_at?: string;
  updated_at?: string;
}

// --- WAREHOUSES (tabel: warehouses) ---
export interface Warehouse {
  id: number;
  warehouse_name: string;
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  pic_name: string | null;
  created_at?: string;
  updated_at?: string;
}

// --- DASHBOARD STATS ---
export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  recentOrders: RecentOrder[];
}

export interface RecentOrder {
  order_code: string;
  customer_name: string;
  total_payment: number;
  order_status: OrderStatus;
  created_at: string;
}

// --- KASIR (Cart) ---
export interface CartItem {
  product: Product;
  quantity: number;
  discount_pct: number;
  subtotal: number;
}

// --- API Response Helper ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
