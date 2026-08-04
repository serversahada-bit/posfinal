'use client';

import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Check, Loader2, Truck } from 'lucide-react';

type WeightSettings = {
  default_item_weight_gram: number;
  base_weight_gram: number;
  extra_weight_step_gram: number;
  rounding_tolerance_gram: number;
};

type CourierRule = {
  id: number;
  courier_name: string | null;
  code: string | null;
  base_weight_gram: number;
  extra_weight_step_gram: number;
  rounding_tolerance_gram: number;
};

type SettingsResponse = {
  success: boolean;
  message?: string;
  data?: {
    settings: WeightSettings;
    couriers: CourierRule[];
  };
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

const calculateShippingMultiplier = (totalWeightGrams: number, settings: WeightSettings) => {
  const baseWeight = Math.max(Number(settings.base_weight_gram) || 1000, 1);
  const extraStep = Math.max(Number(settings.extra_weight_step_gram) || 1000, 1);
  const tolerance = Math.max(Number(settings.rounding_tolerance_gram) || 0, 0);
  const total = Math.max(Number(totalWeightGrams) || 0, 0);

  if (total <= baseWeight) {
    return 1;
  }

  const excessWeight = total - baseWeight;
  const fullSteps = Math.floor(excessWeight / extraStep);
  const remainder = excessWeight % extraStep;

  return 1 + fullSteps + (remainder > tolerance ? 1 : 0);
};

export default function PengaturanOngkirPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WeightSettings>({
    default_item_weight_gram: 200,
    base_weight_gram: 1000,
    extra_weight_step_gram: 1000,
    rounding_tolerance_gram: 300,
  });
  const [couriers, setCouriers] = useState<CourierRule[]>([]);
  const [simWeight, setSimWeight] = useState('1000');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await fetch('/api/shipping/settings');
        const json: SettingsResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (!json.success || !json.data) {
          throw new Error(json.message || 'Gagal mengambil pengaturan ongkir');
        }

        setSettings(json.data.settings);
        setCouriers(json.data.couriers);
        setSimWeight(String(json.data.settings.base_weight_gram));
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

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSettingsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setSettings((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  };

  const handleCourierChange = (id: number, field: keyof Pick<CourierRule, 'base_weight_gram' | 'extra_weight_step_gram' | 'rounding_tolerance_gram'>, value: string) => {
    setCouriers((prev) =>
      prev.map((courier) =>
        courier.id === id
          ? {
              ...courier,
              [field]: Number(value),
            }
          : courier
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/shipping/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings,
          courier_rules: couriers,
        }),
      });

      const json: SettingsResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal menyimpan pengaturan ongkir');
      }

      setSettings(json.data.settings);
      setCouriers(json.data.couriers);
      Swal.fire('Berhasil', 'Pengaturan estimasi ongkir berhasil disimpan.', 'success');
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const simWeightValue = Math.max(Number(simWeight) || 0, 0);
  const multiplier = calculateShippingMultiplier(simWeightValue, settings);
  const baseWeight = Math.max(Number(settings.base_weight_gram) || 1000, 1);

  return (
    <div className="h-full flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pengaturan Ongkir</h1>
          <p className="text-sm text-slate-500 mt-1">Atur estimasi ongkir saat total bobot pesanan melebihi 1 kg.</p>
        </div>
        <a
          href="/biaya_ongkir"
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2"
        >
          <Truck className="w-4 h-4" />
          Lihat Biaya Ongkir
        </a>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex items-center justify-center text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memuat pengaturan...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-800">Aturan Perhitungan</h2>
              <p className="text-sm text-slate-500 mt-1">
                Tarif di `Penambahan Ongkir` dipakai sebagai tarif dasar. Halaman ini menentukan kapan tarif dasar tersebut dikalikan saat bobot bertambah.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Berat Default per Item (gram)</label>
                  <input
                    type="number"
                    min="0"
                    name="default_item_weight_gram"
                    value={settings.default_item_weight_gram}
                    onChange={handleSettingsChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Dipakai jika produk atau hadiah belum punya `weight_gram`.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Batas Tarif Dasar (gram)</label>
                  <input
                    type="number"
                    min="1"
                    name="base_weight_gram"
                    value={settings.base_weight_gram}
                    onChange={handleSettingsChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Umumnya `1000` untuk tarif 1 kg pertama.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kelipatan Tambahan Bobot (gram)</label>
                  <input
                    type="number"
                    min="1"
                    name="extra_weight_step_gram"
                    value={settings.extra_weight_step_gram}
                    onChange={handleSettingsChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Setiap kelipatan ini akan menambah 1x tarif ongkir.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Toleransi Pembulatan (gram)</label>
                  <input
                    type="number"
                    min="0"
                    name="rounding_tolerance_gram"
                    value={settings.rounding_tolerance_gram}
                    onChange={handleSettingsChange}
                    className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Jika sisa bobot melebihi angka ini, ongkir dibulatkan naik.</p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Rumus saat ini: bobot sampai batas dasar dihitung `1x`. Setelah itu, setiap tambahan bobot akan menambah kelipatan ongkir, lalu sisa di atas toleransi dibulatkan naik.
              </div>

              <div className="pt-3">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Aturan Per Ekspedisi</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left p-3 font-semibold">Ekspedisi</th>
                        <th className="text-left p-3 font-semibold">Kode</th>
                        <th className="text-left p-3 font-semibold">Batas Dasar</th>
                        <th className="text-left p-3 font-semibold">Kelipatan</th>
                        <th className="text-left p-3 font-semibold">Pengurangan / Toleransi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {couriers.map((courier) => (
                        <tr key={courier.id}>
                          <td className="p-3 font-semibold text-slate-800">{courier.courier_name || '-'}</td>
                          <td className="p-3 text-slate-500">{courier.code || '-'}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={courier.base_weight_gram}
                              onChange={(event) => handleCourierChange(courier.id, 'base_weight_gram', event.target.value)}
                              className="w-full min-w-[120px] text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={courier.extra_weight_step_gram}
                              onChange={(event) => handleCourierChange(courier.id, 'extra_weight_step_gram', event.target.value)}
                              className="w-full min-w-[120px] text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={courier.rounding_tolerance_gram}
                              onChange={(event) => handleCourierChange(courier.id, 'rounding_tolerance_gram', event.target.value)}
                              className="w-full min-w-[140px] text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2">Contoh: JNT bisa `300`, kurir lain bisa `0` jika tidak ada pengurangan toleransi.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-800">Simulasi Estimasi</h2>
              <p className="text-sm text-slate-500 mt-1">Cek cepat hasil pengali ongkir untuk total bobot tertentu.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Total Bobot Pesanan (gram)</label>
                <input
                  type="number"
                  min="0"
                  value={simWeight}
                  onChange={(event) => setSimWeight(event.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                />
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-slate-500">Bobot total</span>
                  <span className="font-semibold text-slate-800">{simWeightValue.toLocaleString('id-ID')} gram</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-slate-500">Kelipatan ongkir</span>
                  <span className="font-bold text-purple-700 text-lg">{multiplier}x</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-slate-500">Keterangan</span>
                  <span className="font-medium text-slate-700 text-right">
                    {simWeightValue <= baseWeight ? 'Masih dalam tarif dasar.' : 'Tarif dasar akan dikalikan sesuai total bobot pesanan.'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Contoh lama: 1.200 gram masih `1x`, 1.301 gram menjadi `2x`, 2.301 gram menjadi `3x` jika toleransi `300 gram`.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
