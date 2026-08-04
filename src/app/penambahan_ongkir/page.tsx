'use client';

import React, { useEffect, useState } from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';
import Swal from 'sweetalert2';
import { Download, Edit2, FileUp, PencilLine, Plus, Search, Trash2, X } from 'lucide-react';

type CourierOption = {
  courier_name: string | null;
};

type TarifRow = {
  id: number;
  kode_asal: string | null;
  kode_tujuan: string | null;
  nama_tujuan: string | null;
  kurir: string | null;
  harga: string | null;
  estimasi: string | null;
  out_of_coverage: string | null;
};

type TarifResponse = {
  success: boolean;
  message?: string;
  data?: {
    items: TarifRow[];
    couriers: CourierOption[];
    page: number;
    totalPages: number;
    totalRows: number;
  };
};

type DestinationOption = {
  id: string;
  text: string;
};

const originOptions = [
  { value: '39900', label: 'Madiun (39900)' },
  { value: '6573', label: 'Bekasi (6573)' },
  { value: '17665', label: 'Jakarta (17665)' },
];

const originMap: Record<string, string> = {
  '39900': 'Madiun (39900)',
  '6573': 'Bekasi (6573)',
  '17665': 'Jakarta (17665)',
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export default function PenambahanOngkirPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tarifList, setTarifList] = useState<TarifRow[]>([]);
  const [couriers, setCouriers] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    kode_asal: '',
    nama_tujuan: '',
    kurir: '',
    harga: '',
    estimasi: '',
    out_of_coverage: '',
  });
  const [selectedDestination, setSelectedDestination] = useState<DestinationOption | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [truncateTable, setTruncateTable] = useState(false);
  const [bulkFindText, setBulkFindText] = useState('');
  const [bulkReplaceText, setBulkReplaceText] = useState('');

  const fetchTariffs = async (nextPage = page, nextQuery = query) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
      });

      if (nextQuery.trim()) {
        params.set('search', nextQuery.trim());
      }

      const res = await fetch(`/api/shipping/tariffs?${params.toString()}`);
      const json: TarifResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data tarif ongkir');
      }

      setTarifList(json.data.items);
      setCouriers((json.data.couriers || []).map((item) => item.courier_name).filter((value): value is string => Boolean(value)));
      setPage(json.data.page);
      setTotalPages(json.data.totalPages);
      setSelectedIds([]);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const res = await fetch('/api/shipping/tariffs?page=1');
        const json: TarifResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (!json.success || !json.data) {
          throw new Error(json.message || 'Gagal mengambil data tarif ongkir');
        }

        setTarifList(json.data.items);
        setCouriers((json.data.couriers || []).map((item) => item.courier_name).filter((value): value is string => Boolean(value)));
        setPage(json.data.page);
        setTotalPages(json.data.totalPages);
        setSelectedIds([]);
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

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const resetForm = () => {
    setEditId(null);
    setFormData({
      kode_asal: '',
      nama_tujuan: '',
      kurir: '',
      harga: '',
      estimasi: '',
      out_of_coverage: '',
    });
    setSelectedDestination(null);
  };

  const openModal = (row: TarifRow | null = null) => {
    if (row) {
      setEditId(row.id);
      setFormData({
        kode_asal: row.kode_asal || '',
        nama_tujuan: row.nama_tujuan || '',
        kurir: row.kurir || '',
        harga: row.harga || '',
        estimasi: row.estimasi || '',
        out_of_coverage: row.out_of_coverage || '',
      });
      setSelectedDestination(row.nama_tujuan ? { id: row.nama_tujuan, text: row.nama_tujuan } : null);
    } else {
      resetForm();
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const loadDestinationOptions = async (inputValue: string) => {
    const params = new URLSearchParams();
    if (inputValue.trim()) {
      params.set('q', inputValue.trim());
    }

    const res = await fetch(`/api/shipping/destinations?${params.toString()}`);
    const json: DestinationOption[] = await res.json();

    return json.map((item) => ({
      value: item.id,
      label: item.text,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.nama_tujuan.trim() || !formData.kurir.trim() || !formData.harga.trim()) {
      Swal.fire('Error', 'Nama Tujuan, Kurir, dan Harga wajib diisi.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/shipping/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: editId ? 'update' : 'create',
          id: editId,
          kode_asal: formData.kode_asal,
          kode_tujuan: '',
          nama_tujuan: formData.nama_tujuan,
          kurir: formData.kurir,
          harga: formData.harga,
          estimasi: formData.estimasi,
          out_of_coverage: formData.out_of_coverage,
        }),
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan tarif ongkir');
      }

      Swal.fire('Berhasil', json.message || 'Tarif ongkir berhasil disimpan.', 'success');
      closeModal();
      await fetchTariffs(page, query);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus tarif ongkir ini?')) {
      return;
    }

    try {
      const res = await fetch('/api/shipping/tariffs', {
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
        throw new Error(json.message || 'Gagal menghapus tarif ongkir');
      }

      Swal.fire('Berhasil', json.message || 'Tarif ongkir berhasil dihapus.', 'success');
      await fetchTariffs(page, query);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    }
  };

  
  const handleTruncate = async () => {
    const result = await Swal.fire({
      title: 'Kosongkan Semua Data?',
      text: 'Anda yakin ingin menghapus SELURUH data tarif ongkir? Tindakan ini tidak dapat dibatalkan!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus Semua!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/shipping/tariffs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'truncate' })
        });
        const json = await res.json();
        if (json.success) {
          Swal.fire('Berhasil', json.message, 'success');
          await fetchTariffs(1, query);
        } else {
          Swal.fire('Error', json.message, 'error');
        }
      } catch (error: unknown) {
        Swal.fire('Error', getErrorMessage(error), 'error');
      }
    }
  };

  const handleImportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!importFile) {
      Swal.fire('Error', 'File CSV wajib dipilih.', 'error');
      return;
    }

    setIsImporting(true);

    const data = new FormData();
    data.append('action', 'import_csv');
    data.append('file_csv', importFile);
    if (truncateTable) {
      data.append('truncate_table', '1');
    }

    try {
      const res = await fetch('/api/shipping/tariffs', {
        method: 'POST',
        body: data,
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal mengimpor CSV');
      }

      Swal.fire('Berhasil', json.message || 'Import tarif ongkir berhasil.', 'success');
      setIsImportOpen(false);
      setImportFile(null);
      setTruncateTable(false);
      await fetchTariffs(1, query);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedIds.length === 0) {
      Swal.fire('Error', 'Pilih minimal satu tarif ongkir terlebih dahulu.', 'error');
      return;
    }

    if (!bulkFindText.trim()) {
      Swal.fire('Error', 'Teks yang ingin diganti wajib diisi.', 'error');
      return;
    }

    setIsBulkSubmitting(true);

    try {
      const res = await fetch('/api/shipping/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk_update_nama',
          selected_ids: selectedIds,
          find_text: bulkFindText,
          replace_text: bulkReplaceText,
        }),
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal bulk edit nama tujuan');
      }

      Swal.fire('Berhasil', json.message || 'Perubahan massal berhasil disimpan.', 'success');
      setIsBulkOpen(false);
      setBulkFindText('');
      setBulkReplaceText('');
      await fetchTariffs(page, query);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const toggleSelectedId = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  const allSelected = tarifList.length > 0 && tarifList.every((row) => selectedIds.includes(row.id));

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Penambahan Ongkir</h1>
          <p className="text-sm text-slate-400 mt-1">Kelola daftar tarif pengiriman dan rute tujuan.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={`/api/shipping/tariffs/export?format=csv${query ? `&search=${encodeURIComponent(query)}` : ''}`}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            <FileUp className="w-4 h-4" />
            Import CSV / Excel
          </button>
          <a
            href={`/api/shipping/tariffs/export?format=excel${query ? `&search=${encodeURIComponent(query)}` : ''}`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </a>
          <button
            type="button"
            onClick={() => {
              if (selectedIds.length === 0) {
                Swal.fire('Info', 'Pilih minimal satu tarif ongkir terlebih dahulu.', 'info');
                return;
              }
              setIsBulkOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            <PencilLine className="w-4 h-4" />
            Edit Teks Massal
          </button>
          
          <button
            onClick={handleTruncate}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Kosongkan Data
          </button>
          <button
            onClick={() => openModal()}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Tarif
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search);
            void fetchTariffs(1, search);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari Nama Tujuan, Kurir, atau Kode Asal..."
            className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
          />
          <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors inline-flex items-center gap-2">
            <Search className="w-4 h-4" />
            Cari
          </button>
          {query ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setQuery('');
                void fetchTariffs(1, '');
              }}
              className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              Reset
            </button>
          ) : null}
        </form>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => {
                      setSelectedIds(event.target.checked ? tarifList.map((item) => item.id) : []);
                    }}
                    className="w-4 h-4 rounded border-slate-300 accent-purple-600"
                  />
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 text-center">ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode Asal</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Tujuan (Provinsi)</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kurir</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimasi</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">OOC</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                    Memuat data...
                  </td>
                </tr>
              ) : tarifList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-slate-400 py-12">
                    Belum ada data tarif ongkir.
                  </td>
                </tr>
              ) : (
                tarifList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) => toggleSelectedId(row.id, event.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 accent-purple-600"
                      />
                    </td>
                    <td className="p-4 text-center text-slate-400 font-medium">{row.id}</td>
                    <td className="p-4 text-slate-600">{originMap[row.kode_asal || ''] || row.kode_asal || '-'}</td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-700">{row.nama_tujuan}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold">{row.kurir}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-emerald-600 font-semibold">Rp {Number(row.harga || 0).toLocaleString('id-ID')}</span>
                    </td>
                    <td className="p-4 text-slate-500 text-sm">{row.estimasi || '-'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold">{row.out_of_coverage || '-'}</span>
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

        {totalPages > 1 ? (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Menampilkan halaman <span className="font-medium text-slate-700">{page}</span> dari <span className="font-medium text-slate-700">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <button
                  type="button"
                  onClick={() => void fetchTariffs(page - 1, query)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Sebelumnya
                </button>
              ) : null}
              {page < totalPages ? (
                <button
                  type="button"
                  onClick={() => void fetchTariffs(page + 1, query)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Selanjutnya
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {isImportOpen ? (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setIsImportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-800">Import Tarif Ongkir (CSV / Excel)</h2>
              <button type="button" onClick={() => setIsImportOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className="p-5">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  Pastikan file CSV memiliki format kolom:
                  <br />
                  <strong>ID; Kode Asal; Nama Tujuan; Kurir; Harga; Estimasi; OOC</strong>
                  <br />
                  *(Kode Asal akan disimpan di kolom `kode_asal` dan `kode_tujuan`)*
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">File CSV <span className="text-red-400">*</span></label>
                  <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    required
                    onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={truncateTable}
                      onChange={(event) => setTruncateTable(event.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 accent-purple-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Kosongkan tabel tarif terlebih dahulu</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <button type="button" onClick={() => setIsImportOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isImporting} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-70">
                  {isImporting ? 'Mengimpor...' : 'Mulai Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isBulkOpen ? (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setIsBulkOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-800">Edit Teks Nama Tujuan</h2>
              <button type="button" onClick={() => setIsBulkOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkSubmit} className="p-5">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <span className="font-semibold">{selectedIds.length} data</span> akan diperbarui dengan pola ganti teks.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Teks Lama yang Ingin Diganti <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={bulkFindText}
                    onChange={(event) => setBulkFindText(event.target.value)}
                    placeholder="Contoh: KARTOHARJO"
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ganti Menjadi</label>
                  <input
                    type="text"
                    value={bulkReplaceText}
                    onChange={(event) => setBulkReplaceText(event.target.value)}
                    placeholder="Contoh: PILANGKENCENG"
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Contoh: `JAWA TIMUR,MADIUN,KARTOHARJO` jika teks `KARTOHARJO` diganti menjadi `PILANGKENCENG`, hasilnya menjadi `JAWA TIMUR,MADIUN,PILANGKENCENG`.
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <button type="button" onClick={() => setIsBulkOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isBulkSubmitting} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-70">
                  {isBulkSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Massal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-800">{editId ? 'Edit Tarif Ongkir' : 'Tambah Tarif Ongkir Baru'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kode Asal (Gudang)</label>
                  <select
                    value={formData.kode_asal}
                    onChange={(event) => setFormData((prev) => ({ ...prev, kode_asal: event.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  >
                    <option value="">Pilih Gudang Asal</option>
                    {originOptions.map((origin) => (
                      <option key={origin.value} value={origin.value}>
                        {origin.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama Tujuan (Kecamatan / Kota / Provinsi) <span className="text-red-400">*</span></label>
                  <AsyncCreatableSelect
                    cacheOptions
                    defaultOptions
                    value={selectedDestination ? { value: selectedDestination.id, label: selectedDestination.text } : null}
                    loadOptions={loadDestinationOptions}
                    onChange={(option) => {
                      const next = option ? { id: String(option.value), text: String(option.label) } : null;
                      setSelectedDestination(next);
                      setFormData((prev) => ({ ...prev, nama_tujuan: next?.text || '' }));
                    }}
                    placeholder="Pilih wilayah..."
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kurir <span className="text-red-400">*</span></label>
                  <select
                    value={formData.kurir}
                    onChange={(event) => setFormData((prev) => ({ ...prev, kurir: event.target.value }))}
                    required
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  >
                    <option value="">Pilih Kurir</option>
                    {couriers.map((courier) => (
                      <option key={courier} value={courier}>
                        {courier}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Harga (Rp) <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    value={formData.harga}
                    onChange={(event) => setFormData((prev) => ({ ...prev, harga: event.target.value }))}
                    required
                    placeholder="Contoh: 15000"
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Estimasi Waktu Sampai</label>
                  <input
                    type="text"
                    value={formData.estimasi}
                    onChange={(event) => setFormData((prev) => ({ ...prev, estimasi: event.target.value }))}
                    placeholder="Contoh: 2-3 Hari"
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">OOC (Out of Coverage)</label>
                  <input
                    type="text"
                    value={formData.out_of_coverage}
                    onChange={(event) => setFormData((prev) => ({ ...prev, out_of_coverage: event.target.value }))}
                    placeholder="Contoh: ALL atau -"
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-lg text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-70">
                  {isSubmitting ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Tarif'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
