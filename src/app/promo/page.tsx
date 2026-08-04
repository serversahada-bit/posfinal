'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Plus, Edit2, Trash2, X, Check, Tag } from 'lucide-react';

export default function PromoPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    promo_name: '',
    promo_type: 'fisik',
    start_date: '',
    end_date: '',
    status: 'active'
  });

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promo');
      const json = await res.json();
      if (json.success) {
        setPromos(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const openModal = (promo: any = null) => {
    if (promo) {
      setEditId(promo.id);
      setFormData({
        promo_name: promo.promo_name || '',
        promo_type: promo.promo_type || 'fisik',
        start_date: promo.start_date ? new Date(promo.start_date).toISOString().split('T')[0] : '',
        end_date: promo.end_date ? new Date(promo.end_date).toISOString().split('T')[0] : '',
        status: promo.status || 'active'
      });
    } else {
      setEditId(null);
      setFormData({
        promo_name: '',
        promo_type: 'fisik',
        start_date: '',
        end_date: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.promo_name.trim()) {
      Swal.fire('Error', 'Nama Promo wajib diisi.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editId ? 'update' : 'create',
          id: editId,
          ...formData
        })
      });
      const json = await res.json();
      
      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        setIsModalOpen(false);
        fetchPromos();
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
    if (!confirm('Apakah Anda yakin ingin menghapus promo ini?')) return;
    
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      const json = await res.json();
      
      if (json.success) {
        Swal.fire('Berhasil', json.message, 'success');
        fetchPromos();
      } else {
        Swal.fire('Error', json.message || 'Gagal menghapus promo', 'error');
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
          <h1 className="text-2xl font-bold text-slate-800">Promo</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola daftar nama promo Anda.</p>
        </div>
        <button onClick={() => openModal()} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          Tambah Promo
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center w-16">No</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Promo</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Periode Aktif</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Memuat data...</td></tr>
              ) : promos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Tag className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada data promo.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                promos.map((row, idx) => {
                  let startDate = '-';
                  let endDate = '-';
                  if (row.start_date) {
                    startDate = new Date(row.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  }
                  if (row.end_date) {
                    endDate = new Date(row.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  }
                  const periode = (startDate === '-' && endDate === '-') ? <span className="text-slate-400">Selamanya</span> : `${startDate} s.d. ${endDate}`;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-center text-slate-400 font-medium text-sm">{idx + 1}</td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-700 text-sm">{row.promo_name}</p>
                      </td>
                      <td className="p-4">
                        {row.promo_type === 'voucher' ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-100">Voucher</span>
                        ) : row.promo_type === 'digital' ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">Digital</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-100">Fisik</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {periode}
                      </td>
                      <td className="p-4">
                        {row.status === 'active' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Aktif</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">Nonaktif</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal(row)} className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors border border-amber-200" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit Promo' : 'Tambah Promo Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 bg-slate-50/50 overflow-y-auto flex-1">
              <form id="promoForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Promo <span className="text-red-500">*</span></label>
                  <input 
                    type="text" name="promo_name" required placeholder="Cth: Promo Gila Kemerdekaan"
                    value={formData.promo_name} onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipe Promo</label>
                  <select 
                    name="promo_type" 
                    value={formData.promo_type} onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  >
                    <option value="fisik">Barang Fisik</option>
                    <option value="digital">Produk Digital</option>
                    <option value="voucher">Voucher Diskon</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mulai (Opsional)</label>
                    <input 
                      type="date" name="start_date" 
                      value={formData.start_date} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Berakhir (Opsional)</label>
                    <input 
                      type="date" name="end_date" 
                      value={formData.end_date} onChange={handleInputChange}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">*Kosongkan tanggal jika promo berlaku selamanya.</p>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                  <select 
                    name="status" 
                    value={formData.status} onChange={handleInputChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors shadow-sm">
                Batal
              </button>
              <button type="submit" form="promoForm" disabled={isSubmitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Promo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
