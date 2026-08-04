'use client';

import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle, Send, AlertCircle, FileText, UserPlus } from 'lucide-react';

type LocationOption = {
  id: number;
  label: string;
};

type WarehouseOption = {
  id: number;
  warehouse_name: string;
  code?: string | null;
};

type CourierOption = {
  id: number;
  courier_name: string | null;
  service_type?: string | null;
  code?: string | null;
};

type RecommendedCourier = {
  courierName: string;
  origin: string;
  warehouseId: number;
  price: number;
  estimation: string;
  outOfCoverage: string;
  warehouseName: string;
};

function formatScalevDetails(details: unknown) {
  if (!details) {
    return '';
  }

  if (typeof details === 'string') {
    return details;
  }

  if (typeof details === 'object') {
    if ('raw' in details && typeof details.raw === 'string') {
      return details.raw;
    }

    if ('error' in details && typeof details.error === 'string') {
      return details.error;
    }

    if ('message' in details && typeof details.message === 'string') {
      return details.message;
    }

    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return '';
    }
  }

  return '';
}

export default function ScalevUbahStatusPage() {
  const [activeTab, setActiveTab] = useState<'bulk' | 'complete'>('bulk');

  const [bulkOrderIds, setBulkOrderIds] = useState('');
  const [bulkStatus, setBulkStatus] = useState('shipped');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subdistrictQuery, setSubdistrictQuery] = useState('');
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [courierId, setCourierId] = useState('');
  const [courierService, setCourierService] = useState('');
  const [recommendedCouriers, setRecommendedCouriers] = useState<RecommendedCourier[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isCompleteSubmitting, setIsCompleteSubmitting] = useState(false);

  useEffect(() => {
    const loadShippingOptions = async () => {
      try {
        const [warehouseRes, courierRes] = await Promise.all([
          fetch('/api/warehouses', { cache: 'no-store' }),
          fetch('/api/couriers', { cache: 'no-store' }),
        ]);

        const [warehouseJson, courierJson] = await Promise.all([
          warehouseRes.json(),
          courierRes.json(),
        ]);

        if (warehouseJson.success) {
          setWarehouses(warehouseJson.data || []);
        }

        if (courierJson.success) {
          setCouriers(courierJson.data || []);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void loadShippingOptions();
  }, []);

  const handleSearchLocation = async (query: string) => {
    setSubdistrictQuery(query);
    setSelectedLocationId(null);
    setRecommendedCouriers([]);

    if (query.length < 3) {
      setLocationOptions([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const res = await fetch(`/api/scalev/locations?search=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) {
        setLocationOptions(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedLocationId || !subdistrictQuery.trim()) {
        setRecommendedCouriers([]);
        return;
      }

      setIsLoadingRecommendations(true);
      try {
        const res = await fetch(`/api/shipping/rates?subdistrict=${encodeURIComponent(subdistrictQuery)}`);
        const json = await res.json();

        if (json.status !== 'success' || !json.origins) {
          setRecommendedCouriers([]);
          return;
        }

        const nextRecommendations: RecommendedCourier[] = [];

        Object.entries(json.origins).forEach(([origin, data]) => {
          const typedData = data as {
            warehouse_ids?: number[];
            rates?: Record<string, { price?: number; estimation?: string; out_of_coverage?: string }>;
          };

          const warehouseIds = typedData.warehouse_ids || [];
          const firstWarehouseId = warehouseIds[0];
          const warehouse = warehouses.find((item) => item.id === firstWarehouseId);

          Object.entries(typedData.rates || {}).forEach(([courierName, rate]) => {
            if (!rate.price || rate.price <= 0 || !firstWarehouseId) {
              return;
            }

            nextRecommendations.push({
              courierName,
              origin,
              warehouseId: firstWarehouseId,
              price: rate.price,
              estimation: rate.estimation || '',
              outOfCoverage: rate.out_of_coverage || '',
              warehouseName: warehouse?.warehouse_name || `Gudang ${firstWarehouseId}`,
            });
          });
        });

        nextRecommendations.sort((a, b) => a.price - b.price);
        setRecommendedCouriers(nextRecommendations.slice(0, 5));
      } catch (error) {
        console.error(error);
        setRecommendedCouriers([]);
      } finally {
        setIsLoadingRecommendations(false);
      }
    };

    void loadRecommendations();
  }, [selectedLocationId, subdistrictQuery, warehouses]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bulkOrderIds.trim()) {
      Swal.fire('Error', 'Order ID wajib diisi.', 'error');
      return;
    }

    const idList = bulkOrderIds
      .split('\n')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (idList.length === 0) {
      Swal.fire('Error', 'Masukkan minimal 1 Order ID.', 'error');
      return;
    }

    setIsBulkSubmitting(true);
    try {
      const res = await fetch('/api/scalev/change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: idList,
          status: bulkStatus,
        }),
      });
      const json = await res.json();

      if (json.success) {
        Swal.fire('Berhasil', `Berhasil mengubah status untuk ${idList.length} pesanan.`, 'success');
        setBulkOrderIds('');
      } else {
        const detailText = formatScalevDetails(json.details);
        await Swal.fire({
          title: 'Error',
          html: `
            <p style="color:#475569;font-size:14px;margin-bottom:${detailText ? '12px' : '0'}">${json.message || 'Terjadi kesalahan saat menghubungi API Scalev'}</p>
            ${detailText ? `<pre style="white-space:pre-wrap;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;padding:12px;border-radius:10px;font-size:12px;max-height:220px;overflow:auto;">${detailText}</pre>` : ''}
          `,
          icon: 'error',
          confirmButtonText: 'Tutup',
          confirmButtonColor: '#6d28d9',
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal mengubah status';
      Swal.fire('Error', message, 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderId.trim() || !customerName.trim() || !customerPhone.trim() || !address.trim() || !selectedLocationId || !paymentMethod) {
      Swal.fire('Error', 'Mohon lengkapi semua field yang diwajibkan, termasuk kecamatan dan metode pembayaran.', 'error');
      return;
    }

    if (address.trim().length < 10) {
      Swal.fire('Error', 'Alamat terlalu pendek. Mohon masukkan detail alamat minimal 10 karakter.', 'error');
      return;
    }

    setIsCompleteSubmitting(true);
    try {
      const res = await fetch('/api/scalev/complete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId.trim(),
          customer_name: customerName,
          customer_phone: customerPhone,
          address,
          location_id: selectedLocationId,
          payment_method: paymentMethod,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const savedOrderId = orderId.trim();

        setOrderId('');
        setCustomerName('');
        setCustomerPhone('');
        setAddress('');
        setSubdistrictQuery('');
        setSelectedLocationId(null);
        setLocationOptions([]);
        setWarehouseId('');
        setCourierId('');
        setCourierService('');
        setRecommendedCouriers([]);

        const isPendingCompleted = json.pendingSyncStatus === 'completed';

        Swal.fire({
          title: isPendingCompleted ? 'Berhasil Sampai Pending' : 'Data Berhasil Dilengkapi',
          html: isPendingCompleted
            ? `
              <p style="color:#475569;font-size:14px;margin-bottom:16px">
                Data pesanan <strong>${savedOrderId}</strong> berhasil diupdate ke Scalev dan tahap 2 berhasil mengubah status ke <strong>Pending</strong>.
              </p>
            `
            : `
              <p style="color:#475569;font-size:14px;margin-bottom:12px">
                Data pesanan <strong>${savedOrderId}</strong> berhasil diupdate ke Scalev, tetapi tahap 2 untuk ubah ke <strong>Pending</strong> belum berhasil.
              </p>
              <p style="color:#64748b;font-size:13px;margin-bottom:16px">
                Order sudah masuk antrean retry. Kalau status masih belum berubah, gunakan rekomendasi kurir di form ini lalu isi manual di dashboard Scalev sebelum klik <strong>Simpan</strong>.
              </p>
              <a
                href="https://app.scalev.id/orders/${savedOrderId}"
                target="_blank"
                rel="noopener noreferrer"
                style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-top:4px;"
              >
                Buka Order di Scalev Dashboard
              </a>
            `,
          icon: isPendingCompleted ? 'success' : 'warning',
          confirmButtonText: 'Tutup',
          confirmButtonColor: '#6d28d9',
        });
      } else {
        const detailText = formatScalevDetails(json.details);
        await Swal.fire({
          title: 'Error',
          html: `
            <p style="color:#475569;font-size:14px;margin-bottom:${detailText ? '12px' : '0'}">${json.message || 'Terjadi kesalahan saat menghubungi API Scalev'}</p>
            ${detailText ? `<pre style="white-space:pre-wrap;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;padding:12px;border-radius:10px;font-size:12px;max-height:220px;overflow:auto;">${detailText}</pre>` : ''}
          `,
          icon: 'error',
          confirmButtonText: 'Tutup',
          confirmButtonColor: '#6d28d9',
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal memproses pesanan';
      Swal.fire('Error', message, 'error');
    } finally {
      setIsCompleteSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col mb-6 gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Manajemen Status Pesanan Scalev</h1>
        <p className="text-sm text-slate-400">Pilih mode untuk mengubah status pesanan massal atau melengkapi order berstatus Created.</p>
      </div>

      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Cara Ubah Created -&gt; Pending</p>
          <p className="text-xs text-amber-700 mt-1">1. Isi form di tab <strong>Lengkapi Data Pesanan</strong> agar alamat dan pembayaran masuk ke Scalev. 2. Klik <strong>Buka di Scalev</strong>, lalu tekan <strong>Simpan</strong> sekali di dashboard Scalev. Transisi Created ke Pending belum bisa dipaksa langsung dari API publik.</p>
        </div>
        <a
          href="https://app.scalev.id/orders"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Buka Scalev
        </a>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('bulk')}
          className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'bulk' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" />
          Ubah Status Massal
        </button>
        <button
          onClick={() => setActiveTab('complete')}
          className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'complete' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <UserPlus className="w-4 h-4" />
          Lengkapi Pesanan (Created {'->'} Pending)
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-w-2xl">
        {activeTab === 'bulk' && (
          <>
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-600" />
                Form Ubah Status Massal
              </h2>
            </div>
            <div className="p-5">
              <form onSubmit={handleBulkSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Scalev Order IDs <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">Masukkan Order ID Scalev satu per baris. Jangan gunakan mode ini untuk order yang masih berstatus Created.</p>
                  <textarea
                    rows={6}
                    required
                    placeholder="Cth:&#10;260728EPAURVB&#10;ORD-XXXXX-2"
                    value={bulkOrderIds}
                    onChange={(e) => setBulkOrderIds(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Status Baru</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing (Sedang Diproses)</option>
                    <option value="shipped">Shipped (Dikirim)</option>
                    <option value="completed">Completed (Selesai)</option>
                    <option value="cancelled">Cancelled (Dibatalkan)</option>
                    <option value="returned">Returned (Dikembalikan / RTS)</option>
                  </select>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-800">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                  <p>Pastikan API Key Scalev yang aktif sudah benar. Jika order masih berstatus Created, gunakan tab <strong>Lengkapi Pesanan</strong> dulu.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isBulkSubmitting}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isBulkSubmitting ? 'Memproses...' : 'Ubah Status di Scalev'}
                    {!isBulkSubmitting && <CheckCircle className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {activeTab === 'complete' && (
          <>
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" />
                Lengkapi Pesanan untuk Pending
              </h2>
            </div>
            <div className="p-5">
              <form onSubmit={handleCompleteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Order ID Scalev <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Cth: 260728EPAURVB"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 font-mono"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Nama Pelanggan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama lengkap..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Nomor WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="08123xxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Alamat Lengkap <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    placeholder="Jalan, RT/RW, detail alamat..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Kecamatan / Subdistrict <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={!selectedLocationId}
                      placeholder="Ketik nama kecamatan..."
                      value={subdistrictQuery}
                      onChange={(e) => handleSearchLocation(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    />
                    {isSearchingLocation && (
                      <div className="absolute right-3 top-9 text-xs text-slate-400">Mencari...</div>
                    )}
                    {locationOptions.length > 0 && !selectedLocationId && (
                      <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {locationOptions.map((loc) => (
                          <li
                            key={loc.id}
                            onClick={() => {
                              setSelectedLocationId(loc.id);
                              setSubdistrictQuery(loc.label);
                              setLocationOptions([]);
                            }}
                            className="px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                          >
                            {loc.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Metode Pembayaran <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    >
                      <option value="cod">COD (Bayar di Tempat)</option>
                      <option value="bank_transfer">Bank Transfer (Manual)</option>
                      <option value="qris">QRIS</option>
                      <option value="va_bca">VA BCA</option>
                      <option value="va_bni">VA BNI</option>
                      <option value="va_bri">VA BRI</option>
                      <option value="gopay">GoPay</option>
                      <option value="ovo">OVO</option>
                      <option value="dana">DANA</option>
                      <option value="shopeepay">ShopeePay</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Rekomendasi Gudang & Kurir</p>
                      <p className="mt-1 text-xs text-slate-500">Saran ini diambil dari logika ongkir lokal project. Gunakan sebagai acuan saat isi manual di dashboard Scalev.</p>
                    </div>
                    {isLoadingRecommendations ? <span className="text-xs font-semibold text-slate-400">Mencari...</span> : null}
                  </div>

                  {recommendedCouriers.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {recommendedCouriers.map((item, index) => (
                        <button
                          key={`${item.courierName}-${item.origin}-${item.warehouseId}-${index}`}
                          type="button"
                          onClick={() => {
                            setWarehouseId(String(item.warehouseId));
                            const matchedCourier = couriers.find((courier) => (courier.courier_name || '').toUpperCase() === item.courierName.toUpperCase());
                            setCourierId(matchedCourier ? String(matchedCourier.id) : '');
                            setCourierService(item.estimation || 'Reguler');
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-purple-300 hover:bg-purple-50/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold uppercase text-slate-800">{item.courierName}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.warehouseName} • Origin {item.origin.toUpperCase()}</p>
                              <p className="mt-1 text-xs text-slate-500">Estimasi: {item.estimation || 'Reguler'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-purple-600">Rp {item.price.toLocaleString('id-ID')}</p>
                              <p className="mt-1 text-[11px] font-semibold text-slate-400">{item.outOfCoverage || 'Tersedia'}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">Belum ada rekomendasi. Pilih kecamatan/subdistrict yang valid dulu.</p>
                  )}

                  {warehouseId || courierId || courierService ? (
                    <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-700">
                      <p className="font-semibold">Draft rekomendasi untuk dashboard Scalev</p>
                      <p className="mt-1">Gudang: {warehouses.find((item) => String(item.id) === warehouseId)?.warehouse_name || '-'}</p>
                      <p className="mt-1">Kurir: {couriers.find((item) => String(item.id) === courierId)?.courier_name || '-'}</p>
                      <p className="mt-1">Layanan: {courierService || '-'}</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isCompleteSubmitting}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isCompleteSubmitting ? 'Memproses...' : 'Simpan Data untuk Pending'}
                    {!isCompleteSubmitting && <CheckCircle className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
