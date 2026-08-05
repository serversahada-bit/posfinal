'use client';

import { useEffect, useState } from 'react';
import { Activity, Loader2, Package2, ShoppingBag, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DashboardChartPoint = {
  date: string;
  total_orders: number;
  total_amount: number;
};

type RecentOrder = {
  order_code: string;
  customer_name: string;
  total_payment: number;
  order_status: string;
  created_at: string;
  ready_at: string | null;
  source_label: string;
};

type DashboardData = {
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  readyToShipOrders: number;
  readyToShipAmount: number;
  readyToShipChart: DashboardChartPoint[];
  recentOrders: RecentOrder[];
};

type DashboardResponse = {
  success: boolean;
  message?: string;
  data?: DashboardData;
};

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  ready_to_ship: 'Ready To Ship',
  shipped: 'Shipped',
  completed: 'Completed',
  rts: 'RTS',
  problem: 'Problem',
  cancelled: 'Cancel',
};

const statusClasses: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  ready_to_ship: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  shipped: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-teal-50 text-teal-700 border-teal-200',
  rts: 'bg-orange-50 text-orange-700 border-orange-200',
  problem: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const sourceClasses: Record<string, string> = {
  CRM: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  RESEND: 'bg-orange-50 text-orange-700 border-orange-200',
  CSO: 'bg-blue-50 text-blue-700 border-blue-200',
  'CSO AKUISISI': 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const formatCompactCurrency = (value: number) => {
  if (!value) return 'Rp0';
  return `Rp${compactCurrencyFormatter.format(value)}`;
};

const formatChartDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
};

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
};

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/dashboard', { cache: 'no-store' });
        const json: DashboardResponse = await response.json();

        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.message || 'Gagal memuat dashboard');
        }

        if (!active) {
          return;
        }

        setDashboard(json.data);
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : 'Terjadi kesalahan');
        setDashboard(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchDashboard();

    return () => {
      active = false;
    };
  }, []);

  const summaryCards = [
    {
      title: 'Nominal Ready To Ship',
      value: formatCurrency(dashboard?.readyToShipAmount || 0),
      note: `${dashboard?.readyToShipOrders || 0} order siap kirim`,
      icon: Activity,
      accent: 'from-emerald-500/20 via-teal-500/10 to-white',
      iconColor: '#047857',
    },
    {
      title: 'Total Pesanan',
      value: String(dashboard?.totalOrders || 0),
      note: 'Data dari tabel orders',
      icon: ShoppingBag,
      accent: 'from-indigo-500/20 via-sky-500/10 to-white',
      iconColor: '#3730a3',
    },
    {
      title: 'Total Customer',
      value: String(dashboard?.totalCustomers || 0),
      note: 'Pelanggan tersimpan',
      icon: Users,
      accent: 'from-fuchsia-500/20 via-pink-500/10 to-white',
      iconColor: '#a21caf',
    },
    {
      title: 'Total Produk',
      value: String(dashboard?.totalProducts || 0),
      note: 'Produk aktif di database',
      icon: Package2,
      accent: 'from-amber-500/20 via-orange-500/10 to-white',
      iconColor: '#c2410c',
    },
  ];

  return (
    <section className="dashboard-layout">
      <div
        className="panel hero-panel"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(16, 185, 129, 0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.14), transparent 26%), linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderColor: '#dbeafe',
        }}
      >
        <p className="section-eyebrow">Dashboard</p>
        <h1 className="hero-panel__title" style={{ fontSize: '36px' }}>
          Pantau uang masuk dari order `ready_to_ship`.
        </h1>
        <p className="hero-panel__text" style={{ maxWidth: '760px' }}>
          Grafik ini menghitung nominal dari tabel `orders` saat status pesanan ada di `ready_to_ship`, lalu dikelompokkan per hari berdasarkan waktu proses terakhir order.
        </p>
      </div>

      {loading ? (
        <div className="panel" style={{ minHeight: '320px', display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
            <Loader2 size={20} className="animate-spin" />
            <span>Memuat dashboard...</span>
          </div>
        </div>
      ) : error ? (
        <div className="panel" style={{ borderColor: '#fecaca', background: '#fff1f2' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#be123c' }}>Dashboard gagal dimuat</p>
          <p style={{ margin: '8px 0 0', color: '#9f1239' }}>{error}</p>
        </div>
      ) : (
        <>
          <div className="page-grid page-grid--3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className="panel info-card"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: `linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.98) 35%, transparent 100%), linear-gradient(135deg, var(--tw-gradient-stops))`,
                  }}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${card.accent}`}
                    style={{ pointerEvents: 'none', opacity: 1 }}
                  />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '14px',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(255,255,255,0.92)',
                        border: '1px solid rgba(226,232,240,0.9)',
                        marginBottom: '18px',
                      }}
                    >
                      <Icon size={20} color={card.iconColor} />
                    </div>
                    <p className="info-card__title" style={{ marginTop: 0, marginBottom: '6px' }}>
                      {card.title}
                    </p>
                    <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{card.value}</p>
                    <p className="info-card__text" style={{ marginBottom: 0, marginTop: '10px' }}>
                      {card.note}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="page-grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)' }}>
            <div className="panel" style={{ minHeight: '430px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div>
                  <p className="section-eyebrow" style={{ marginBottom: '6px' }}>Chart Ready To Ship</p>
                  <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Uang masuk per hari</h2>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    minWidth: '220px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Total Ready To Ship
                  </p>
                  <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 800, color: '#065f46' }}>
                    {formatCurrency(dashboard?.readyToShipAmount || 0)}
                  </p>
                </div>
              </div>

              {dashboard?.readyToShipChart.length ? (
                <div style={{ width: '100%', height: '320px' }}>
                  <ResponsiveContainer>
                    <AreaChart data={dashboard.readyToShipChart} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="readyToShipFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatChartDate}
                        stroke="#64748b"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        stroke="#64748b"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        tickFormatter={(value: number) => formatCompactCurrency(value)}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'total_amount' && typeof value === 'number'
                            ? formatCurrency(value)
                            : value ?? '-',
                          name === 'total_amount' ? 'Nominal' : 'Jumlah Order',
                        ]}
                        labelFormatter={(value) => `Tanggal ${formatChartDate(String(value))}`}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #dbeafe',
                          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total_amount"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#readyToShipFill)"
                        activeDot={{ r: 6, fill: '#047857' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div
                  style={{
                    minHeight: '320px',
                    borderRadius: '20px',
                    border: '1px dashed #cbd5e1',
                    background: '#f8fafc',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#64748b',
                    textAlign: 'center',
                    padding: '24px',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#334155' }}>Belum ada data `ready_to_ship`</p>
                    <p style={{ margin: '8px 0 0' }}>Begitu ada order siap kirim, grafik nominal akan muncul otomatis di sini.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="panel">
              <div style={{ marginBottom: '20px' }}>
                <p className="section-eyebrow" style={{ marginBottom: '6px' }}>Ringkasan Cepat</p>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Order terbaru</h2>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {dashboard?.recentOrders.map((order) => (
                  <div
                    key={order.order_code}
                    style={{
                      padding: '16px',
                      borderRadius: '18px',
                      border: '1px solid #e2e8f0',
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>{order.order_code}</p>
                        <p style={{ margin: '6px 0 0', color: '#475569', fontWeight: 600 }}>{order.customer_name || '-'}</p>
                      </div>
                      <span
                        style={{ padding: '6px 10px', borderRadius: '999px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 800 }}
                      >
                        {order.source_label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                      <span
                        className={statusClasses[order.order_status] || 'bg-slate-50 text-slate-700 border-slate-200'}
                        style={{ padding: '6px 10px', borderRadius: '999px', borderWidth: '1px', borderStyle: 'solid', fontSize: '11px', fontWeight: 800 }}
                      >
                        {statusLabels[order.order_status] || order.order_status}
                      </span>
                      <span
                        className={sourceClasses[order.source_label] || 'bg-slate-50 text-slate-700 border-slate-200'}
                        style={{ padding: '6px 10px', borderRadius: '999px', borderWidth: '1px', borderStyle: 'solid', fontSize: '11px', fontWeight: 800 }}
                      >
                        {formatCurrency(order.total_payment)}
                      </span>
                    </div>

                    <div style={{ marginTop: '12px', display: 'grid', gap: '6px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        Dibuat: <span style={{ fontWeight: 700, color: '#334155' }}>{formatDateTime(order.created_at)}</span>
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        Waktu proses: <span style={{ fontWeight: 700, color: '#334155' }}>{formatDateTime(order.ready_at)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

