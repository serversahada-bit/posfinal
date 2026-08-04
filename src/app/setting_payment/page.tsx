'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import { CreditCard, Edit2, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';

type PaymentAccount = {
  id: number;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  image_url: string | null;
};

type PaymentAccountsResponse = {
  success: boolean;
  message?: string;
  data?: PaymentAccount[];
};

type PaymentFormState = {
  bank_name: string;
  account_name: string;
  account_number: string;
  existing_image_url: string;
};

const emptyForm: PaymentFormState = {
  bank_name: '',
  account_name: '',
  account_number: '',
  existing_image_url: '',
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

const normalizeImageSrc = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.startsWith('http') || value.startsWith('/') || value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }

  return `/${value}`;
};

export default function SettingPaymentPage() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/setting-payment', { cache: 'no-store' });
      const json: PaymentAccountsResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data rekening');
      }

      setAccounts(json.data);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAccounts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const openCreateModal = () => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setEditingAccount(null);
    setForm(emptyForm);
    setImageFile(null);
    setPreviewUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (account: PaymentAccount) => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setEditingAccount(account);
    setForm({
      bank_name: account.bank_name ?? '',
      account_name: account.account_name ?? '',
      account_number: account.account_number ?? '',
      existing_image_url: account.image_url ?? '',
    });
    setImageFile(null);
    setPreviewUrl(account.image_url ? normalizeImageSrc(account.image_url) : '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setIsModalOpen(false);
    setEditingAccount(null);
    setForm(emptyForm);
    setImageFile(null);
    setPreviewUrl('');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : form.existing_image_url ? normalizeImageSrc(form.existing_image_url) : '');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.set('action', editingAccount ? 'update' : 'create');
      payload.set('bank_name', form.bank_name);
      payload.set('account_name', form.account_name);
      payload.set('account_number', form.account_number);
      payload.set('existing_image_url', form.existing_image_url);

      if (editingAccount) {
        payload.set('id', String(editingAccount.id));
      }

      if (imageFile) {
        payload.set('payment_image', imageFile);
      }

      const res = await fetch('/api/setting-payment', {
        method: 'POST',
        body: payload,
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan rekening');
      }

      Swal.fire('Berhasil', json.message || 'Data rekening berhasil disimpan.', 'success');
      closeModal();
      await fetchAccounts();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (account: PaymentAccount) => {
    const result = await Swal.fire({
      title: 'Hapus rekening ini?',
      text: `${account.bank_name ?? 'Rekening'} akan dihapus permanen.`,
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
      const payload = new FormData();
      payload.set('action', 'delete');
      payload.set('id', String(account.id));

      const res = await fetch('/api/setting-payment', {
        method: 'POST',
        body: payload,
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menghapus rekening');
      }

      Swal.fire('Berhasil', json.message || 'Rekening berhasil dihapus.', 'success');
      await fetchAccounts();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payment</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola daftar rekening bank pembayaran untuk menerima transfer.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Tambah Rekening
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="w-12 p-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                <th className="w-16 p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Logo</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Bank</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Pemilik</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">No. Rekening</th>
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
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CreditCard className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    Belum ada data rekening.
                  </td>
                </tr>
              ) : (
                accounts.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="p-4 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="p-4">
                      {row.image_url ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <Image src={normalizeImageSrc(row.image_url)} alt={row.bank_name ?? 'Logo pembayaran'} fill className="object-contain" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                          <CreditCard className="h-4 w-4" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-700">{row.bank_name}</td>
                    <td className="p-4 text-slate-600">{row.account_name}</td>
                    <td className="p-4 font-mono text-slate-500">{row.account_number}</td>
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
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <h2 className="text-lg font-bold text-slate-800">{editingAccount ? 'Edit Rekening' : 'Tambah Rekening Baru'}</h2>
                <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">Logo / QR Code</label>
                    <label className="relative flex h-32 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100">
                      {previewUrl ? (
                        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-slate-50">
                          {previewUrl.startsWith('blob:') || previewUrl.startsWith('data:') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={previewUrl} alt="Preview pembayaran" className="mb-1 h-20 object-contain" />
                          ) : (
                            <div className="relative mb-1 h-20 w-full">
                              <Image src={previewUrl} alt="Preview pembayaran" fill className="object-contain" />
                            </div>
                          )}
                          <p className="text-[10px] font-medium text-slate-500">{imageFile?.name ?? 'Klik untuk mengubah'}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-3">
                          <ImageIcon className="mb-1.5 h-7 w-7 text-purple-400" />
                          <p className="mb-0.5 text-xs font-medium text-purple-500">Unggah Logo / QR</p>
                          <p className="text-[10px] text-slate-400">.jpg, .jpeg, .png, .webp</p>
                        </div>
                      )}
                      <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Nama Bank / E-Wallet <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.bank_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, bank_name: event.target.value }))}
                      placeholder="BCA, Mandiri, ShopeePay"
                      className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Nama Pemilik <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.account_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, account_name: event.target.value }))}
                      placeholder="PT Sahada Sejahtera"
                      className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Nomor Rekening <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.account_number}
                      onChange={(event) => setForm((prev) => ({ ...prev, account_number: event.target.value }))}
                      placeholder="1234567890"
                      className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
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
                    {isSubmitting ? 'Menyimpan...' : editingAccount ? 'Simpan Perubahan' : 'Tambah Rekening'}
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
