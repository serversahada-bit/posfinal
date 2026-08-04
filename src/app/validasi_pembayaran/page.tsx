'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import Swal from 'sweetalert2';
import { ExternalLink, Check, X } from 'lucide-react';

const getProofUrl = (value?: string | null) => {
  if (!value) {
    return '';
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `/${value.replace(/^\/+/, '')}`;
};

export default function ValidasiPembayaranPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [idReff, setIdReff] = useState('');
  const [idReffWarning, setIdReffWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/validasi_pembayaran');
      const json = await res.json();
      if (json.status === 'success') {
        setOrders(json.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useSocketEvent('NEW_ORDER', () => {
    fetchOrders();
  });

  // Handle ID Reff check
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    if (idReff.trim().length > 0) {
      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/validasi_pembayaran/check?check_id_reff=' + encodeURIComponent(idReff.trim()));
          const json = await res.json();
          setIdReffWarning(json.exists === true);
        } catch (e) {
          console.error(e);
        }
      }, 500);
    } else {
      setIdReffWarning(false);
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [idReff]);

  const handleApproveClick = (order: any) => {
    setSelectedPayment(order);
    setIdReff('');
    setIdReffWarning(false);
    setIsModalOpen(true);
  };

  const handleRejectClick = async (order: any) => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Tolak Pembayaran',
      input: 'textarea',
      inputLabel: 'Alasan Penolakan',
      inputPlaceholder: 'Masukkan alasan kenapa pembayaran ditolak...',
      showCancelButton: true,
      confirmButtonText: 'Tolak Pembayaran',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Alasan penolakan wajib diisi!';
        }
      }
    });

    if (!isConfirmed) return;
    
    try {
      const res = await fetch('/api/validasi_pembayaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          payment_id: order.payment_id,
          source_table: order.source_table,
          reject_reason: reason.trim()
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        Swal.fire('Berhasil', json.message, 'success');
        fetchOrders();
      } else {
        Swal.fire('Error', json.message, 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Gagal menolak pembayaran', 'error');
    }
  };

  const submitApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idReff.trim()) {
      Swal.fire('Error', 'ID Reff wajib diisi', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/validasi_pembayaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          payment_id: selectedPayment.payment_id,
          source_table: selectedPayment.source_table,
          id_reff: idReff.trim()
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        Swal.fire('Berhasil', json.message, 'success');
        setIsModalOpen(false);
        fetchOrders();
      } else {
        Swal.fire('Error', json.message, 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Gagal memvalidasi pembayaran', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Validasi FAT</h1>
          <p className="text-sm text-slate-400 mt-1">Halaman untuk memvalidasi pembayaran Transfer Bank.</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal & Waktu</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID Pesanan</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bayar</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekening Tujuan</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bukti Transfer CRM</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Memuat data...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Check className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm">Tidak ada pembayaran yang perlu divalidasi.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-slate-400 text-xs">
                      {new Date(row.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 text-sm">
                      {row.order_code}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 text-sm">
                      {row.customer_name}
                    </td>
                    <td className="p-4 font-bold text-emerald-600 text-sm">
                      Rp {Number(row.total_payment).toLocaleString('id-ID')}
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-semibold text-slate-700">{row.bank_name || '-'}</p>
                      <p className="text-xs text-slate-500">{row.account_number || ''} - {row.account_name || ''}</p>
                    </td>
                    <td className="p-4">
                      {row.payment_proof_url ? (
                        <a href={getProofUrl(row.payment_proof_url)} target="_blank" rel="noreferrer" className="text-purple-600 hover:text-purple-700 hover:underline text-sm font-medium flex items-center gap-1 w-max">
                          <ExternalLink className="w-4 h-4" />
                          Lihat Bukti
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm">Tidak ada</span>
                      )}
                    </td>
                    <td className="p-4">
                      {row.payment_status === 'rejected' ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-red-50 text-red-600 border-red-200">Ditolak</span>
                          {row.reject_reason && (
                            <span className="text-[10px] text-red-500 font-medium break-words max-w-[150px] leading-tight">
                              Alasan: {row.reject_reason}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-amber-50 text-amber-600 border-amber-200">Menunggu</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleApproveClick(row)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm">
                          Approve
                        </button>
                        <button onClick={() => handleRejectClick(row)} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm">
                          Reject
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

      {/* Modal Approve */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Approve Pembayaran</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitApprove} className="p-6 space-y-4 bg-slate-50/50">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">ID Reff <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={idReff}
                  onChange={(e) => setIdReff(e.target.value)}
                  required 
                  placeholder="Masukkan ID Referensi" 
                  className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                />
                {idReffWarning && (
                  <p className="text-red-500 text-[11px] mt-1.5 font-medium flex items-center gap-1">
                    <X className="w-3 h-3" /> Peringatan: ID Reff ini sudah pernah digunakan!
                  </p>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors shadow-sm">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                  <Check className="w-4 h-4" />
                  {isSubmitting ? 'Memproses...' : 'Konfirmasi Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
