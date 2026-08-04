'use client';

import React, { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';

type ActivityLogItem = {
  id: number;
  action: string;
  target: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  user_name: string | null;
};

type LogsResponse = {
  success: boolean;
  message?: string;
  data?: {
    logs: ActivityLogItem[];
    pagination: {
      page: number;
      limit: number;
      totalRows: number;
      totalPages: number;
    };
  };
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState('');

  async function fetchLogs(currentPage: number, currentSearch: string) {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      if (currentSearch.trim()) {
        params.set('search', currentSearch.trim());
      }

      const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
      const json: LogsResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data log aktivitas');
      }

      setLogs(json.data.logs);
      setTotalPages(json.data.pagination.totalPages);
      setTotalRows(json.data.pagination.totalRows);
    } catch (error: unknown) {
      setLogs([]);
      setTotalPages(1);
      setTotalRows(0);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLogs(page, searchQuery);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [page, searchQuery]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput);
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Log Aktivitas</h1>
          <p className="mt-1 text-sm text-slate-400">Pantau seluruh aktivitas pengguna di dalam sistem.</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari Nama Pengguna, Aksi, Target, atau Detail..."
              className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700">
            Cari
          </button>
          {searchQuery ? (
            <button type="button" onClick={handleReset} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200">
              Reset
            </button>
          ) : null}
        </form>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="w-12 p-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">ID</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Waktu</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Pengguna</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Target (Modul)</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Detail Aktivitas</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Alamat IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                    Memuat data...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-red-500">
                    {error}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    Belum ada log aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-4 text-center font-medium text-slate-400">{log.id}</td>
                    <td className="p-4">
                      <span className="text-sm text-slate-500">{formatDate(log.created_at)}</span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-700">{log.user_name ?? 'Sistem'}</p>
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 border border-blue-100">{log.action}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-600">{log.target ?? '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-500">{log.details ?? '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs text-slate-400">{log.ip_address ?? '-'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <div className="text-sm text-slate-500">
              Menampilkan halaman <span className="font-medium text-slate-700">{page}</span> dari{' '}
              <span className="font-medium text-slate-700">{totalPages}</span>
              {totalRows > 0 ? <span className="ml-2 text-slate-400">({totalRows} data)</span> : null}
            </div>
            <div className="flex items-center gap-1">
              {page > 1 ? (
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Sebelumnya
                </button>
              ) : null}
              {page < totalPages ? (
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Selanjutnya
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
