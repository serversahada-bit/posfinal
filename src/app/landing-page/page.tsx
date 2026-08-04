'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import CustomDomainModal from '@/components/CustomDomainModal';

type LandingPageRow = {
  name: string;
  shop: string;
  pinned: boolean;
  slug: string;
  rawSlug: string;
  mode: string;
  tags: string[];
  domain: string | null;
  domain_status: string;
  status: string;
  id: string;
  cf_hostname_id?: string | null;
  cf_ownership_name?: string | null;
  cf_ownership_value?: string | null;
  cf_ssl_name?: string | null;
  cf_ssl_value?: string | null;
};

export default function LandingPage() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dbData, setDbData] = useState<LandingPageRow[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [baseDomain, setBaseDomain] = useState('');
  const [isSavingDomain, setIsSavingDomain] = useState(false);
  const [showCustomDomainModal, setShowCustomDomainModal] = useState(false);
  const [selectedLp, setSelectedLp] = useState<LandingPageRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Published' | 'Draft'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/landing-pages');
      const json = await res.json();

      if (json.data) {
        const formatted = json.data.map((item: any) => ({
          name: item.title,
          shop: `Slug: /lp/${item.slug}`,
          pinned: item.status === 'Published',
          slug: `/lp/${item.slug}`,
          rawSlug: item.slug,
          mode: 'HTML Builder',
          tags: [item.status],
          domain: item.domain || null,
          domain_status: item.domain_status || 'inactive',
          status: item.status,
          id: String(item.id),
          cf_hostname_id: item.cf_hostname_id,
          cf_ownership_name: item.cf_ownership_name,
          cf_ownership_value: item.cf_ownership_value,
          cf_ssl_name: item.cf_ssl_name,
          cf_ssl_value: item.cf_ssl_value,
        }));

        setDbData(formatted);
      } else {
        setDbData([]);
      }
    } catch (err) {
      console.error('Error fetching LP data', err);
      setDbData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    fetch('/api/settings/base-domain')
      .then((res) => res.json())
      .then((res) => {
        if (res.status === 'success' && res.data) {
          setBaseDomain(res.data);
        }
      })
      .catch((err) => console.error('Error fetching base domain', err));
  }, []);

  useEffect(() => {
    const closeMenus = () => {
      setOpenMenuId(null);
      setIsDropdownOpen(false);
    };

    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  const handleDelete = async (rawSlug: string, name: string) => {
    setOpenMenuId(null);

    const result = await Swal.fire({
      title: 'Hapus Landing Page?',
      text: `"${name}" akan dihapus permanen dari database.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
    });

    if (result.isConfirmed) {
      await fetch(`/api/landing-pages/${rawSlug}`, { method: 'DELETE' });
      Swal.fire('Dihapus!', 'Landing page berhasil dihapus.', 'success');
      fetchData();
    }
  };

  const handleSaveDomain = async () => {
    setIsSavingDomain(true);

    try {
      const res = await fetch('/api/settings/base-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: baseDomain }),
      });
      const json = await res.json();

      if (json.status === 'success') {
        Swal.fire('Berhasil', 'Base Domain berhasil disimpan', 'success');
        setShowDomainModal(false);
      } else {
        Swal.fire('Error', json.message || 'Gagal menyimpan domain', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSavingDomain(false);
    }
  };

  const filteredData = useMemo(() => {
    return dbData.filter((row) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        row.name.toLowerCase().includes(query) ||
        row.rawSlug.toLowerCase().includes(query) ||
        (row.domain || '').toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [dbData, searchQuery, statusFilter]);

  const publishedCount = dbData.filter((item) => item.status === 'Published').length;
  const draftCount = dbData.filter((item) => item.status !== 'Published').length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf4ff_0%,_#f8fafc_32%,_#eef2ff_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_80px_-32px_rgba(88,28,135,0.35)] backdrop-blur">
          <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,_rgba(88,28,135,0.06),_rgba(14,165,233,0.08))] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-700">
                  Landing Page Manager
                </span>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Kelola landing page dengan tampilan yang lebih rapi dan cepat dipakai.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  Semua kontrol utama ada di satu tempat: buat halaman baru, atur domain, cari data lebih cepat, dan
                  langsung buka halaman yang aktif.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[360px]">
                <StatCard label="Total Page" value={dbData.length} tone="slate" />
                <StatCard label="Published" value={publishedCount} tone="emerald" />
                <StatCard label="Draft" value={draftCount} tone="amber" />
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => setShowDomainModal(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  <Settings size={16} />
                  Setting Domain
                </button>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen((prev) => !prev);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Plus size={16} />
                    Create Landing Page
                  </button>

                  {isDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80"
                    >
                      <LinkItem href="/landing-page/builder" label="Sales Page" accent />
                      <LinkItem href="/landing-page/builder" label="Checkout Page" />
                      <LinkItem href="/landing-page/builder" label="HTML Sales Page" badge="New" />
                      <LinkItem href="/landing-page/builder" label="HTML Checkout Page" badge="New" />
                      <LinkItem href="/landing-page/builder" label="Blank Page" />
                      <LinkItem href="/landing-page/builder" label="Import Sesama Scalev" noBorder />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama, slug, atau domain..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Filter size={15} />
                    Semua
                  </button>
                  <button
                    onClick={() => setStatusFilter('Published')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      statusFilter === 'Published' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Published
                  </button>
                  <button
                    onClick={() => setStatusFilter('Draft')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      statusFilter === 'Draft' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Draft
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1024px] border-collapse text-left">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nama Landing Page</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug / URL</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Domains</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={index} className="border-b border-slate-100">
                          <td className="px-6 py-5" colSpan={7}>
                            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                          </td>
                        </tr>
                      ))
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="mx-auto max-w-md">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                              <Search size={22} />
                            </div>
                            <h2 className="mt-4 text-lg font-semibold text-slate-900">Landing page tidak ditemukan</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              Coba ubah kata kunci pencarian atau filter status supaya data yang dicari lebih mudah muncul.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row) => {
                        const fullDomain = baseDomain && row.rawSlug ? `${row.rawSlug}.${baseDomain}` : row.domain;
                        const linkHref = fullDomain ? `https://${fullDomain}` : row.slug;

                        return (
                          <tr key={row.id} className="border-b border-slate-100 transition hover:bg-slate-50/80">
                            <td className="px-6 py-5 align-top">
                              <div className="max-w-[260px]">
                                <div className="flex items-center gap-2">
                                  <a
                                    href={linkHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-slate-900 transition hover:text-fuchsia-700"
                                  >
                                    {row.name}
                                  </a>
                                  {row.pinned && (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                                      Live
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">{row.shop}</div>
                              </div>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <a
                                href={linkHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-sm text-sky-700 transition hover:text-sky-900 hover:underline"
                              >
                                {linkHref}
                              </a>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {row.mode}
                              </span>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <div className="flex flex-wrap gap-2">
                                {row.tags.map((tag) => (
                                  <span
                                    key={`${row.id}-${tag}`}
                                    className="inline-flex rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-700"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="px-6 py-5 align-top">
                              {fullDomain ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-700">{fullDomain}</span>
                                  </div>
                                  <DomainStatus status={row.domain_status} />
                                </div>
                              ) : (
                                <span className="text-xs italic text-slate-400">Belum diatur</span>
                              )}
                            </td>

                            <td className="px-6 py-5 align-top">
                              <StatusBadge status={row.status} />
                            </td>

                            <td className="px-6 py-5 align-top">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => router.push(`/landing-page/builder?edit=${row.rawSlug}`)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-700"
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>

                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId((prev) => (prev === row.id ? null : row.id));
                                    }}
                                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <MoreHorizontal size={18} />
                                  </button>

                                  {openMenuId === row.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80"
                                    >
                                      <ActionButton
                                        icon={<Globe size={14} />}
                                        label="Domain Pribadi"
                                        onClick={() => {
                                          setSelectedLp(row);
                                          setShowCustomDomainModal(true);
                                          setOpenMenuId(null);
                                        }}
                                      />
                                      <ActionLink icon={<ExternalLink size={14} />} label="Lihat Page" href={row.slug} />
                                      <ActionButton
                                        icon={<Trash2 size={14} />}
                                        label="Hapus"
                                        danger
                                        onClick={() => handleDelete(row.rawSlug, row.name)}
                                      />
                                    </div>
                                  )}
                                </div>
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
          </div>
        </section>
      </div>

      {showDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl shadow-slate-900/20">
            <h2 className="text-xl font-bold text-slate-900">Setting Base Domain</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Masukkan domain utama Anda, misalnya <strong>domainanda.com</strong>. Pastikan wildcard A record
              (<strong>*</strong>) sudah diarahkan ke IP VPS ini.
            </p>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Base Domain <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={baseDomain}
                onChange={(e) => setBaseDomain(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                placeholder="contoh: domainanda.com"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDomainModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDomain}
                disabled={isSavingDomain}
                className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDomain ? 'Menyimpan...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomDomainModal
        isOpen={showCustomDomainModal}
        onClose={() => setShowCustomDomainModal(false)}
        landingPage={selectedLp}
        onSuccess={fetchData}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'amber';
}) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function LinkItem({
  href,
  label,
  badge,
  accent = false,
  noBorder = false,
}: {
  href: string;
  label: string;
  badge?: string;
  accent?: boolean;
  noBorder?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3 text-sm font-medium transition hover:bg-slate-50 ${
        accent ? 'text-fuchsia-700' : 'text-slate-700'
      } ${noBorder ? '' : 'border-b border-slate-100'}`}
    >
      <span>{label}</span>
      {badge ? <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">{badge}</span> : null}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPublished = status === 'Published';

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {status}
    </span>
  );
}

function DomainStatus({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={12} />
        Aktif
      </span>
    );
  }

  if (status === 'pending') {
    return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Pending</span>;
  }

  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Inactive</span>;
}

function ActionButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium transition ${
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50 hover:text-fuchsia-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-fuchsia-700"
    >
      {icon}
      {label}
    </a>
  );
}
