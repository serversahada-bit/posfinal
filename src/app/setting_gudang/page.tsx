'use client';

import React, { useEffect, useRef, useState } from 'react';
import AsyncSelect from 'react-select/async';
import Image from 'next/image';
import Swal from 'sweetalert2';
import { Building2, Edit2, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';

type WarehouseItem = {
  id: number;
  warehouse_name: string;
  code: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  pic_name: string | null;
  distance_km: number | null;
  image_url: string | null;
};

type WarehousesResponse = {
  success: boolean;
  message?: string;
  data?: WarehouseItem[];
};

type RegionOption = {
  id: string;
  text: string;
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

export default function SettingGudangPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<{ value: string; label: string } | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    warehouse_name: '',
    code: '',
    pic_name: '',
    distance_km: '',
    address: '',
    subdistrict: '',
    existing_image_url: '',
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await fetch('/api/warehouses');
        const json: WarehousesResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (!json.success) {
          throw new Error(json.message || 'Gagal mengambil data gudang');
        }

        setWarehouses(json.data || []);
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
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouses');
      const json: WarehousesResponse = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal mengambil data gudang');
      }

      setWarehouses(json.data || []);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetPreviewObjectUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  const resetForm = () => {
    resetPreviewObjectUrl();
    setEditId(null);
    setSelectedFile(null);
    setPreviewUrl('');
    setSelectedRegion(null);
    setFormData({
      warehouse_name: '',
      code: '',
      pic_name: '',
      distance_km: '',
      address: '',
      subdistrict: '',
      existing_image_url: '',
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openModal = (warehouse: WarehouseItem | null = null) => {
    if (warehouse) {
      const region =
        warehouse.district && warehouse.city && warehouse.province
          ? `${warehouse.district}, ${warehouse.city}, ${warehouse.province}`
          : '';

      setEditId(warehouse.id);
      setFormData({
        warehouse_name: warehouse.warehouse_name || '',
        code: warehouse.code || '',
        pic_name: warehouse.pic_name || '',
        distance_km: warehouse.distance_km?.toString() || '',
        address: warehouse.address || '',
        subdistrict: region,
        existing_image_url: warehouse.image_url || '',
      });
      setSelectedRegion(region ? { value: region, label: region } : null);
      setPreviewUrl(warehouse.image_url || '');
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

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const loadRegionOptions = async (inputValue: string) => {
    const params = new URLSearchParams();
    if (inputValue.trim()) {
      params.set('q', inputValue.trim());
    }

    const res = await fetch(`/api/warehouses/regions?${params.toString()}`);
    const json: RegionOption[] = await res.json();

    return json.map((item) => ({
      value: item.id,
      label: item.text,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.warehouse_name.trim() || !formData.code.trim() || !formData.subdistrict.trim()) {
      Swal.fire('Error', 'Nama Gudang, Kode Gudang, dan Wilayah wajib diisi.', 'error');
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

    if (selectedFile) {
      data.append('warehouse_image', selectedFile);
    }

    try {
      const res = await fetch('/api/warehouses', {
        method: 'POST',
        body: data,
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan gudang');
      }

      Swal.fire('Berhasil', json.message || 'Data gudang berhasil disimpan.', 'success');
      closeModal();
      await fetchWarehouses();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus gudang ini?')) {
      return;
    }

    try {
      const data = new FormData();
      data.append('action', 'delete');
      data.append('id', String(id));

      const res = await fetch('/api/warehouses', {
        method: 'POST',
        body: data,
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menghapus gudang');
      }

      Swal.fire('Berhasil', json.message || 'Gudang berhasil dihapus.', 'success');
      await fetchWarehouses();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gudang</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola daftar gudang asal pengiriman untuk alokasi stok produk.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Gudang
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">#</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Foto</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gudang</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">PIC & Jarak</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Alamat & Wilayah</th>
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
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-12">
                    <div className="flex flex-col items-center justify-center">
                      <Building2 className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada data gudang.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                warehouses.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center text-sm font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {row.image_url ? (
                          <Image src={normalizeImageSrc(row.image_url)} alt={row.warehouse_name} fill className="object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 text-sm">{row.warehouse_name}</p>
                      <span className="inline-flex items-center px-2 py-1 mt-1 rounded bg-purple-50 text-purple-700 font-mono text-[11px] font-bold">
                        {row.code || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-700">{row.pic_name || '-'}</p>
                      <p className="text-xs text-slate-400 mt-1">{row.distance_km ?? 0} KM</p>
                    </td>
                    <td className="p-4">
                      <p className="text-slate-600 max-w-xs truncate">{row.address || '-'}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {row.district && row.city && row.province ? `${row.district}, ${row.city}, ${row.province}` : '-'}
                      </p>
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

      {isModalOpen ? (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{editId ? 'Edit Gudang' : 'Tambah Gudang Baru'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Foto Gudang</label>
                  <div className="flex items-center gap-4">
                    {previewUrl ? (
                      <div className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden relative shrink-0 bg-white">
                        {isTemporaryImageSrc(previewUrl) ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewUrl} alt="Preview gudang" className="absolute inset-0 h-full w-full object-cover" />
                          </>
                        ) : (
                          <Image src={normalizeImageSrc(previewUrl)} alt="Preview gudang" fill className="object-cover" unoptimized />
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Nama Gudang <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="warehouse_name"
                      required
                      value={formData.warehouse_name}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Kode Gudang <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      required
                      value={formData.code}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama PIC</label>
                    <input
                      type="text"
                      name="pic_name"
                      value={formData.pic_name}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Jarak (KM)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="distance_km"
                      value={formData.distance_km}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Wilayah <span className="text-red-400">*</span>
                    </label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      value={selectedRegion}
                      loadOptions={async (inputValue) => {
                        const options = await loadRegionOptions(inputValue);
                        return options;
                      }}
                      onChange={(option) => {
                        setSelectedRegion(option);
                        setFormData((prev) => ({ ...prev, subdistrict: option?.value || '' }));
                      }}
                      isClearable
                      placeholder="Cari Kecamatan, Kota, atau Provinsi..."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Alamat Lengkap</label>
                    <textarea
                      name="address"
                      rows={2}
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-70">
                  {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
