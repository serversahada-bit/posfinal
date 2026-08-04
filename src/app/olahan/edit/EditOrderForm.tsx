'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, MapPin, Plus, Save, ShieldCheck, ShoppingCart, Trash2, Truck, UserRound, X } from 'lucide-react';
import Swal from 'sweetalert2';
import Select from 'react-select';

type Item = {
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  discount: number;
  is_gift: boolean;
  is_bundle: boolean;
  image_url?: string;
};

type EditLog = {
  id: number;
  action?: string;
  details?: string | null;
  created_at: string;
  user_name: string | null;
};

type Data = Record<string, any> & {
  order: Record<string, any>;
  items: any[];
  payment: any;
  shipment: any;
  editLogs?: EditLog[];
};

const money = (value: number) => new Intl.NumberFormat('id-ID').format(value || 0);
const number = (value: any) => Number(value || 0);
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-purple-300 focus:ring-1 focus:ring-purple-300';
const textareaClass = `${inputClass} min-h-[96px] resize-y`;
const sectionClass = 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm';
const sectionHeadClass = 'border-b border-slate-100 bg-slate-50/80 px-5 py-4';
const sectionBodyClass = 'p-5';

export default function EditOrderForm() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id') || '';
  const source = params.get('source') || 'CSO';

  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [destOptions, setDestOptions] = useState<any[]>([]);
  const [showDest, setShowDest] = useState(false);
  const [addProduct, setAddProduct] = useState('');
  const [addGift, setAddGift] = useState('');
  const [addBundle, setAddBundle] = useState('');
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [availableCouriers, setAvailableCouriers] = useState<any[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);

  useEffect(() => {
    if (!proof) {
      setProofPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(proof);
    setProofPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [proof]);

  useEffect(() => {
    if (!id) {
      return;
    }

    fetch(`/api/olahan/edit?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source)}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.message);
        }
        return json.data;
      })
      .then((loaded: Data) => {
        const order = loaded.order;
        const payment = loaded.payment || {};
        const shipment = loaded.shipment || {};
        const additionalShippingCost = number(order.additional_shipping_cost);
        const otherFee = number(order.other_fee);
        const fallbackManualFeeCod = payment.payment_method === 'cod' && additionalShippingCost === 0 ? otherFee : 0;
        const selectedAccount = loaded.paymentAccounts?.find((item: any) => item.account_number === payment.account_number);
        const selectedNoPay = loaded.noPaymentMethods?.find((item: any) => item.method_name === payment.bank_name);
        const courier = order.courier_id || loaded.couriers?.find((item: any) => String(item.courier_name).toUpperCase() === String(shipment.courier_name || order.courier_name || '').toUpperCase())?.id || '';

        setData(loaded);
        setItems(
          loaded.items.map((item: any) => ({
            product_id: number(item.product_id),
            product_name: item.product_name,
            qty: number(item.qty),
            price: number(item.price),
            discount: number(item.discount),
            is_gift: Boolean(item.is_gift),
            is_bundle: Boolean(item.is_bundle),
            image_url: item.image_url,
          })),
        );
        setForm({
          order_code: order.order_code || '',
          customer_name: order.customer_name || '',
          whatsapp_number: order.whatsapp_number || '',
          email: order.email || '',
          address: order.address || '',
          subdistrict: order.subdistrict || '',
          desa: order.desa || '',
          age: order.age ?? '',
          complaint: order.complaint || '',
          order_status: order.order_status || 'pending',
          ro_count: order.ro_count || 0,
          advertiser_name: order.advertiser_name || '',
          ad_source: order.ad_source || '',
          promo_id: order.promo_id || '',
          notes: order.notes || '',
          warehouse_id: order.warehouse_id || shipment.warehouse_id || '',
          courier_id: courier,
          shipping_cost: number(order.shipping_cost || shipment.shipping_cost),
          product_discount: number(order.product_discount),
          manual_fee_cod: additionalShippingCost || fallbackManualFeeCod,
          other_fee: additionalShippingCost === 0 && fallbackManualFeeCod > 0 ? 0 : otherFee,
          shipping_discount: number(order.shipping_discount),
          payment_method: payment.payment_method || 'cod',
          payment_status: payment.payment_status || 'pending',
          payment_account_id: selectedAccount?.id || '',
          no_payment_method_id: selectedNoPay?.id || '',
          id_reff: payment.fat_proof_url || '',
          payment_proof_url: payment.payment_proof_url || '',
        });
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        Swal.fire('Gagal', error.message, 'error');
      });
  }, [id, source]);

  const subtotal = useMemo(
    () => items.filter((item) => !item.is_gift).reduce((sum, item) => sum + (number(item.price) - number(item.discount)) * number(item.qty), 0),
    [items],
  );

  const total = Math.max(
    0,
    subtotal - number(form.product_discount) + number(form.shipping_cost) + number(form.manual_fee_cod) + number(form.other_fee) - number(form.shipping_discount),
  );

  const stockByWarehouse = useMemo(() => {
    if (!data) {
      return { product: {}, gift: {} };
    }

    const product: Record<string, Record<string, number>> = {};
    const gift: Record<string, Record<string, number>> = {};

    data.productStocks.forEach((row: any) => {
      const warehouseKey = String(row.warehouse_id);
      if (!product[warehouseKey]) product[warehouseKey] = {};
      product[warehouseKey][String(row.product_id)] = number(row.stock);
    });

    data.giftStocks.forEach((row: any) => {
      const warehouseKey = String(row.warehouse_id);
      if (!gift[warehouseKey]) gift[warehouseKey] = {};
      gift[warehouseKey][String(row.gift_id)] = number(row.stock);
    });

    return { product, gift };
  }, [data]);

  const getValidWarehouses = () => {
    if (!data || items.length === 0) {
      return data?.warehouses.map((warehouse: any) => Number(warehouse.id)) || [];
    }

    return data.warehouses
      .filter((warehouse: any) => {
        for (const item of items) {
          if (item.is_bundle) continue;
          const stockMap = item.is_gift ? stockByWarehouse.gift : stockByWarehouse.product;
          const available = stockMap[String(warehouse.id)]?.[String(item.product_id)] ?? 0;
          if (available < number(item.qty)) {
            return false;
          }
        }
        return true;
      })
      .map((warehouse: any) => Number(warehouse.id));
  };

  const fetchShippingOptions = async () => {
    if (!data || !form.subdistrict) {
      setAvailableCouriers([]);
      return;
    }

    setLoadingCouriers(true);
    try {
      const response = await fetch(`/api/shipping/rates?subdistrict=${encodeURIComponent(form.subdistrict)}`);
      const json = await response.json();

      if (json.status !== 'success' || !json.origins) {
        setAvailableCouriers([]);
        return;
      }

      const validWarehouses = getValidWarehouses();
      const nextOptions: any[] = [];

      Object.entries(json.origins).forEach(([origin, originData]: [string, any]) => {
        const warehouseIds = Array.isArray(originData.warehouse_ids) ? originData.warehouse_ids : [];
        const availableWarehouseId = warehouseIds.find((warehouseId: number) => validWarehouses.includes(Number(warehouseId)));
        const fallbackWarehouseId = warehouseIds[0];
        const targetWarehouseId = availableWarehouseId || fallbackWarehouseId;

        Object.entries(originData.rates || {}).forEach(([courierCode, rate]: [string, any]) => {
          if (!number(rate.price)) return;

          const matchedCourier = data.couriers.find((item: any) => String(item.courier_name).toUpperCase() === courierCode.toUpperCase())
            || data.couriers.find((item: any) => String(item.courier_name).toUpperCase().includes(courierCode.toUpperCase()));

          nextOptions.push({
            courierId: matchedCourier?.id || '',
            courierName: courierCode,
            warehouseId: targetWarehouseId || '',
            origin: origin.toUpperCase(),
            estimation: rate.estimation || 'Tidak ada estimasi',
            price: number(rate.price),
            outOfStock: !availableWarehouseId,
          });
        });
      });

      nextOptions.sort((a, b) => {
        if (a.outOfStock === b.outOfStock) return a.price - b.price;
        return a.outOfStock ? 1 : -1;
      });

      setAvailableCouriers(nextOptions);
    } catch (error) {
      setAvailableCouriers([]);
    } finally {
      setLoadingCouriers(false);
    }
  };

  useEffect(() => {
    void fetchShippingOptions();
  }, [data, form.subdistrict, items.length, items]);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateItem = (index: number, key: keyof Item, value: any) => {
    setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const add = (kind: 'product' | 'gift' | 'bundle', rawId: string) => {
    if (!rawId || !data) {
      return;
    }

    const list = kind === 'product' ? data.products : kind === 'gift' ? data.gifts : data.bundles;
    const found = list.find((entry: any) => String(entry.id) === rawId);
    if (!found) {
      return;
    }

    const isGift = kind === 'gift';
    const isBundle = kind === 'bundle';

    if (isBundle) {
      let components: any[] = [];
      try {
        components = typeof found.components === 'string' ? JSON.parse(found.components) : (found.components || []);
      } catch (e) {
        components = [];
      }

      if (components && components.length > 0) {
        const totalQty = components.reduce((sum: number, c: any) => sum + Number(c.qty), 0);
        const unitPrice = totalQty > 0 ? Math.round(Number(found.price) / totalQty) : 0;

        setItems((prev) => {
          const nextItems = [...prev];
          components.forEach((c: any) => {
            const existingIndex = nextItems.findIndex((item) => item.product_id === Number(c.product_id) && !item.is_gift && !item.is_bundle);
            if (existingIndex >= 0) {
              nextItems[existingIndex].qty += Number(c.qty);
            } else {
              nextItems.push({
                product_id: Number(c.product_id),
                product_name: c.product_name || 'Produk Bundling',
                qty: Number(c.qty),
                price: unitPrice,
                discount: 0,
                is_gift: false,
                is_bundle: false,
                image_url: c.image_url,
              });
            }
          });
          return nextItems;
        });
        return;
      }
    }

    if (items.some((item) => item.product_id === number(found.id) && item.is_gift === isGift && item.is_bundle === isBundle)) {
      void Swal.fire('Info', 'Item sudah ada dalam pesanan', 'info');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        product_id: number(found.id),
        product_name: found.product_name,
        qty: 1,
        price: isGift ? 0 : number(found.price),
        discount: 0,
        is_gift: isGift,
        is_bundle: isBundle,
        image_url: found.image_url,
      },
    ]);
  };

  const searchDest = async (query: string) => {
    set('subdistrict', query);
    const response = await fetch(`/api/shipping/destinations?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      setDestOptions(await response.json());
      setShowDest(true);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.warehouse_id) {
      await Swal.fire('Periksa Form', 'Gudang wajib dipilih', 'warning');
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append('payload', JSON.stringify({ ...form, order_status: 'pending', id, source, total_product_price: subtotal, total_payment: total, items }));
      if (proof) {
        body.append('payment_proof', proof);
      }

      const response = await fetch('/api/olahan/edit', { method: 'PUT', body });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'Gagal menyimpan');
      }

      await Swal.fire('Berhasil', json.message, 'success');
      router.push('/olahan');
    } catch (error: any) {
      await Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-10">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          <div>
            <p className="font-semibold text-slate-800">Memuat pesanan...</p>
            <p className="text-sm text-slate-500">Menyiapkan data edit untuk Anda.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!id || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10">
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-red-600">Pesanan tidak ditemukan atau parameter ID tidak tersedia.</p>
          <button
            type="button"
            onClick={() => router.push('/olahan')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Data Pesanan
          </button>
        </div>
      </div>
    );
  }

  const selectedWarehouse = data.warehouses.find((item: any) => String(item.id) === String(form.warehouse_id));
  const selectedCourier = data.couriers.find((item: any) => String(item.id) === String(form.courier_id));
  const courierSummary = selectedCourier
    ? `${selectedCourier.courier_name}${selectedCourier.service_type ? ` - ${selectedCourier.service_type}` : ''}`
    : 'Kurir belum dipilih';
  const warehouseSummary = selectedWarehouse
    ? `${selectedWarehouse.warehouse_name}${selectedWarehouse.city ? ` - ${selectedWarehouse.city}` : ''}`
    : 'Gudang belum dipilih';
  const latestEditLog = data.editLogs?.[0] || null;
  const getLogLabel = (log: EditLog) => {
    if (log.action === 'Update Status Pesanan') return 'Status';
    if (log.action === 'Create Pesanan') return 'Create';
    return 'Edit';
  };

  return (
    <div className="w-full px-4 py-6 md:px-8 lg:px-12">
      <form onSubmit={submit} className="space-y-6">
        <div className="mb-6">
          <div>
            <button
              type="button"
              onClick={() => router.push('/olahan')}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-purple-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Data Pesanan
            </button>
            <h1 className="text-2xl font-bold text-slate-800">Edit Pesanan</h1>
            <p className="mt-1 text-sm text-slate-500">Perbarui detail pesanan dengan tampilan yang konsisten seperti halaman input pesanan lain.</p>
          </div>
          {data?.order?.order_status === 'problem' || data?.payment?.payment_status === 'rejected' ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex gap-3">
                <div className="rounded-lg bg-red-100 p-2 text-red-600 self-start">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-800">
                    {data?.payment?.payment_status === 'rejected' ? 'Validasi Pembayaran Ditolak' : 'Pesanan Bermasalah'}
                  </h3>
                  <p className="mt-1 text-sm text-red-600">
                    {data?.payment?.reject_reason || 'Pesanan ini ditandai sedang bermasalah. Silakan perbaiki data yang diperlukan atau unggah bukti transfer baru jika ditolak oleh FAT.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="space-y-6">
            <section className={sectionClass}>
              <div className={sectionHeadClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-100 p-2 text-purple-500">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">Informasi Pelanggan & Pengiriman</h2>
                    <p className="text-sm text-slate-500">Samakan data penerima, alamat, dan detail pengiriman.</p>
                  </div>
                </div>
              </div>
              <div className={`${sectionBodyClass} grid grid-cols-1 gap-5 md:grid-cols-2`}>
                <Field label="Nomor WhatsApp *">
                  <input required className={inputClass} value={form.whatsapp_number} onChange={(event) => set('whatsapp_number', event.target.value)} />
                </Field>
                <Field label="Nama Pelanggan *">
                  <input required className={inputClass} value={form.customer_name} onChange={(event) => set('customer_name', event.target.value)} />
                </Field>
                <Field label="Email">
                  <input type="email" className={inputClass} value={form.email} onChange={(event) => set('email', event.target.value)} />
                </Field>
                {source !== 'CSO' ? (
                  <Field label="Repeat Order (RO)">
                    <input type="number" min="0" className={inputClass} value={form.ro_count} onChange={(event) => set('ro_count', event.target.value)} />
                  </Field>
                ) : null}
                {source === 'CSO' ? (
                  <>
                    <Field label="Advertiser">
                      <select className={inputClass} value={form.advertiser_name} onChange={(event) => set('advertiser_name', event.target.value)}>
                        <option value="">Pilih advertiser</option>
                        {data.advertisers.map((item: any) => (
                          <option key={item.id} value={item.name}>{item.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Sumber Iklan">
                      <select className={inputClass} value={form.ad_source} onChange={(event) => set('ad_source', event.target.value)}>
                        <option value="">Pilih sumber</option>
                        {data.adSources.map((item: any) => (
                          <option key={item.id} value={item.name}>{item.name}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : null}
                <Field label="Alamat Lengkap *" fullWidth>
                  <textarea required rows={4} className={textareaClass} value={form.address} onChange={(event) => set('address', event.target.value)} />
                </Field>
                <div className="relative md:col-span-2">
                  <Field label="Kecamatan / Kota / Provinsi *">
                    <input
                      required
                      className={inputClass}
                      value={form.subdistrict}
                      onFocus={() => void searchDest(form.subdistrict)}
                      onBlur={() => setTimeout(() => setShowDest(false), 200)}
                      onChange={(event) => void searchDest(event.target.value)}
                    />
                    {showDest && destOptions.length > 0 ? (
                      <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {destOptions.map((item: any) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                              set('subdistrict', item.id);
                              setShowDest(false);
                            }}
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-purple-50"
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </Field>
                </div>
                <Field label="Desa">
                  <input className={inputClass} value={form.desa} onChange={(event) => set('desa', event.target.value)} />
                </Field>
                <Field label="Usia">
                  <input type="number" min="0" className={inputClass} value={form.age} onChange={(event) => set('age', event.target.value)} />
                </Field>
                <Field label="Keluhan" fullWidth>
                  <textarea rows={3} className={textareaClass} value={form.complaint} onChange={(event) => set('complaint', event.target.value)} />
                </Field>
              </div>
            </section>

            <section className={sectionClass}>
              <div className={sectionHeadClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-100 p-2 text-purple-500">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">Produk, Bundling & Hadiah</h2>
                    <p className="text-sm text-slate-500">Tambahkan atau sesuaikan isi pesanan seperti pada halaman buat pesanan.</p>
                  </div>
                </div>
              </div>
              <div className={sectionBodyClass}>
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <AddSelect value={addProduct} onChange={(value) => { setAddProduct(value); add('product', value); setAddProduct(''); }} title="Tambah produk" options={data.products} />
                  <AddSelect value={addBundle} onChange={(value) => { setAddBundle(value); add('bundle', value); setAddBundle(''); }} title="Tambah bundling" options={data.bundles} />
                  <AddSelect value={addGift} onChange={(value) => { setAddGift(value); add('gift', value); setAddGift(''); }} title="Tambah hadiah" options={data.gifts} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="p-4">Item</th>
                        <th className="p-4">Jenis</th>
                        <th className="p-4">Harga</th>
                        <th className="p-4">Diskon / Item</th>
                        <th className="p-4">Qty</th>
                        <th className="p-4 text-right">Subtotal</th>
                        <th className="p-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                            Belum ada item dalam pesanan ini.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => (
                          <tr key={`${item.is_gift}-${item.is_bundle}-${item.product_id}`} className="hover:bg-slate-50/50">
                            <td className="p-4">
                              <div className="font-semibold text-slate-800">{item.product_name}</div>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                {item.is_gift ? 'Hadiah' : item.is_bundle ? 'Bundling' : 'Produk'}
                              </span>
                            </td>
                            <td className="p-4">
                              <input
                                disabled={item.is_gift}
                                type="number"
                                min="0"
                                className={`${inputClass} w-28`}
                                value={item.price}
                                onChange={(event) => updateItem(index, 'price', number(event.target.value))}
                              />
                            </td>
                            <td className="p-4">
                              <input
                                disabled={item.is_gift}
                                type="number"
                                min="0"
                                className={`${inputClass} w-28`}
                                value={item.discount}
                                onChange={(event) => updateItem(index, 'discount', number(event.target.value))}
                              />
                            </td>
                            <td className="p-4">
                              <input
                                type="number"
                                min="1"
                                className={`${inputClass} w-20`}
                                value={item.qty}
                                onChange={(event) => updateItem(index, 'qty', Math.max(1, number(event.target.value)))}
                              />
                            </td>
                            <td className="p-4 text-right font-bold text-slate-800">Rp {money((item.price - item.discount) * item.qty)}</td>
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                onClick={() => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                                className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <section className={sectionClass}>
              <div className={sectionHeadClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-100 p-2 text-purple-500">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">Pembayaran</h2>
                    <p className="text-sm text-slate-500">Pastikan metode dan bukti pembayaran sudah sesuai.</p>
                  </div>
                </div>
              </div>
              <div className={`${sectionBodyClass} space-y-4`}>
                <Field label="Metode Pembayaran">
                  <select className={inputClass} value={form.payment_method} onChange={(event) => set('payment_method', event.target.value)}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cod">COD</option>
                    <option value="free">Free / Tanpa Pembayaran</option>
                  </select>
                </Field>
                <Field label="Status Pembayaran">
                  <select className={inputClass} value={form.payment_status} onChange={(event) => set('payment_status', event.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </Field>
                {form.payment_method === "bank_transfer" ? (
                  <Field label="Rekening">
                    <select className={inputClass} value={form.payment_account_id} onChange={(event) => set('payment_account_id', event.target.value)}>
                      <option value="">Pilih rekening</option>
                      {data.paymentAccounts.map((item: any) => (
                        <option key={item.id} value={item.id}>{item.bank_name} - {item.account_name} ({item.account_number})</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {form.payment_method === "free" ? (
                  <Field label="Alasan tanpa pembayaran">
                    <select className={inputClass} value={form.no_payment_method_id} onChange={(event) => set('no_payment_method_id', event.target.value)}>
                      <option value="">Pilih alasan</option>
                      {data.noPaymentMethods.map((item: any) => (
                        <option key={item.id} value={item.id}>{item.method_name}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <Field label="ID Referensi">
                  <input className={inputClass} value={form.id_reff} onChange={(event) => set('id_reff', event.target.value)} />
                </Field>
                <Field label="Ganti Bukti Pembayaran">
                  <input type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} onChange={(event) => setProof(event.target.files?.[0] || null)} />
                  {proofPreview ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview baru</p>
                      <img src={proofPreview} alt="Preview bukti pembayaran baru" className="max-h-72 w-auto rounded-lg border border-slate-200 bg-white object-contain" />
                    </div>
                  ) : null}
                  {form.payment_proof_url ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bukti saat ini</p>
                      <a className="mb-3 inline-block text-xs font-medium text-purple-600 hover:text-purple-700" href={form.payment_proof_url.startsWith('http') ? form.payment_proof_url : "/" + form.payment_proof_url.replace(/^\/+/, "")} target="_blank" rel="noreferrer">
                        Buka gambar penuh
                      </a>
                      <img
                        src={form.payment_proof_url.startsWith('http') ? form.payment_proof_url : "/" + form.payment_proof_url.replace(/^\/+/, "")}
                        alt="Bukti pembayaran saat ini"
                        className="max-h-72 w-auto rounded-lg border border-slate-200 bg-white object-contain"
                      />
                    </div>
                  ) : null}
                </Field>
              </div>
            </section>
            <section className={sectionClass}>
              <div className={sectionHeadClass}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-purple-100 p-2 text-purple-500">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800">Pengiriman & Logistik</h2>
                      <p className="text-sm text-slate-500">Pilih kurir dari pop-up opsi seperti halaman buat pesanan.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCourierModal(true)}
                    disabled={loadingCouriers || availableCouriers.length === 0}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Ubah Kurir
                  </button>
                </div>
              </div>
              <div className={`${sectionBodyClass} space-y-4`}>
                <div className="flex items-start gap-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                  <div className="rounded-lg bg-violet-100 p-2 text-purple-400">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">
                      {courierSummary}
                      {selectedWarehouse ? <span className="text-purple-400"> - {selectedWarehouse.city?.toUpperCase?.() || "GUDANG"}</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Gudang Asal: <strong>{selectedWarehouse?.warehouse_name || warehouseSummary}</strong>
                    </p>
                    <p className="mt-2 text-sm font-bold text-purple-500">Biaya Ongkir: Rp {money(number(form.shipping_cost))}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="font-bold text-slate-800">Opsi Kurir & Gudang</h3>
                  <p className="mt-1 text-sm text-slate-500">Pemilihan utama dilakukan lewat tombol Ubah Kurir agar alurnya sama seperti halaman buat pesanan.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Ongkir">
                    <input type="number" min="0" className={inputClass} value={form.shipping_cost} onChange={(event) => set("shipping_cost", number(event.target.value))} />
                  </Field>
                  <Field label="Diskon Produk">
                    <input type="number" min="0" className={inputClass} value={form.product_discount} onChange={(event) => set("product_discount", number(event.target.value))} />
                  </Field>
                  <Field label="Biaya COD">
                    <input type="number" min="0" className={inputClass} value={form.manual_fee_cod} onChange={(event) => set("manual_fee_cod", number(event.target.value))} />
                  </Field>
                  <Field label="Biaya Lain">
                    <input type="number" min="0" className={inputClass} value={form.other_fee} onChange={(event) => set("other_fee", number(event.target.value))} />
                  </Field>
                </div>
                <Field label="Promo">
                  <Select
                    isMulti
                    value={(form.promo_id || '').split(',').filter(Boolean).map((id: string) => {
                      const p = data.promos.find((pr: any) => pr.id.toString() === id.trim());
                      return p ? { value: p.id.toString(), label: p.promo_name } : null;
                    }).filter(Boolean)}
                    onChange={(newVal) => set("promo_id", (newVal as any[]).map(v => v.value).join(','))}
                    options={data.promos.map((item: any) => ({ value: item.id.toString(), label: item.promo_name }))}
                    placeholder="Pilih Promo..."
                    className="text-sm text-slate-800"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        borderColor: '#cbd5e1',
                        padding: '1px',
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: '#d8b4e2'
                        }
                      })
                    }}
                  />
                </Field>
                <Field label="Status Pesanan">
                  <input className={`${inputClass} bg-slate-100 text-slate-500`} value="Pending" disabled readOnly />
                  <p className="mt-2 text-xs text-amber-600">Setiap simpan edit dari halaman ini akan otomatis mengubah status pesanan menjadi Pending.</p>
                </Field>
                <Field label="Catatan">
                  <textarea rows={3} className={textareaClass} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
                </Field>
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Total Harga Produk</span>
                    <span className="font-bold text-slate-800">Rp {money(subtotal)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                    <span className="font-bold uppercase tracking-wide text-slate-800">Total Pembayaran</span>
                    <span className="text-2xl font-black tracking-tight text-purple-500">Rp {money(total)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <div className="rounded-2xl border border-purple-100 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-500">Ringkasan Pesanan</p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">ID Pesanan</span>
                <input
                  required
                  className={inputClass}
                  value={form.order_code || ''}
                  onChange={(event) => set('order_code', event.target.value.toUpperCase())}
                />
              </label>
              <p className="mt-1 text-sm text-slate-500">Sumber: {source.replace('_', ' ')}</p>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-200 px-4 py-3 text-sm font-bold text-purple-900 shadow-[0_4px_14px_0_rgba(216,180,226,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-purple-300 disabled:transform-none disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Perubahan
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Log Aktivitas User</p>
              {latestEditLog ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-slate-800">Aktivitas terakhir oleh {latestEditLog.user_name || 'User tidak dikenal'}</p>
                  <p className="mt-1 text-sm text-slate-500">{getLogLabel(latestEditLog)} | {formatDateTime(latestEditLog.created_at)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Belum ada riwayat aktivitas untuk pesanan ini.</p>
              )}

              {data.editLogs && data.editLogs.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  {data.editLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-700">{log.user_name || 'User tidak dikenal'}</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{getLogLabel(log)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                      {log.details ? <p className="mt-1 text-xs text-slate-600">{log.details}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-200 py-4 text-sm font-bold tracking-wide text-purple-900 shadow-[0_4px_14px_0_rgba(216,180,226,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-purple-300 disabled:transform-none disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Simpan Semua Perubahan
          </button>
        </div>
      </form>

      {showCourierModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-800">Opsi Kurir & Gudang</h3>
              <button type="button" onClick={() => setShowCourierModal(false)} className="text-slate-400 transition-colors hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {loadingCouriers ? (
                <div className="flex items-center justify-center rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-purple-500" />
                  Memuat opsi kurir...
                </div>
              ) : null}
              {!loadingCouriers && availableCouriers.length === 0 ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-700">
                  Opsi kurir belum tersedia untuk tujuan ini.
                </div>
              ) : null}
              {!loadingCouriers ? availableCouriers.map((option, index) => {
                const isActive = String(option.warehouseId) === String(form.warehouse_id) && String(option.courierId) === String(form.courier_id);
                return (
                  <label
                    key={`${option.courierName}-${option.origin}-${index}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${option.outOfStock ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 hover:border-violet-300'} ${isActive ? 'border-purple-300 bg-violet-50/50 ring-1 ring-purple-300' : ''}`}
                  >
                    <input
                      type="radio"
                      name="courierSelection"
                      className="mt-1 text-purple-400 focus:ring-purple-300"
                      checked={isActive}
                      disabled={option.outOfStock || !option.courierId}
                      onChange={() => {
                        set('warehouse_id', String(option.warehouseId));
                        set('courier_id', String(option.courierId));
                        set('shipping_cost', number(option.price));
                        setShowCourierModal(false);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold uppercase text-slate-800">
                        {option.courierName} <span className="ml-1 font-semibold text-purple-400">- {option.origin}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Estimasi: {option.estimation || 'Tidak ada estimasi'}</p>
                      <p className="mt-2 font-bold text-purple-500">Rp {money(number(option.price))}</p>
                      {option.outOfStock ? <p className="mt-1 text-[10px] font-bold text-red-500">Stok tidak cukup di gudang ini</p> : null}
                    </div>
                  </label>
                );
              }) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children, fullWidth = false }: { label: string; children: ReactNode; fullWidth?: boolean }) {
  return (
    <label className={fullWidth ? 'block md:col-span-2' : 'block'}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function AddSelect({ value, onChange, title, options }: { value: string; onChange: (value: string) => void; title: string; options: any[] }) {
  return (
    <div className="flex gap-2">
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{title}...</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.product_name}
            {item.total_stock !== undefined ? ` (stok ${item.total_stock})` : ''}
          </option>
        ))}
      </select>
      <span className="flex items-center rounded-lg bg-purple-100 px-3 text-purple-500">
        <Plus className="h-4 w-4" />
      </span>
    </div>
  );
}








