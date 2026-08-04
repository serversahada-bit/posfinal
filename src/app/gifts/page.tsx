'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import { Check, Edit2, Gift, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import { useSocketEvent } from '@/hooks/useSocketEvent';

type GiftStatus = 'active' | 'inactive';

type GiftItem = {
  id: number;
  gift_name: string;
  sku: string | null;
  price: number;
  weight_gram: number | null;
  status: GiftStatus | null;
  image_url: string | null;
};

type GiftsApiResponse = {
  success: boolean;
  message?: string;
  data?: GiftItem[];
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

export default function GiftsPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    gift_name: '',
    sku: '',
    weight_gram: '0',
    status: 'active' as GiftStatus,
    existing_image_url: '',
  });

  const fetchGifts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gifts?status=all');
      const json: GiftsApiResponse = await res.json();

      if (json.success) {
        setGifts(json.data || []);
      } else {
        Swal.fire('Error', json.message || 'Gagal mengambil data hadiah', 'error');
      }
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error) || 'Gagal mengambil data hadiah', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadGifts = async () => {
      try {
        const res = await fetch('/api/gifts?status=all');
        const json: GiftsApiResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (json.success) {
          setGifts(json.data || []);
        } else {
          Swal.fire('Error', json.message || 'Gagal mengambil data hadiah', 'error');
        }
      } catch (error: unknown) {
        if (isMounted) {
          Swal.fire('Error', getErrorMessage(error) || 'Gagal mengambil data hadiah', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadGifts();

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

  const openModal = (gift: GiftItem | null = null) => {
    resetPreviewObjectUrl();

    if (gift) {
      setEditId(gift.id);
      setFormData({
        gift_name: gift.gift_name || '',
        sku: gift.sku || '',
        weight_gram: gift.weight_gram?.toString() || '0',
        status: (gift.status || 'active') as GiftStatus,
        existing_image_url: gift.image_url || '',
      });
      setPreviewUrl(gift.image_url || '');
    } else {
      setEditId(null);
      setFormData({
        gift_name: '',
        sku: '',
        weight_gram: '0',
        status: 'active',
        existing_image_url: '',
      });
      setPreviewUrl('');
    }

    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsModalOpen(true);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.gift_name.trim() || !formData.sku.trim()) {
      Swal.fire('Error', 'Nama Hadiah dan SKU wajib diisi.', 'error');
      return;
    }

    setIsSubmitting(true);

    const data = new FormData();
    data.append('action', editId ? 'update' : 'create');
    if (editId) {
      data.append('id', editId.toString());
    }

    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });

    if (selectedFile) {
      data.append('gift_image', selectedFile);
    }

    try {
      const res = await fetch('/api/gifts', {
        method: 'POST',
        body: data,
      });
      const json = await res.json();

      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        setIsModalOpen(false);
        await fetchGifts();
      } else {
        Swal.fire('Error', json.message || 'Terjadi kesalahan', 'error');
      }
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error) || 'Gagal menyimpan hadiah', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus hadiah ini?')) {
      return;
    }

    try {
      const data = new FormData();
      data.append('action', 'delete');
      data.append('id', id.toString());

      const res = await fetch('/api/gifts', {
        method: 'POST',
        body: data,
      });
      const json: GiftsApiResponse = await res.json();

      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        await fetchGifts();
      } else {
        Swal.fire('Error', json.message || 'Gagal menghapus hadiah', 'error');
      }
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error) || 'Gagal menghapus hadiah', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hadiah</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola data katalog hadiah, harga, berat, dan ketersediaan.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Hadiah
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">#</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Gambar</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hadiah</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Berat</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    Memuat data...
                  </td>
                </tr>
              ) : gifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Gift className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada data hadiah.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                gifts.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center text-sm font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {row.image_url ? (
                          <Image
                            src={row.image_url.startsWith('http') || row.image_url.startsWith('/') ? row.image_url : `/${row.image_url}`}
                            alt={row.gift_name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 text-sm">{row.gift_name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-1">{row.sku}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-600 font-medium">{Number(row.weight_gram || 0).toLocaleString('id-ID')} g</p>
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
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit Hadiah' : 'Tambah Hadiah Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 md:p-6 bg-slate-50/50 flex-1">
              <form id="giftForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gambar Hadiah</label>
                    <div className="flex items-center gap-4">
                      {previewUrl ? (
                        <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative shrink-0 bg-white">
                          {isTemporaryImageSrc(previewUrl) ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={previewUrl}
                                alt="Preview hadiah"
                                className="absolute inset-0 h-full w-full object-contain"
                              />
                            </>
                          ) : (
                            <Image
                              src={normalizeImageSrc(previewUrl)}
                              alt="Preview hadiah"
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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Nama Hadiah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="gift_name"
                      required
                      value={formData.gift_name}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>

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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Berat (gram)</label>
                    <input
                      type="number"
                      name="weight_gram"
                      min="0"
                      value={formData.weight_gram}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors shadow-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                form="giftForm"
                disabled={isSubmitting}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Hadiah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

