'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Order, CartItem } from '@/types';

interface OrderContextType {
  orders: Order[];
  totalOrders: number;
  loading: boolean;
  error: string | null;
  fetchOrders: (params?: { status?: string; search?: string; page?: number }) => Promise<void>;
  createOrder: (data: {
    customer_id: number;
    customer_address_id?: number;
    order_type?: string;
    order_source?: string;
    items: CartItem[];
    product_discount?: number;
    shipping_cost?: number;
    other_fee?: number;
    notes?: string;
    payment_method?: string;
  }) => Promise<{ success: boolean; message: string; order_code?: string }>;
  updateOrderStatus: (id: number, order_status: string) => Promise<{ success: boolean; message: string }>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (params?: { status?: string; search?: string; page?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.page) qs.set('page', String(params.page));

      const res = await fetch(`/api/orders?${qs.toString()}`);
      const json = await res.json() as { success: boolean; data?: Order[]; total?: number; message?: string };

      if (json.success && json.data) {
        setOrders(json.data);
        setTotalOrders(json.total ?? 0);
      } else {
        setError(json.message ?? 'Gagal mengambil data pesanan');
      }
    } catch {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = async (data: {
    customer_id: number;
    customer_address_id?: number;
    order_type?: string;
    order_source?: string;
    items: CartItem[];
    product_discount?: number;
    shipping_cost?: number;
    other_fee?: number;
    notes?: string;
    payment_method?: string;
  }) => {
    try {
      const payload = {
        customer_id: data.customer_id,
        customer_address_id: data.customer_address_id,
        order_type: data.order_type,
        order_source: data.order_source ?? 'pos',
        items: data.items.map((ci) => ({
          product_id: ci.product.id,
          product_name: ci.product.product_name,
          qty: ci.quantity,
          price: ci.product.price,
        })),
        product_discount: data.product_discount ?? 0,
        shipping_cost: data.shipping_cost ?? 0,
        other_fee: data.other_fee ?? 0,
        notes: data.notes,
        payment_method: data.payment_method ?? 'cash',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { success: boolean; message?: string; data?: { order_code: string } };

      return {
        success: json.success,
        message: json.message ?? '',
        order_code: json.data?.order_code,
      };
    } catch {
      return { success: false, message: 'Tidak dapat terhubung ke server' };
    }
  };

  const updateOrderStatus = async (id: number, order_status: string) => {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, order_status }),
    });
    const json = await res.json() as { success: boolean; message?: string };
    return { success: json.success, message: json.message ?? '' };
  };

  return (
    <OrderContext.Provider value={{ orders, totalOrders, loading, error, fetchOrders, createOrder, updateOrderStatus }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used within OrderProvider');
  return context;
};
