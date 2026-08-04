'use client';

import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Loader2, Save } from 'lucide-react';

type OriginCode = 'madiun' | 'bekasi' | 'jakarta';

type CourierSetting = {
  courier_code: string;
  origin_code: OriginCode;
  disc_percent: number;
  gudang_fee: number;
  cod_fee_percent: number;
};

type SettingsResponse = {
  success: boolean;
  message?: string;
  data?: {
    couriers: string[];
    origins: Record<OriginCode, string>;
    settings: CourierSetting[];
  };
};

type SettingsFormState = Record<string, Record<OriginCode, { disc: string; gudang: string; cod_fee: string }>>;

const ORIGIN_KEYS: OriginCode[] = ['madiun', 'bekasi', 'jakarta'];

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export default function BiayaOngkirPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couriers, setCouriers] = useState<string[]>([]);
  const [origins, setOrigins] = useState<Record<OriginCode, string>>({
    madiun: 'Madiun',
    bekasi: 'Bekasi',
    jakarta: 'Jakarta',
  });
  const [formState, setFormState] = useState<SettingsFormState>({});

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await fetch('/api/shipping/cost-settings');
        const json: SettingsResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (!json.success || !json.data) {
          throw new Error(json.message || 'Gagal mengambil pengaturan biaya ongkir');
        }

        const nextFormState: SettingsFormState = {};
        json.data.couriers.forEach((courier) => {
          nextFormState[courier] = {
            madiun: { disc: '', gudang: '', cod_fee: '' },
            bekasi: { disc: '', gudang: '', cod_fee: '' },
            jakarta: { disc: '', gudang: '', cod_fee: '' },
          };
        });

        json.data.settings.forEach((row) => {
          if (!nextFormState[row.courier_code]) {
            nextFormState[row.courier_code] = {
              madiun: { disc: '', gudang: '', cod_fee: '' },
              bekasi: { disc: '', gudang: '', cod_fee: '' },
              jakarta: { disc: '', gudang: '', cod_fee: '' },
            };
          }

          nextFormState[row.courier_code][row.origin_code] = {
            disc: String(row.disc_percent),
            gudang: String(row.gudang_fee),
            cod_fee: String(row.cod_fee_percent),
          };
        });

        setCouriers(json.data.couriers);
        setOrigins(json.data.origins);
        setFormState(nextFormState);
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

  const handleInputChange = (courier: string, origin: OriginCode, field: 'disc' | 'gudang' | 'cod_fee', value: string) => {
    setFormState((prev) => ({
      ...prev,
      [courier]: {
        ...prev[courier],
        [origin]: {
          ...prev[courier][origin],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      const res = await fetch('/api/shipping/cost-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: formState,
        }),
      });

      const json: SettingsResponse = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal menyimpan pengaturan biaya ongkir');
      }

      Swal.fire('Berhasil', json.message || 'Pengaturan Biaya Ongkir berhasil disimpan.', 'success');
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Biaya Ongkir</h1>
          <p className="text-sm text-slate-500 mt-1">Atur parameter dan simulasikan perhitungan seperti di Excel.</p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || saving}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm text-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memuat data...
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/50 text-[13px] text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="p-3">Ekspedisi</th>
                  <th className="p-3">Gudang</th>
                  <th className="p-3 border-l border-slate-200 text-emerald-800">Disc (%)</th>
                  <th className="p-3 text-emerald-800">Biaya Gudang</th>
                  <th className="p-3 text-emerald-800">% Fee COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px] font-medium text-slate-700">
                {couriers.map((courier) =>
                  ORIGIN_KEYS.map((origin) => (
                    <tr key={`${courier}-${origin}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{courier}</td>
                      <td className="p-3">{origins[origin]}</td>
                      <td className="p-2 border-l border-slate-100">
                        <div className="relative w-20">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={formState[courier]?.[origin]?.disc ?? ''}
                            onChange={(event) => handleInputChange(courier, origin, 'disc', event.target.value)}
                            className="w-full border border-slate-200 rounded p-1.5 text-right pr-6 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">%</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={formState[courier]?.[origin]?.gudang ?? ''}
                          onChange={(event) => handleInputChange(courier, origin, 'gudang', event.target.value)}
                          className="w-24 border border-slate-200 rounded p-1.5 text-right focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <div className="relative w-20">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={formState[courier]?.[origin]?.cod_fee ?? ''}
                            onChange={(event) => handleInputChange(courier, origin, 'cod_fee', event.target.value)}
                            className="w-full border border-slate-200 rounded p-1.5 text-right pr-6 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
