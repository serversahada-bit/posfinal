'use client';

import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Camera, Edit2, ImageIcon, Plus, Trash2, UserCog, X } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import type { User, UserRole } from '@/types';

type UserResponse = {
  success: boolean;
  message?: string;
  data?: User[];
};

type SaveUserResponse = {
  success: boolean;
  message?: string;
  data?: User;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: string[];
  existing_photo_url: string;
};

const availableMenus = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'buat_pesanan', label: 'Buat Pesanan' },
  { key: 'validasi_fat', label: 'Validasi FAT' },
  { key: 'olahan', label: 'Data Pesanan' },
  { key: 'pembelian_terbaru', label: 'Pembelian Terbaru' },
  { key: 'produk', label: 'Produk' },
  { key: 'promo', label: 'Promo' },
  { key: 'advertiser', label: 'Advertiser' },
  { key: 'sumber_iklan', label: 'Sumber Iklan' },
  { key: 'hadiah', label: 'Hadiah' },
  { key: 'bundling', label: 'Bundling' },
  { key: 'biaya_ongkir', label: 'Biaya Ongkir' },
  { key: 'penambahan_ekspedisi', label: 'Penambahan Ekspedisi' },
  { key: 'penambahan_ongkir', label: 'Penambahan Ongkir' },
  { key: 'gudang', label: 'Gudang' },
  { key: 'pembayaran', label: 'Pembayaran' },
] as const;

const emptyForm: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'cs',
  permissions: [],
  existing_photo_url: '',
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'finance', label: 'Finance' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'cs', label: 'Customer Service (CS)' },
  { value: 'cs_crm', label: 'CS/CRM' },
  { value: 'owner', label: 'Owner' },
];

const roleColors: Record<UserRole, string> = {
  admin: 'border-purple-200 bg-purple-50 text-purple-600',
  finance: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  warehouse: 'border-amber-200 bg-amber-50 text-amber-600',
  cs: 'border-blue-200 bg-blue-50 text-blue-600',
  cs_crm: 'border-pink-200 bg-pink-50 text-pink-600',
  owner: 'border-indigo-200 bg-indigo-50 text-indigo-600',
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');
const AUTH_UPDATED_EVENT = 'sahada-auth-updated';

export default function ManajemenUserPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const allPermissions = useMemo(() => availableMenus.map((item) => item.key), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const revokeBlobPreview = (value: string) => {
    if (value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  };

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const json: UserResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data user');
      }

      setUsers(json.data);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  const openCreateModal = () => {
    revokeBlobPreview(photoPreview);
    setEditingUser(null);
    setForm(emptyForm);
    setSelectedPhoto(null);
    setPhotoPreview('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    revokeBlobPreview(photoPreview);
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions ?? [],
      existing_photo_url: user.photo_url || '',
    });
    setSelectedPhoto(null);
    setPhotoPreview(user.photo_url || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    revokeBlobPreview(photoPreview);
    setIsModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
    setSelectedPhoto(null);
    setPhotoPreview('');
  };

  const handlePhotoChange = (file: File | null) => {
    revokeBlobPreview(photoPreview);
    setSelectedPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : form.existing_photo_url);
  };

  const togglePermission = (permission: string) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: exists ? prev.permissions.filter((item) => item !== permission) : [...prev.permissions, permission],
      };
    });
  };

  const syncCurrentUserSession = (updatedUser: User) => {
    if (!currentUser || currentUser.id !== updatedUser.id) {
      return;
    }

    const nextSessionUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      permissions: updatedUser.permissions ?? [],
      photo_url: updatedUser.photo_url ?? null,
    };

    localStorage.setItem('sahada-pos-session', JSON.stringify(nextSessionUser));
    window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = new FormData();
      if (editingUser?.id) payload.set('id', String(editingUser.id));
      payload.set('name', form.name.trim());
      payload.set('email', form.email.trim());
      payload.set('password', form.password.trim());
      payload.set('role', form.role);
      payload.set('permissions', JSON.stringify(form.role === 'admin' ? allPermissions : form.permissions));
      payload.set('existing_photo_url', form.existing_photo_url);
      if (selectedPhoto) payload.set('photo', selectedPhoto);

      const res = await fetch('/api/users', {
        method: editingUser ? 'PUT' : 'POST',
        body: payload,
      });

      const json: SaveUserResponse = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan user');
      }

      if (json.data) {
        syncCurrentUserSession(json.data);
      }

      Swal.fire('Berhasil', json.message || 'Data user berhasil disimpan.', 'success');
      closeModal();
      await fetchUsers();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (targetUser: User) => {
    if (currentUser?.id === targetUser.id) {
      Swal.fire('Akses Ditolak', 'Anda tidak bisa menghapus akun Anda sendiri.', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus user ini?',
      text: `${targetUser.name} akan dihapus permanen.`,
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
      const res = await fetch(`/api/users?id=${targetUser.id}`, {
        method: 'DELETE',
      });

      const json: { success: boolean; message?: string } = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Gagal menghapus user');
      }

      Swal.fire('Berhasil', json.message || 'User berhasil dihapus.', 'success');
      await fetchUsers();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen User</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola data pengguna sistem, username, password, role, dan foto profil.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Tambah User
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">ID</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Nama</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Username / Email</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="w-24 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                    Memuat data...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <UserCog className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    Belum ada data user.
                  </td>
                </tr>
              ) : (
                users.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">#{row.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                          {row.photo_url ? (
                            <Image src={row.photo_url} alt={row.name} fill unoptimized className="object-cover" sizes="44px" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{row.name}</div>
                          <div className="text-xs text-slate-400">{row.photo_url ? 'Foto profil aktif' : 'Belum ada foto profil'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{row.email}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${roleColors[row.role]}`}>
                        {row.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-800">{editingUser ? 'Edit User' : 'Tambah User'}</h3>
              <button type="button" onClick={closeModal} className="text-slate-400 transition-colors hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Foto Profil</label>
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                    {photoPreview ? (
                      <Image src={photoPreview} alt="Preview foto profil" fill unoptimized className="object-cover" sizes="64px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100">
                      <Camera className="h-4 w-4" />
                      Upload Foto
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(event) => handlePhotoChange(event.target.files?.[0] || null)}
                      />
                    </label>
                    <p className="mt-2 text-xs text-slate-400">Format: JPG, JPEG, PNG, WEBP.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Username / Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Password {editingUser ? <span className="text-xs font-normal text-slate-400">(Kosongkan jika tidak diubah)</span> : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.role}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-700 outline-none transition-colors focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Akses Menu</label>
                <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {availableMenus.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm transition-colors hover:text-purple-600">
                      <input
                        type="checkbox"
                        checked={form.role === 'admin' ? true : form.permissions.includes(item.key)}
                        disabled={form.role === 'admin'}
                        onChange={() => togglePermission(item.key)}
                        className="h-4 w-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500 disabled:cursor-not-allowed"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">Akun Admin otomatis memiliki akses ke semua menu.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-purple-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 hover:bg-purple-700 disabled:transform-none disabled:opacity-70"
                >
                  {isSubmitting ? 'Menyimpan...' : editingUser ? 'Simpan' : 'Tambahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
