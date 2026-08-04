'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Product } from '@/types';

interface ProductContextType {
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchProducts: (params?: { status?: string; search?: string }) => Promise<void>;
  addProduct: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; message: string }>;
  updateProduct: (data: Partial<Product> & { id: number }) => Promise<{ success: boolean; message: string }>;
  deleteProduct: (id: number) => Promise<{ success: boolean; message: string }>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch produk dari tabel products (db_sahada_order)
  const fetchProducts = useCallback(async (params?: { status?: string; search?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);

      const res = await fetch(`/api/products?${qs.toString()}`);
      const json = await res.json() as { success: boolean; data?: Product[]; message?: string };

      if (json.success && json.data) {
        setProducts(json.data);
      } else {
        setError(json.message ?? 'Gagal mengambil produk');
      }
    } catch {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, []);

  const addProduct = async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json() as { success: boolean; message?: string };
    if (json.success) await fetchProducts();
    return { success: json.success, message: json.message ?? '' };
  };

  const updateProduct = async (data: Partial<Product> & { id: number }) => {
    const res = await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json() as { success: boolean; message?: string };
    if (json.success) await fetchProducts();
    return { success: json.success, message: json.message ?? '' };
  };

  const deleteProduct = async (id: number) => {
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    const json = await res.json() as { success: boolean; message?: string };
    if (json.success) await fetchProducts();
    return { success: json.success, message: json.message ?? '' };
  };

  return (
    <ProductContext.Provider value={{ products, loading, error, fetchProducts, addProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used within ProductProvider');
  return context;
};
