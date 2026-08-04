'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import { Check, Edit2, Image as ImageIcon, Layers, Package2, Plus, Trash2, X } from 'lucide-react';
import { useSocketEvent } from '@/hooks/useSocketEvent';

type BundleStatus = 'active' | 'inactive';

type ProductOption = {
  id: number;
  product_name: string;
  sku: string | null;
  price: number;
};

type BundleItem = {
  id?: number;
  product_id: number;
  qty: number;
  product_name: string;
  sku: string | null;
};

type Bundle = {
  id: number;
  bundle_name: string;
  sku: string | null;
  price: number;
  status: BundleStatus | null;
  image_url: string | null;
  items: BundleItem[];
};

type BundlesApiResponse = {
  success: boolean;
  message?: string;
  data?: Bundle[];
};

type ProductsApiResponse = {
  success: boolean;
  data?: ProductOption[];
  message?: string;
};

type EditableBundleItem = {
  product_id: string;
  qty: string;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

const normalizeImageSrc = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.startsWith('blob:') || value.startsWith('data:') || value.startsWith('http') || value.startsWith('/')) {
    return value;
  }

  return `/${value}`;
};

const isTemporaryImageSrc = (value: string) => value.startsWith('blob:') || value.startsWith('data:');

export default function BundlingPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    bundle_name: '',
    sku: '',
    price: '0',
    status: 'active' as BundleStatus,
    existing_image_url: '',
  });
  const [bundleItems, setBundleItems] = useState<EditableBundleItem[]>([{ product_id: '', qty: '1' }]);

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const [bundlesRes, productsRes] = await Promise.all([
        fetch('/api/bundling?status=all'),
        fetch('/api/products?status=active'),
      ]);

      const bundlesJson: BundlesApiResponse = await bundlesRes.json();
      const productsJson: ProductsApiResponse = await productsRes.json();

      if (!bundlesJson.success) {
        throw new Error(bundlesJson.message || 'Gagal mengambil data bundling');
      }

      if (!productsJson.success) {
        throw new Error(productsJson.message || 'Gagal mengambil daftar produk');
      }

      setBundles(bundlesJson.data || []);
      setProducts(productsJson.data || []);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [bundlesRes, productsRes] = await Promise.all([
          fetch('/api/bundling?status=all'),
          fetch('/api/products?status=active'),
        ]);

        const bundlesJson: BundlesApiResponse = await bundlesRes.json();
        const productsJson: ProductsApiResponse = await productsRes.json();

        if (!isMounted) {
          return;
        }

        if (!bundlesJson.success) {
          throw new Error(bundlesJson.message || 'Gagal mengambil data bundling');
        }

        if (!productsJson.success) {
          throw new Error(productsJson.message || 'Gagal mengambil daftar produk');
        }

        setBundles(bundlesJson.data || []);
        setProducts(productsJson.data || []);
      } catch (error: unknown) {
        if (isMounted) {
          Swal.fire('Error', getErrorMessage(error), 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  const resetPreviewObjectUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  const resetForm = () => {
    resetPreviewObjectUrl();
    setEditId(null);
    setFormData({
      bundle_name: '',
      sku: '',
      price: '0',
      status: 'active',
      existing_image_url: '',
    });
    setBundleItems([{ product_id: '', qty: '1' }]);
    setSelectedFile(null);
    setPreviewUrl('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openModal = (bundle: Bundle | null = null) => {
    resetPreviewObjectUrl();

    if (bundle) {
      setEditId(bundle.id);
      setFormData({
        bundle_name: bundle.bundle_name || '',
        sku: bundle.sku || '',
        price: bundle.price.toString(),
        status: (bundle.status || 'active') as BundleStatus,
        existing_image_url: bundle.image_url || '',
      });
      setBundleItems(
        bundle.items.length > 0
          ? bundle.items.map((item) => ({
              product_id: String(item.product_id),
              qty: String(item.qty),
            }))
          : [{ product_id: '', qty: '1' }]
      );
      setPreviewUrl(bundle.image_url || '');
    } else {
      resetForm();
    }

    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    resetPreviewObjectUrl();

    if (file) {
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(formData.existing_image_url);
    }

    setSelectedFile(file);
  };

  const handleBundleItemChange = (index: number, field: keyof EditableBundleItem, value: string) => {
    setBundleItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const addProductRow = () => {
    setBundleItems((prev) => [...prev, { product_id: '', qty: '1' }]);
  };

  const removeProductRow = (index: number) => {
    setBundleItems((prev) => {
      if (prev.length === 1) {
        return [{ product_id: '', qty: '1' }];
      }

      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.bundle_name.trim() || !formData.sku.trim()) {
      Swal.fire('Error', 'Nama Bundling dan SKU wajib diisi.', 'error');
      return;
    }

    const validItems = bundleItems.filter((item) => Number(item.product_id) > 0 && Number(item.qty) > 0);

    if (validItems.length === 0) {
      Swal.fire('Error', 'Minimal harus ada satu produk di dalam bundling.', 'error');
      return;
    }

    setIsSubmitting(true);

    const data = new FormData();
    data.append('action', editId ? 'update' : 'create');
    if (editId) {
      data.append('id', String(editId));
    }

    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });

    validItems.forEach((item) => {
      data.append('product_ids[]', item.product_id);
      data.append('qtys[]', item.qty);
    });

    if (selectedFile) {
      data.append('product_image', selectedFile);
    }

    try {
      const res = await fetch('/api/bundling', {
        method: 'POST',
        body: data,
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        closeModal();
        await fetchPageData();
      } else {
        Swal.fire('Error', json.message || 'Terjadi kesalahan', 'error');
      }
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error) || 'Gagal menyimpan bundling', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus bundling ini?')) {
      return;
    }

    try {
      const data = new FormData();
      data.append('action', 'delete');
      data.append('id', String(id));

      const res = await fetch('/api/bundling', {
        method: 'POST',
        body: data,
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        await fetchPageData();
      } else {
        Swal.fire('Error', json.message || 'Gagal menghapus bundling', 'error');
      }
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error) || 'Gagal menghapus bundling', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bundling Produk</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola data paket bundling dan produk-produk di dalamnya.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Bundling
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">#</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Gambar</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bundling</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Isi Produk</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga Paket</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                    Memuat data...
                  </td>
                </tr>
              ) : bundles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Layers className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada data bundling.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                bundles.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center text-sm font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {row.image_url ? (
                          <Image
                            src={normalizeImageSrc(row.image_url)}
                            alt={row.bundle_name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <Package2 className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 text-sm">{row.bundle_name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-1">{row.sku}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {row.items.map((item, itemIndex) => (
                          <div
                            key={`${row.id}-${item.product_id}-${itemIndex}`}
                            className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded flex items-center justify-between min-w-[140px] w-fit"
                          >
                            <span>{item.product_name}</span>
                            <span className="font-bold text-slate-700 ml-3">x{item.qty}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-emerald-600 text-sm">Rp {Number(row.price).toLocaleString('id-ID')}</td>
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
                        <button
                          onClick={() => openModal(row)}
                          className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors border border-amber-200"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200"
                          title="Hapus"
                        >
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit Bundling' : 'Tambah Bundling Baru'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 md:p-6 bg-slate-50/50 flex-1">
              <form id="bundleForm" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Info Bundling</h4>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gambar Bundling</label>
                    <div className="flex items-center gap-4">
                      {previewUrl ? (
                        <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative shrink-0 bg-white">
                          {isTemporaryImageSrc(previewUrl) ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={previewUrl}
                                alt="Preview bundling"
                                className="absolute inset-0 h-full w-full object-contain"
                              />
                            </>
                          ) : (
                            <Image
                              src={normalizeImageSrc(previewUrl)}
                              alt="Preview bundling"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center shrink-0">
                          <ImageIcon className="w-6 h-6 text-slate-300" />
                        </div>
                      )}

                      <div className="flex-1">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                        <p className="text-xs text-slate-400 mt-2">Format: JPG, JPEG, PNG, WEBP.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Nama Bundling <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="bundle_name"
                      required
                      value={formData.bundle_name}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        SKU <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="sku"
                        required
                        value={formData.sku}
                        onChange={handleInputChange}
                        className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Harga Paket (Rp) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        required
                        min="0"
                        value={formData.price}
                        onChange={handleInputChange}
                        className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Isi Produk</h4>
                    <button
                      type="button"
                      onClick={addProductRow}
                      className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Produk
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {bundleItems.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Pilih Produk</label>
                          <select
                            value={item.product_id}
                            onChange={(event) => handleBundleItemChange(index, 'product_id', event.target.value)}
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                          >
                            <option value="">Pilih Produk</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.sku} - {product.product_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(event) => handleBundleItemChange(index, 'qty', event.target.value)}
                            className="w-full text-sm text-center border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                          />
                        </div>

                        <div className="pt-5">
                          <button
                            type="button"
                            onClick={() => removeProductRow(index)}
                            className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                            title="Hapus Baris"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors shadow-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                form="bundleForm"
                disabled={isSubmitting}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Bundling'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

