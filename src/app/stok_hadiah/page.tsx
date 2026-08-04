'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import { Edit2, Image as ImageIcon, X } from 'lucide-react';

type WarehouseItem = {
  id: number;
  warehouse_name: string;
};

type GiftStockItem = {
  id: number;
  gift_name: string;
  sku: string | null;
  price: number;
  image_url: string | null;
  total_stock: number;
  warehouse_stocks: Record<string, number>;
};

type StockGiftsResponse = {
  success: boolean;
  message?: string;
  data?: {
    warehouses: WarehouseItem[];
    gifts: GiftStockItem[];
  };
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

const normalizeImageSrc = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.startsWith('http') || value.startsWith('/')) {
    return value;
  }

  return `/${value}`;
};

export default function StokHadiahPage() {
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [gifts, setGifts] = useState<GiftStockItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftStockItem | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await fetch('/api/stock/gifts');
        const json: StockGiftsResponse = await res.json();

        if (!isMounted) {
          return;
        }

        if (!json.success || !json.data) {
          throw new Error(json.message || 'Gagal mengambil data stok hadiah');
        }

        setWarehouses(json.data.warehouses);
        setGifts(json.data.gifts);
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

  const fetchStockGifts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/gifts');
      const json: StockGiftsResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || 'Gagal mengambil data stok hadiah');
      }

      setWarehouses(json.data.warehouses);
      setGifts(json.data.gifts);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openStockModal = (gift: GiftStockItem) => {
    setSelectedGift(gift);

    const nextInputs: Record<string, string> = {};
    warehouses.forEach((warehouse) => {
      nextInputs[String(warehouse.id)] = String(gift.warehouse_stocks[String(warehouse.id)] ?? 0);
    });
    setStockInputs(nextInputs);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGift(null);
    setStockInputs({});
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedGift) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/stock/gifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_stock',
          id: selectedGift.id,
          warehouse_stocks: stockInputs,
        }),
      });

      const json: { success: boolean; message?: string } = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'Gagal memperbarui stok hadiah');
      }

      Swal.fire('Berhasil', json.message || 'Stok hadiah berhasil diperbarui.', 'success');
      closeModal();
      await fetchStockGifts();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stok Hadiah</h1>
          <p className="text-sm text-slate-400 mt-1">Pantau dan kelola ketersediaan stok hadiah per gudang di sini.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">No</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Info Hadiah</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 text-center">Total Stok</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                    Memuat data...
                  </td>
                </tr>
              ) : gifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-12">
                    Belum ada hadiah aktif.
                  </td>
                </tr>
              ) : (
                gifts.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-slate-400 font-medium">{index + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden relative flex items-center justify-center shrink-0">
                          {row.image_url ? (
                            <Image src={normalizeImageSrc(row.image_url)} alt={row.gift_name} fill className="object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">{row.gift_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                        {row.sku}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-lg font-bold ${
                          row.total_stock > 10 ? 'text-emerald-600' : row.total_stock > 0 ? 'text-amber-500' : 'text-red-500'
                        }`}
                      >
                        {Number(row.total_stock).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openStockModal(row)}
                        className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        title="Update Stok"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedGift ? (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(event) => event.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Update Stok Per Gudang</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="mb-4 pb-4 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-500 mb-1">Nama Hadiah</p>
                  <p className="font-bold text-slate-800 text-lg">
                    {selectedGift.gift_name} ({selectedGift.sku})
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  {warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-slate-700 w-1/2">{warehouse.warehouse_name}</label>
                      <div className="w-1/2">
                        <input
                          type="number"
                          required
                          min="0"
                          value={stockInputs[String(warehouse.id)] ?? '0'}
                          onChange={(event) =>
                            setStockInputs((prev) => ({
                              ...prev,
                              [String(warehouse.id)]: event.target.value,
                            }))
                          }
                          className="w-full text-lg font-bold text-center h-12 border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-3 rounded-xl transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-70">
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Stok'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
