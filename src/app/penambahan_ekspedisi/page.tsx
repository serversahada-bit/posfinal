'use client';

import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Check, Edit2, Plane, Plus, Trash2, X } from 'lucide-react';

type CourierItem = {
  id: number;
  courier_name: string | null;
  service_type: string | null;
  logo_path: string | null;
  code: string | null;
  base_weight_gram: number;
  extra_weight_step_gram: number;
  rounding_tolerance_gram: number;
};

type CourierResponse = {
  success: boolean;
  message?: string;
  data?: CourierItem[];
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export default function PenambahanEkspedisiPage() {
  const [couriers, setCouriers] = useState<CourierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    courier_name: '',
    code: '',
    logo_path: '',
    base_weight_gram: '1000',
    extra_weight_step_gram: '1000',
    rounding_tolerance_gram: '300',
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await fetch('/api/couriers');
        const json: CourierResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (!json.success) {
          throw new Error(json.message || 'Gagal mengambil data ekspedisi');
        }

        setCouriers(json.data || []);
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

  const fetchCouriers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/couriers');
      const json: CourierResponse = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal mengambil data ekspedisi');
      }

      setCouriers(json.data || []);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setFormData({
      courier_name: '',
      code: '',
      logo_path: '',
      base_weight_gram: '1000',
      extra_weight_step_gram: '1000',
      rounding_tolerance_gram: '300',
    });
  };

  const openModal = (courier: CourierItem | null = null) => {
    if (courier) {
      setEditId(courier.id);
      setFormData({
        courier_name: courier.courier_name || '',
        code: courier.code || '',
        logo_path: courier.logo_path || '',
        base_weight_gram: String(courier.base_weight_gram || 1000),
        extra_weight_step_gram: String(courier.extra_weight_step_gram || 1000),
        rounding_tolerance_gram: String(courier.rounding_tolerance_gram || 0),
      });
    } else {
      resetForm();
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.courier_name.trim()) {
      Swal.fire('Error', 'Nama Ekspedisi wajib diisi.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: editId ? 'update' : 'create',
          id: editId,
          ...formData,
        }),
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan ekspedisi');
      }

      Swal.fire('Berhasil', json.message || 'Data ekspedisi berhasil disimpan.', 'success');
      closeModal();
      await fetchCouriers();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus ekspedisi ini?')) {
      return;
    }

    try {
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          id,
        }),
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menghapus ekspedisi');
      }

      Swal.fire('Berhasil', json.message || 'Ekspedisi berhasil dihapus.', 'success');
      await fetchCouriers();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ekspedisi</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola daftar ekspedisi / kurir Anda.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Ekspedisi
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">#</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Ekspedisi</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Path Logo</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Batas Dasar</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kelipatan</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengurangan</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    Memuat data...
                  </td>
                </tr>
              ) : couriers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Plane className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada data ekspedisi.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                couriers.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center text-sm font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 text-sm">{row.courier_name}</p>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-purple-50 text-purple-700 font-mono text-[11px] font-bold">
                        {row.code || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-500 text-xs break-all">{row.logo_path || '-'}</span>
                    </td>
                    <td className="p-4 text-slate-500 text-xs">{row.base_weight_gram} g</td>
                    <td className="p-4 text-slate-500 text-xs">{row.extra_weight_step_gram} g</td>
                    <td className="p-4 text-slate-500 text-xs">{row.rounding_tolerance_gram} g</td>
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
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit Ekspedisi' : 'Tambah Ekspedisi Baru'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 md:p-6 bg-slate-50/50 flex-1">
              <form id="courierForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nama Ekspedisi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="courier_name"
                    required
                    value={formData.courier_name}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kode Ekspedisi</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Path Logo (Opsional)</label>
                  <input
                    type="text"
                    name="logo_path"
                    value={formData.logo_path}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Batas Dasar (gram)</label>
                  <input
                    type="number"
                    min="1"
                    name="base_weight_gram"
                    value={formData.base_weight_gram}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kelipatan Tambahan (gram)</label>
                  <input
                    type="number"
                    min="1"
                    name="extra_weight_step_gram"
                    value={formData.extra_weight_step_gram}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pengurangan / Toleransi (gram)</label>
                  <input
                    type="number"
                    min="0"
                    name="rounding_tolerance_gram"
                    value={formData.rounding_tolerance_gram}
                    onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
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
                form="courierForm"
                disabled={isSubmitting}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Ekspedisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
