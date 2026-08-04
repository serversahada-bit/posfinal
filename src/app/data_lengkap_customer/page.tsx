'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Download, Upload, Trash2, FileSpreadsheet, Search, Edit, Truck } from 'lucide-react';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import { useSocketEvent } from '@/hooks/useSocketEvent';

type OrderItem = {
  order_id: number;
  order_code: string;
  order_status: string;
  created_at: string;
  processing_at: string | null;
  last_update: string;
  advertiser_name: string | null;
  ad_source: string | null;
  notes: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  customer_name: string;
  whatsapp_number: string;
  desa: string | null;
  product_names: string | null;
  resi: string | null;
  id_reff: string | null;
  courier_name: string | null;
  courier_service: string | null;
  creator_name: string | null;
  source_table: string;
  source_label: string;
};

type OlahanResponse = {
  status: 'success' | 'error';
  message?: string;
  data?: OrderItem[];
};

type UserFilterOption = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type WarehouseFilterOption = {
  id: number;
  warehouse_name: string;
};

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_to_ship', label: 'Ready To Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'rts', label: 'RTS' },
  { value: 'problem', label: 'Problem' },
  { value: 'cancelled', label: 'Cancel' },
];

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export default function OlahanPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const sortByParam = searchParams.get('sort') ?? 'created_at';
  const statusParam = searchParams.get('status') ?? '';

  const [data, setData] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [creatorFilter, setCreatorFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state when searchParams change
  useEffect(() => {
    setStatusFilter(searchParams.get('status') ?? '');
  }, [searchParams]);

  const sortBy = sortByParam;
  const [users, setUsers] = useState<UserFilterOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseFilterOption[]>([]);

  const [bulkStatus, setBulkStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<{ id: number; source: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.append('sort', sortBy);
      if (startDate) query.append('start_date', startDate);
      if (endDate) query.append('end_date', endDate);
      if (statusFilter) query.append('status', statusFilter);
      if (creatorFilter) query.append('creator_name', creatorFilter);
      if (warehouseFilter) query.append('warehouse_id', warehouseFilter);
      if (searchQuery) query.append('search', searchQuery);

      const res = await fetch('/api/data_lengkap_customer?' + query.toString(), { cache: 'no-store' });
      const json: OlahanResponse = await res.json();

      if (json.status !== 'success' || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data pesanan');
      }

      setData(json.data);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [creatorFilter, endDate, sortBy, startDate, statusFilter, warehouseFilter, searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

  return () => window.clearTimeout(timer);
  }, [fetchData]);

  useSocketEvent('NEW_OLAHAN', () => {
    void fetchData();
  });

  useSocketEvent('REFRESH_OLAHAN', () => {
    void fetchData();
  });

  useSocketEvent('NEW_ORDER', () => {
    void fetchData();
  });

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const response = await fetch('/api/users', { cache: 'no-store' });
        const json: { success: boolean; data?: UserFilterOption[]; message?: string } = await response.json();

        if (!isMounted) return;
        if (!json.success || !json.data) throw new Error(json.message || 'Gagal mengambil data user');

        setUsers(json.data.filter((item) => item.role !== 'admin'));
      } catch (error: unknown) {
        if (isMounted) Swal.fire('Error', getErrorMessage(error), 'error');
      }
    };

    const loadWarehouses = async () => {
      try {
        const response = await fetch('/api/warehouses', { cache: 'no-store' });
        const json: { success: boolean; data?: WarehouseFilterOption[]; message?: string } = await response.json();

        if (!isMounted) return;
        if (!json.success || !json.data) throw new Error(json.message || 'Gagal mengambil data gudang');

        setWarehouses(json.data);
      } catch (error: unknown) {
        if (isMounted) Swal.fire('Error', getErrorMessage(error), 'error');
      }
    };

    void loadUsers();
    void loadWarehouses();

  return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(data.map((item) => ({ id: item.order_id, source: item.source_table })));
      return;
    }

    setSelectedIds([]);
  };

  const handleSelectOne = (id: number, source: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, { id, source }]);
      return;
    }

    setSelectedIds((prev) => prev.filter((item) => !(item.id === id && item.source === source)));
  };

  const getIdsBySource = (source: string) => selectedIds.filter((item) => item.source === source).map((item) => item.id).join(',');
  const serializeSelectedIds = () => selectedIds.map((item) => `${item.source}:${item.id}`).join(',');

  const applyBulkStatus = async () => {
    if (selectedIds.length === 0) {
      await Swal.fire('Perhatian', 'Pilih minimal satu pesanan!', 'warning');
      return;
    }

    if (!bulkStatus) {
      await Swal.fire('Perhatian', 'Pilih status baru!', 'warning');
      return;
    }

    const selectedLabel = statusOptions.find((item) => item.value === bulkStatus)?.label ?? bulkStatus;
    const result = await Swal.fire({
      title: 'Konfirmasi',
      text: `Apakah Anda yakin mengubah ${selectedIds.length} pesanan menjadi ${selectedLabel}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Ubah',
      cancelButtonText: 'Batal',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await fetch('/api/data_lengkap_customer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_update_status',
          bulk_status: bulkStatus,
          csoIds: getIdsBySource('CSO'),
          csoAutoIds: getIdsBySource('CSO_AUTO'),
          crmIds: getIdsBySource('CRM'),
          userId: user?.id ?? 0,
        }),
      });

      const json: { status: 'success' | 'error'; message: string } = await response.json();
      if (json.status !== 'success') {
        throw new Error(json.message || 'Gagal mengubah status pesanan');
      }

      await Swal.fire('Berhasil', json.message, 'success');
      setSelectedIds([]);
      await fetchData();
    } catch (error: unknown) {
      await Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  const applyBulkDelete = async () => {
    if (selectedIds.length === 0) {
      await Swal.fire('Perhatian', 'Pilih minimal satu pesanan!', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus Pesanan?',
      text: `Anda akan menghapus ${selectedIds.length} pesanan. Aksi ini tidak dapat dibatalkan! Stok akan dikembalikan otomatis.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await fetch('/api/data_lengkap_customer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_delete',
          csoIds: getIdsBySource('CSO'),
          csoAutoIds: getIdsBySource('CSO_AUTO'),
          crmIds: getIdsBySource('CRM'),
          userId: user?.id ?? 0,
        }),
      });

      const json: { status: 'success' | 'error'; message: string } = await response.json();
      if (json.status !== 'success') {
        throw new Error(json.message || 'Gagal menghapus pesanan');
      }

      await Swal.fire('Berhasil', json.message, 'success');
      setSelectedIds([]);
      await fetchData();
    } catch (error: unknown) {
      await Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const downloadBlob = (blob: Blob, filename: string, response?: Response) => {
    const headerName = response?.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1];
    const finalFilename = headerName || filename;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = finalFilename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    anchor.remove();
  };

  const submitExport = async () => {
    try {
      setExporting(true);
      const response = await fetch('/api/data_lengkap_customer/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          status: statusFilter,
          selectedIds: serializeSelectedIds(),
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengekspor data');
      }

      const blob = await response.blob();
      downloadBlob(blob, `Data_Lengkap_Customer_${Date.now()}.xlsx`, response);
    } catch (error: unknown) {
      await Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      const response = await fetch('/api/data_lengkap_customer/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          status: statusFilter,
          selectedIds: serializeSelectedIds(),
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengunduh template');
      }

      const blob = await response.blob();
      downloadBlob(blob, `Template_Update_Status_${Date.now()}.xlsx`, response);
    } catch (error: unknown) {
      await Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const openUploadModal = () => {
    setUploadFile(null);
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (isUploading) {
      return;
    }

    setUploadFile(null);
    setIsUploadModalOpen(false);
  };

  const handleUploadStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!uploadFile) {
      await Swal.fire('Perhatian', 'Pilih file XLSX terlebih dahulu.', 'warning');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set('file', uploadFile);
      formData.set('user_id', String(user?.id ?? 0));

      const response = await fetch('/api/data_lengkap_customer/import-status', {
        method: 'POST',
        body: formData,
      });

      const json: { status: 'success' | 'error'; message: string } = await response.json();
      if (json.status !== 'success') {
        throw new Error(json.message || 'Gagal memproses file status');
      }

      await Swal.fire('Berhasil', json.message, 'success');
      closeUploadModal();
      await fetchData();
    } catch (error: unknown) {
      await Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsUploading(false);
    }
  };


  const sortDescriptions: Record<string, string> = {
    created_at: 'Daftar semua data pesanan, diurutkan berdasarkan Create Order. Gunakan filter untuk mencari data tertentu.',
    processing_at: 'Menampilkan hanya pesanan yang sudah memiliki Processing At. Gunakan filter untuk mencari data tertentu.',
    last_update: 'Daftar semua data pesanan, diurutkan berdasarkan Last Update. Gunakan filter untuk mencari data tertentu.',
  };

  const currentSortDescription = sortDescriptions[sortBy] ?? sortDescriptions.created_at;
  const showCreatedAtColumn = sortBy === 'created_at';
  const showProcessingAtColumn = sortBy === 'processing_at';
  const showLastUpdateColumn = sortBy === 'last_update';
  const visibleColumnCount = 8 + (showCreatedAtColumn ? 1 : 0) + (showProcessingAtColumn ? 1 : 0) + (showLastUpdateColumn ? 1 : 0);

  return (
    <div className="h-full flex flex-col p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Lengkap</h1>
          <p className="text-sm text-slate-400 mt-1">{currentSortDescription}</p>
        </div>
        <div className="flex flex-wrap items-center justify-start md:justify-end gap-3 flex-1">
          {/* Group 1: Template & Upload */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void downloadTemplate()} disabled={isDownloadingTemplate} className="group relative inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl text-sm font-bold transition-all duration-300 shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:transform-none overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out rounded-xl"></div>
              {isDownloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 relative z-10" />}
              <span className="relative z-10">Download Template</span>
            </button>

            <button type="button" onClick={openUploadModal} className="group relative inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 border border-emerald-100 hover:border-emerald-500 overflow-hidden">
              <Upload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 relative z-10" />
              <span className="relative z-10">Upload Status</span>
            </button>
          </div>

          {/* Group 2: Export & Delete */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void submitExport()} disabled={exporting} className="group relative inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 border border-blue-100 hover:border-blue-600 disabled:opacity-75 disabled:cursor-not-allowed disabled:transform-none overflow-hidden">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 relative z-10" />}
              <span className="relative z-10">{exporting ? 'Mengekspor...' : 'Export Excel'}</span>
            </button>

            {user?.role === 'admin' ? (
              <button type="button" onClick={() => void applyBulkDelete()} className="group relative inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:-translate-y-0.5 border border-red-100 hover:border-red-500 overflow-hidden">
                <Trash2 className="w-4 h-4 transition-transform group-hover:rotate-12 relative z-10" />
                <span className="relative z-10">Hapus</span>
              </button>
            ) : null}
          </div>

          {/* Group 3: Bulk Update Status */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className="text-sm font-semibold text-slate-600 bg-transparent border-none focus:ring-0 outline-none cursor-pointer px-3 py-1.5">
              <option value="" disabled>-- Ubah Status Massal --</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => void applyBulkStatus()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95">
              Terapkan
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
        <form className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4 items-end" onSubmit={(event) => { event.preventDefault(); void fetchData(); }}>
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Pencarian</label>
            <input type="text" placeholder="Nama, WA, atau ID Order" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm placeholder:text-slate-400" />
          </div>
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tanggal Mulai</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tanggal Akhir</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status Pesanan</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm">
              <option value="">Semua Status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Creator Order</label>
            <select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm">
              <option value="">Semua Creator</option>
              {users.map((option) => (
                <option key={option.id} value={option.name || option.email}>{option.name || option.email}</option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Gudang</label>
            <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm">
              <option value="">Semua Gudang</option>
              {warehouses.map((option) => (
                <option key={option.id} value={String(option.id)}>{option.warehouse_name}</option>
              ))}
            </select>
          </div>
          <div className="w-full flex gap-2">
            <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors w-full md:w-auto">Cari</button>
            {startDate || endDate || statusFilter || creatorFilter || warehouseFilter || searchQuery ? (
              <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(''); setCreatorFilter(''); setWarehouseFilter(''); setSearchQuery(''); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full md:w-auto">
                Reset
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-center w-12"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" onChange={handleSelectAll} checked={data.length > 0 && selectedIds.length === data.length} /></th>
                {showCreatedAtColumn ? <th className="p-4 font-semibold text-slate-600">Order Masuk</th> : null}
                {showProcessingAtColumn ? <th className="p-4 font-semibold text-slate-600">Processing At</th> : null}
                {showLastUpdateColumn ? <th className="p-4 font-semibold text-slate-600">Last Update</th> : null}
                <th className="p-4 font-semibold text-slate-600">ID Pesanan</th>
                <th className="p-4 font-semibold text-slate-600">Data Pelanggan</th>
                <th className="p-4 font-semibold text-slate-600">Nama Desa</th>
                <th className="p-4 font-semibold text-slate-600">Produk Pilihan</th>
                <th className="p-4 font-semibold text-slate-600">Ekspedisi</th>
                <th className="p-4 font-semibold text-slate-600">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-slate-500 font-medium">Memuat data...</p>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="text-center py-12">
                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">Belum ada data pesanan yang cocok.</p>
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={`${row.source_table}-${row.order_id}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center align-top">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" checked={selectedIds.some((item) => item.id === row.order_id && item.source === row.source_table)} onChange={(event) => handleSelectOne(row.order_id, row.source_table, event.target.checked)} />
                    </td>
                    {showCreatedAtColumn ? <td className="p-4 text-slate-500 text-xs align-top whitespace-nowrap">{formatDate(row.created_at)}</td> : null}
                    {showProcessingAtColumn ? <td className="p-4 text-slate-500 text-xs align-top whitespace-nowrap">{row.processing_at ? formatDate(row.processing_at) : '-'}</td> : null}
                    {showLastUpdateColumn ? <td className="p-4 text-slate-500 text-xs align-top whitespace-nowrap">{formatDate(row.last_update)}</td> : null}
                    <td className="p-4 align-top">
                      <span className="font-bold text-slate-700">{row.order_code}</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {(() => {
                          let badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                          if (row.source_label === 'CRM') badgeClass = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                          else if (row.source_label === 'CSO AKUISISI') badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                          else if (row.source_label === 'RESEND') badgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
                          return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>{row.source_label}</span>;
                        })()}
                        {row.advertiser_name ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">ADV: {row.advertiser_name}</span> : null}
                        {row.ad_source ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">SRC: {row.ad_source}</span> : null}
                      </div>
                      {row.creator_name ? <div className="text-[11px] text-slate-500 font-medium mt-1.5 truncate">Creator: <span className="font-bold text-slate-700">{row.creator_name}</span></div> : null}
                      {row.warehouse_name ? <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">Gudang: <span className="font-bold text-slate-700">{row.warehouse_name}</span></div> : null}
                      {row.id_reff ? <div className="text-[11px] text-slate-500 font-medium mt-1.5 truncate">ID Reff: <span className="font-bold text-slate-700">{row.id_reff}</span></div> : null}
                      {row.resi ? <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">Resi: <span className="font-bold text-slate-700">{row.resi}</span></div> : null}
                    </td>
                    <td className="p-4 align-top"><p className="font-bold text-slate-700">{row.customer_name}</p><p className="text-xs text-slate-500 mt-0.5">{row.whatsapp_number}</p></td>
                    <td className="p-4 text-slate-600 align-top max-w-[150px] truncate">{row.desa || '-'}</td>
                    <td className="p-4 text-slate-600 align-top max-w-[200px] truncate" title={row.product_names || ''}>{row.product_names || '-'}</td>
                    <td className="p-4 text-slate-500 text-xs align-top">
                      {row.courier_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Truck className="w-3 h-3 mr-1" />
                          {row.courier_name}
                          {row.courier_service ? <span className="ml-1 text-indigo-400">� {row.courier_service}</span> : null}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      {(() => {
                        const statusMap: Record<string, { label: string; className: string }> = {
                          pending: { label: 'Pending', className: 'bg-amber-50 text-amber-600 border-amber-200' },
                          processing: { label: 'Processing', className: 'bg-blue-50 text-blue-600 border-blue-200' },
                          ready_to_ship: { label: 'Ready To Ship', className: 'bg-teal-50 text-teal-600 border-teal-200' },
                          shipped: { label: 'Shipped', className: 'bg-purple-50 text-purple-600 border-purple-200' },
                          completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                          rts: { label: 'RTS', className: 'bg-orange-50 text-orange-600 border-orange-200' },
                          problem: { label: 'Problem', className: 'bg-red-50 text-red-600 border-red-200' },
                        };
                        const currentStatus = statusMap[row.order_status] || { label: row.order_status, className: 'bg-slate-50 text-slate-600 border-slate-200' };
                        return <span className={`px-2.5 py-1 rounded border text-xs font-bold ${currentStatus.className}`}>{currentStatus.label}</span>;
                      })()}
                    </td>
                    <td className="p-4 align-top text-right">
                      <Link href={`/olahan/edit?id=${row.order_code}&source=${row.source_table}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isUploadModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 opacity-100 transition-opacity duration-300" onClick={closeUploadModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform scale-100 transition-transform duration-300" onClick={(event) => event.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">Upload Update Status</h3>
              <button type="button" onClick={closeUploadModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleUploadStatus} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">File Template (.xlsx)</label>
                <input type="file" accept=".xlsx" required onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-colors border border-slate-200 rounded-xl cursor-pointer" />
                <p className="text-xs text-slate-500 mt-2">Pastikan Anda menggunakan file hasil dari &quot;Download Template&quot; dan menyimpannya dalam format XLSX.</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeUploadModal} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Batal</button>
                <button type="submit" disabled={isUploading} className="px-5 py-2.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-70 inline-flex items-center gap-2">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isUploading ? 'Upload & Update...' : 'Upload & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}


