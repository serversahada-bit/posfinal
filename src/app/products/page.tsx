'use client';

import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { Plus, Edit2, Trash2, Image as ImageIcon, X, Check } from 'lucide-react';
import Image from 'next/image';
import { useSocketEvent } from '@/hooks/useSocketEvent';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    sku: '',
    price: '',
    weight_gram: '',
    status: 'active',
    existing_image_url: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products?status=all');
      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openModal = (product: any = null) => {
    if (product) {
      setEditId(product.id);
      setFormData({
        product_name: product.product_name || '',
        product_code: product.product_code || '',
        sku: product.sku || '',
        price: product.price?.toString() || '0',
        weight_gram: product.weight_gram?.toString() || '0',
        status: product.status || 'active',
        existing_image_url: product.image_url || ''
      });
    } else {
      setEditId(null);
      setFormData({
        product_name: '',
        product_code: '',
        sku: '',
        price: '0',
        weight_gram: '0',
        status: 'active',
        existing_image_url: ''
      });
    }
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_name.trim() || !formData.sku.trim()) {
      Swal.fire('Error', 'Nama Produk dan SKU wajib diisi.', 'error');
      return;
    }

    setIsSubmitting(true);
    const data = new FormData();
    data.append('action', editId ? 'update' : 'create');
    if (editId) data.append('id', editId.toString());
    
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });
    
    if (selectedFile) {
      data.append('product_image', selectedFile);
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        body: data
      });
      const json = await res.json();
      
      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        setIsModalOpen(false);
        fetchProducts();
      } else {
        Swal.fire('Error', json.message || 'Terjadi kesalahan', 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Gagal menyimpan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini secara permanen?')) return;
    
    try {
      const data = new FormData();
      data.append('action', 'delete');
      data.append('id', id.toString());

      const res = await fetch('/api/products', {
        method: 'POST',
        body: data
      });
      const json = await res.json();
      
      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        fetchProducts();
      } else {
        Swal.fire('Error', json.message || 'Gagal menghapus produk', 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produk</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola data katalog produk, harga, berat, dan ketersediaan.</p>
        </div>
        <button onClick={() => openModal()} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          Tambah Produk
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Gambar</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Info Produk</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga & Berat</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">Memuat data...</td></tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada data produk.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {row.image_url ? (
                          <Image src={row.image_url.startsWith('http') || row.image_url.startsWith('/') ? row.image_url : `/${row.image_url}`} alt={row.product_name} fill className="object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 text-sm">{row.product_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">SKU: {row.sku}</span>
                        {row.product_code && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">Kode: {row.product_code}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-emerald-600 text-sm">Rp {Number(row.price).toLocaleString('id-ID')}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{Number(row.weight_gram).toLocaleString('id-ID')} Gram</p>
                    </td>
                    <td className="p-4">
                      {row.status === 'active' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-emerald-50 text-emerald-600 border-emerald-200 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-50 text-slate-600 border-slate-200 inline-flex items-center gap-1">
                          <X className="w-3 h-3" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openModal(row)} className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors border border-amber-200" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(row.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200" title="Hapus Permanen">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 md:p-6 bg-slate-50/50 flex-1">
              <form id="productForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Produk <span className="text-red-500">*</span></label>
                    <input 
                      type="text" name="product_name" required
                      value={formData.product_name} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">SKU <span className="text-red-500">*</span></label>
                    <input 
                      type="text" name="sku" required
                      value={formData.sku} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kode Produk</label>
                    <input 
                      type="text" name="product_code"
                      value={formData.product_code} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Harga Jual (Rp) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" name="price" required min="0"
                      value={formData.price} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Berat (Gram) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" name="weight_gram" required min="0"
                      value={formData.weight_gram} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status <span className="text-red-500">*</span></label>
                    <select 
                      name="status" required
                      value={formData.status} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    >
                      <option value="active">Active (Tersedia)</option>
                      <option value="inactive">Inactive (Sembunyikan)</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Foto Produk (Opsional)</label>
                    <div className="flex items-center gap-4">
                      {formData.existing_image_url && !selectedFile && (
                        <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden relative shrink-0">
                          <Image src={formData.existing_image_url.startsWith('http') || formData.existing_image_url.startsWith('/') ? formData.existing_image_url : `/${formData.existing_image_url}`} alt="Current" fill className="object-cover" />
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept=".jpg,.jpeg,.png,.webp"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Format: JPG, PNG, WEBP.</p>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors shadow-sm">
                Batal
              </button>
              <button type="submit" form="productForm" disabled={isSubmitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

