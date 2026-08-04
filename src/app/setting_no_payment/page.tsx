'use client';

import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Edit2, Plus, ReceiptText, Trash2, X } from 'lucide-react';

type NoPaymentMethod = {
  id: number;
  method_name: string;
  description: string | null;
  is_active: boolean | null;
  no_shipping_cost: boolean | null;
};

type NoPaymentResponse = {
  success: boolean;
  message?: string;
  data?: NoPaymentMethod[];
};

type FormState = {
  method_name: string;
  description: string;
  is_active: boolean;
  no_shipping_cost: boolean;
};

const emptyForm: FormState = {
  method_name: '',
  description: '',
  is_active: true,
  no_shipping_cost: false,
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export default function SettingNoPaymentPage() {
  const [methods, setMethods] = useState<NoPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMethod, setEditingMethod] = useState<NoPaymentMethod | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function fetchMethods() {
    setLoading(true);
    try {
      const res = await fetch('/api/setting-no-payment', { cache: 'no-store' });
      const json: NoPaymentResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data metode no payment');
      }

      setMethods(json.data);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchMethods();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const openCreateModal = () => {
    setEditingMethod(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (method: NoPaymentMethod) => {
    setEditingMethod(method);
    setForm({
      method_name: method.method_name,
      description: method.description ?? '',
      is_active: Boolean(method.is_active),
      no_shipping_cost: Boolean(method.no_shipping_cost),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMethod(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/setting-no-payment', {
        method: editingMethod ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingMethod?.id,
          method_name: form.method_name,
          description: form.description,
          is_active: form.is_active,
          no_shipping_cost: form.no_shipping_cost,
        }),
      });

      const json: { success: boolean; message?: string } = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan metode no payment');
      }

      Swal.fire('Berhasil', json.message || 'Metode no payment berhasil disimpan.', 'success');
      closeModal();
      await fetchMethods();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (method: NoPaymentMethod) => {
    const result = await Swal.fire({
      title: 'Hapus metode ini?',
      text: `${method.method_name} akan dihapus permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/setting-no-payment?id=${method.id}`, {
        method: 'DELETE',
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menghapus metode no payment');
      }

      Swal.fire('Berhasil', json.message || 'Metode no payment berhasil dihapus.', 'success');
      await fetchMethods();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">No Payment</h1>
          <p className="mt-1 text-sm text-slate-400">Kelola daftar metode No Payment (seperti COD, Free, dll).</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Tambah Metode
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="w-12 p-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Metode</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Deskripsi</th>
                <th className="p-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Tanpa Ongkir</th>
                <th className="p-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="p-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                    Memuat data...
                  </td>
                </tr>
              ) : methods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ReceiptText className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    Belum ada data metode No Payment.
                  </td>
                </tr>
              ) : (
                methods.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="p-4 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4 font-semibold text-slate-700">{row.method_name}</td>
                    <td className="p-4 text-slate-600">{row.description || '-'}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.no_shipping_cost ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.no_shipping_cost ? 'Ya' : 'Tidak'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {row.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
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
        <div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="flex min-h-full items-center justify-center">
            <div
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <h2 className="text-lg font-bold text-slate-800">{editingMethod ? 'Edit Metode' : 'Tambah Metode No Payment'}</h2>
                <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Nama Metode <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.method_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, method_name: event.target.value }))}
                      placeholder="Contoh: COD"
                      className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">Deskripsi</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Penjelasan singkat"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Aktif</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.no_shipping_cost}
                      onChange={(event) => setForm((prev) => ({ ...prev, no_shipping_cost: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Tanpa biaya ongkir</span>
                  </label>
                </div>

                <div className="mt-6 flex gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-70"
                  >
                    {isSubmitting ? 'Menyimpan...' : editingMethod ? 'Simpan Perubahan' : 'Tambah Metode'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
