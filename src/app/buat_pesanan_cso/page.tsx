'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Loader2, Plus, Search, ShoppingCart, Trash2, MapPin, Package, Upload, AlertCircle, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { useAuth } from '@/contexts/AuthContext';

type InitialData = {
  products: any[];
  bundlings: any[];
  gifts: any[];
  warehouses: any[];
  paymentAccounts: any[];
  noPaymentMethods: any[];
  promos: any[];
  advertisers: any[];
  adSources: any[];
  ongkirSettings: any[];
  shippingWeightSettings: any;
  courierWeightRules: any;
  stockData: Record<number, Record<number, number>>;
  giftStockData: Record<number, Record<number, number>>;
};

type CartLine = {
  product_id: number;
  product_name: string;
  price: number;
  qty: number | '';
  discount: number | '';
  weight_gram: number;
  is_gift: boolean;
  is_bundle?: boolean;
  bundle_items?: any[];
  image_url?: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(value);

export default function BuatPesananPage() {
  const { user } = useAuth();
  const [data, setData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBundlingModal, setShowBundlingModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [productSearchKeyword, setProductSearchKeyword] = useState('');
  const [bundlingSearchKeyword, setBundlingSearchKeyword] = useState('');
  const [giftSearchKeyword, setGiftSearchKeyword] = useState('');

  // Form States
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchOpts, setCustomerSearchOpts] = useState<any[]>([]);
  const [showCustomerOpts, setShowCustomerOpts] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [desa, setDesa] = useState('');

  const [waCheckMsg, setWaCheckMsg] = useState({ text: '', type: '' });

  const [destSearch, setDestSearch] = useState('');
  const [destOpts, setDestOpts] = useState<any[]>([]);
  const [showDestOpts, setShowDestOpts] = useState(false);


  const [promoIds, setPromoIds] = useState<any[]>([]);
  const [age, setAge] = useState('');
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [advertiserName, setAdvertiserName] = useState('');
  const [adSource, setAdSource] = useState('');
  const [roCount, setRoCount] = useState<number | ''>('');

  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [noPaymentMethodId, setNoPaymentMethodId] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);

  // Warehouse & Courier
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [courierName, setCourierName] = useState('');
  const [courierService, setCourierService] = useState('');
  const [shippingCost, setShippingCost] = useState(0);

  const [availableCouriers, setAvailableCouriers] = useState<any[]>([]);
  const [bestOriginStr, setBestOriginStr] = useState<string>('');

  // Custom Fees
  const [productDiscount, setProductDiscount] = useState<number | string>(0);
  const [manualFeeCod, setManualFeeCod] = useState<number | string>(0);
  const [otherFee, setOtherFee] = useState<number | string>(0);

  // Timers for debounce
  const waTimer = useRef<NodeJS.Timeout | null>(null);
  const custSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const destSearchTimer = useRef<NodeJS.Timeout | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/data/initial')
      .then(res => res.json())
      .then(json => {
        if (json.status === 'success') {
          setData(json.data);
        }
        setLoading(false);
      });
  }, []);

  const handleWaCheck = (wa: string) => {
    let cleanWa = wa.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('08')) {
      cleanWa = '62' + cleanWa.substring(1);
    } else if (cleanWa.startsWith('8')) {
      cleanWa = '62' + cleanWa;
    }
    setWhatsappNumber(cleanWa);

    if (cleanWa.length < 10) {
      setWaCheckMsg({ text: '', type: '' });
      return;
    }

    if (waTimer.current) clearTimeout(waTimer.current);
    setWaCheckMsg({ text: 'Mengecek nomor...', type: 'text-blue-500' });

    waTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/check_whatsapp?wa=${cleanWa}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          const msg = (json.days_since_created > 7)
            ? '✓ Nomor sudah ada di database. Data diisi otomatis.'
            : '✓ Data ini masuk belum ada 7 hari ke database. Data diisi otomatis.';
          setWaCheckMsg({ text: msg, type: 'text-red-500' });
          if (!customerName) setCustomerName(json.data.name);
          if (!email) setEmail(json.data.email || '');
          if (!address) setAddress(json.data.address || '');
          if (!subdistrict && json.data.subdistrict) {
            setSubdistrict(json.data.subdistrict);
            setDestSearch(json.data.subdistrict);
          }
          if (!desa && json.data.desa) setDesa(json.data.desa);
        } else {
          setWaCheckMsg({ text: 'Nomor belum terdaftar (Pelanggan Baru).', type: 'text-slate-500' });
        }
      } catch (err) {
        setWaCheckMsg({ text: 'Gagal mengecek nomor.', type: 'text-red-500' });
      }
    }, 500);
  };

  const handleCustSearch = (q: string) => {
    setCustomerSearch(q);
    if (custSearchTimer.current) clearTimeout(custSearchTimer.current);
    if (q.length < 2) {
      setCustomerSearchOpts([]);
      setShowCustomerOpts(false);
      return;
    }
    custSearchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/customers/search?q=${q}`);
      const json = await res.json();
      setCustomerSearchOpts(json.results || []);
      setShowCustomerOpts(true);
    }, 300);
  };

  const handleDestSearch = (q: string) => {
    setDestSearch(q);
    if (destSearchTimer.current) clearTimeout(destSearchTimer.current);
    destSearchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/shipping/destinations?q=${q}`);
      const json = await res.json();
      setDestOpts(json || []);
      setShowDestOpts(true);
    }, 300);
  };

  const calculateTotals = () => {
    let subtotalProducts = 0;
    let totalWeight = 0;
    cart.forEach(c => {
      subtotalProducts += (c.price - Number(c.discount || 0)) * Number(c.qty || 0);
      totalWeight += c.weight_gram * Number(c.qty);
    });

    // Kalkulasi fee COD & biaya FF
    let feeCodCalc = 0;
    let biayaFfCalc = shippingCost;
    if (shippingCost > 0 && data?.ongkirSettings) {
      let discPerc = 0;
      let gudangRp = 0;
      let codPerc = 0;

      const whCodeMap: Record<number, string> = { 1: 'madiun', 2: 'madiun', 5: 'madiun', 3: 'bekasi', 4: 'jakarta' };
      const selectedOrigin = warehouseId ? whCodeMap[warehouseId] || 'jakarta' : 'jakarta';

      for (const row of data.ongkirSettings) {
        if (row.courier_code?.toUpperCase() === courierName.toUpperCase() && row.origin_code?.toLowerCase() === selectedOrigin.toLowerCase()) {
          discPerc = parseFloat(row.disc_percent) || 0;
          gudangRp = parseFloat(row.gudang_fee) || 0;
          codPerc = parseFloat(row.cod_fee_percent) || 0;
        }
      }

      const ongkirNet = shippingCost - (shippingCost * (discPerc / 100));
      if (paymentMethod === 'cod') {
        feeCodCalc = ((subtotalProducts + ongkirNet) * (codPerc / 100)) + gudangRp;
        biayaFfCalc = shippingCost + feeCodCalc;
      }
    }

    // Removed setManualFeeCod here to prevent infinite loop

    return {
      subtotalProducts,
      totalWeight,
      feeCodCalc,
      biayaFfCalc
    };
  };

  const totals = calculateTotals();
  const selectedNoPaymentMethod = data?.noPaymentMethods.find((item: any) => String(item.id) === noPaymentMethodId);
  const noShippingCostForFreeMethod = paymentMethod === 'free' && Boolean(selectedNoPaymentMethod?.no_shipping_cost);
  const effectiveShippingCost = noShippingCostForFreeMethod ? 0 : Number(shippingCost);
  const totalPayment = Math.max(0, totals.subtotalProducts - Number(productDiscount) + effectiveShippingCost + Number(manualFeeCod) + Number(otherFee));

  // Auto-calculate COD fee when relevant fields change
  useEffect(() => {
    if (paymentMethod === 'cod') {
      const computedCodFee = Math.round((totals.subtotalProducts + effectiveShippingCost) * 0.03);
      setManualFeeCod(computedCodFee);
    } else {
      setManualFeeCod(0);
    }
  }, [paymentMethod, totals.subtotalProducts, effectiveShippingCost]);

  const getValidWarehouses = () => {
    if (!data) return [];
    if (cart.length === 0) return data.warehouses.map(w => w.id);

    return data.warehouses.filter(wh => {
      for (const item of cart) {
        if (item.is_gift) {
          const available = data.giftStockData[wh.id]?.[item.product_id] || 0;
          if (available < Number(item.qty || 0)) return false;
        } else {
          const available = data.stockData[wh.id]?.[item.product_id] || 0;
          if (available < Number(item.qty || 0)) return false;
        }
      }
      return true;
    }).map(w => w.id);
  };

  useEffect(() => {
    if (warehouseId) {
      const validIds = getValidWarehouses();
      if (!validIds.includes(warehouseId)) {
        if (validIds.length === 0) {
          Swal.fire('Stok Tidak Mencukupi', 'Tidak ada satupun gudang yang memiliki stok cukup untuk pesanan ini. Silakan kurangi kuantitas.', 'error');
          setWarehouseId(null);
          setCourierName('');
          setShippingCost(0);
        } else {
          // Fallback to first valid warehouse
          setWarehouseId(validIds[0]);
          fetchShippingRates(); // re-fetch with new valid warehouses
        }
      }
    }
  }, [cart]);

  const getShippingWeightMultiplier = (cName: string, tWeight: number) => {
    if (!data) return 1;
    const rule = data.courierWeightRules[cName.toUpperCase()] || {};
    const set = data.shippingWeightSettings || {};
    const baseWeight = Math.max(rule.base_weight_gram || set.base_weight_gram || 1000, 1);
    const extraStep = Math.max(rule.extra_weight_step_gram || set.extra_weight_step_gram || 1000, 1);
    const tolerance = Math.max(rule.rounding_tolerance_gram || set.rounding_tolerance_gram || 0, 0);

    if (tWeight <= baseWeight) return 1;
    const excess = tWeight - baseWeight;
    const fullSteps = Math.floor(excess / extraStep);
    const remainder = excess % extraStep;
    return 1 + fullSteps + (remainder > tolerance ? 1 : 0);
  };

  const fetchShippingRates = async () => {
    if (!subdistrict) return;
    try {
      const res = await fetch(`/api/shipping/rates?subdistrict=${subdistrict}`);
      const json = await res.json();
      if (json.status === 'success' && json.origins) {
        const validWarehouses = getValidWarehouses();
        let allOpts: any[] = [];

        for (const origin in json.origins) {
          const od = json.origins[origin];
          const intersect = od.warehouse_ids.filter((id: number) => validWarehouses.includes(id));
          const isAvailable = intersect.length > 0;
          const whIdToUse = isAvailable ? intersect[0] : od.warehouse_ids[0];

          for (const c in od.rates) {
            if (od.rates[c].price > 0) {
              const multi = getShippingWeightMultiplier(c, totals.totalWeight);
              allOpts.push({
                courierName: c,
                origin,
                warehouseId: whIdToUse,
                price: od.rates[c].price * multi,
                estimation: od.rates[c].estimation,
                outOfStock: !isAvailable,
                outOfCoverage: od.rates[c].out_of_coverage
              });
            }
          }
        }

        allOpts.sort((a, b) => {
          if (a.outOfStock !== b.outOfStock) return a.outOfStock ? 1 : -1;
          const aOoc = a.outOfCoverage?.trim().toUpperCase() || '';
          const bOoc = b.outOfCoverage?.trim().toUpperCase() || '';
          if (aOoc === 'ALL' && bOoc !== 'ALL') return -1;
          if (aOoc !== 'ALL' && bOoc === 'ALL') return 1;
          return a.price - b.price;
        });

        setAvailableCouriers(allOpts);

        // Auto select first available
        const first = allOpts.find(o => !o.outOfStock);
        if (first) {
          setWarehouseId(first.warehouseId);
          setCourierName(first.courierName);
          setShippingCost(first.price);
          setBestOriginStr(first.origin);
        }
      } else {
        setAvailableCouriers([]);
      }
    } catch (e) {
      console.error(e);
      setAvailableCouriers([]);
    }
  };

  useEffect(() => {
    if (subdistrict && cart.length > 0) {
      fetchShippingRates();
    }
  }, [subdistrict, totals.totalWeight, cart.length]);

  useEffect(() => {
    const selectedCourierOpt = availableCouriers.find(c => c.warehouseId === warehouseId && c.courierName === courierName);
    const currentOoc = selectedCourierOpt?.outOfCoverage?.trim().toUpperCase() || '';
    if (currentOoc === 'TF') {
      if (paymentMethod !== 'bank_transfer') setPaymentMethod('bank_transfer');
    } else if (currentOoc !== 'ALL' && currentOoc !== 'TF') {
      if (paymentMethod !== '') setPaymentMethod('');
    } else if (currentOoc === 'ALL') {
      if (!paymentMethod || paymentMethod === '') setPaymentMethod('bank_transfer');
    }
  }, [warehouseId, courierName, availableCouriers]);

  const handleAddToCart = (item: any, isGift: boolean) => {
    setCart(prev => {
      const exist = prev.find(p => p.product_id === item.id && p.is_gift === isGift);
      if (exist) {
        Swal.fire('Sudah Ditambahkan', 'Item ini sudah ada di daftar. Silakan tambah Qty pada baris tersebut.', 'info');
        return prev;
      }
      return [...prev, {
        product_id: item.id,
        product_name: item.product_name || item.gift_name,
        price: isGift ? 0 : item.price,
        qty: 1,
        discount: 0,
        weight_gram: item.weight_gram || 0,
        is_gift: isGift,
        image_url: item.image_url,
      }];
    });
    setShowProductModal(false);
    setShowGiftModal(false);
  };

  const updateCartQty = (idx: number, qty: number | string) => {
    if (qty !== '' && typeof qty === 'number' && qty < 1) qty = 1;
    const newCart = [...cart];
    newCart[idx].qty = qty as number | '';
    setCart(newCart);
  };

  const updateCartDiscount = (idx: number, disc: number | string) => {
    if (disc !== '' && typeof disc === 'number' && disc < 0) disc = 0;
    const newCart = [...cart];
    newCart[idx].discount = disc as number | '';
    setCart(newCart);
  };

  const removeCartItem = (idx: number) => {
    const newCart = [...cart];
    newCart.splice(idx, 1);
    setCart(newCart);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) return Swal.fire('Error', 'Nama pelanggan wajib diisi', 'error');
    if (!whatsappNumber) return Swal.fire('Error', 'Nomor WA wajib diisi', 'error');
    if (cart.length === 0) return Swal.fire('Error', 'Keranjang kosong', 'error');
    if (!warehouseId || !courierName) return Swal.fire('Error', 'Gudang & Kurir wajib dipilih', 'error');
    if (!paymentMethod) return Swal.fire('Error', 'Metode pembayaran tidak tersedia atau belum dipilih. Periksa status OOC dari Kurir.', 'error');



    setSubmitting(true);
    const fd = new FormData();
    fd.append('user_id', String(user?.id ?? 0));
    if (customerId) fd.append('customer_id', customerId);
    fd.append('customer_name', customerName);
    fd.append('whatsapp_number', whatsappNumber);
    fd.append('email', email);
    fd.append('address', address);
    fd.append('subdistrict', subdistrict);
    fd.append('desa', desa);
    fd.append('age', age);
    fd.append('complaint', complaint);
    fd.append('notes', notes);
    fd.append('advertiser_name', advertiserName);
    fd.append('ad_source', adSource);
    fd.append('ro_count', roCount.toString());
    fd.append('promo_id', promoIds.map(p => p.value).join(','));

    fd.append('total_product_price', totals.subtotalProducts.toString());
    fd.append('product_discount', productDiscount.toString());
    fd.append('shipping_cost', effectiveShippingCost.toString());
    fd.append('manual_fee_cod', manualFeeCod.toString());
    fd.append('other_fee', otherFee.toString());
    fd.append('total_payment', totalPayment.toString());

    fd.append('warehouse_id', warehouseId.toString());
    fd.append('courier_name', courierName);
    fd.append('payment_method', paymentMethod);

    if (paymentMethod === 'bank_transfer') fd.append('payment_account_id', paymentAccountId);
    if (paymentMethod === 'free') fd.append('no_payment_method_id', noPaymentMethodId);
    if (paymentProofFile) fd.append('payment_proof', paymentProofFile);

    cart.forEach(c => {
      fd.append('item_product_id[]', c.product_id.toString());
      fd.append('item_is_gift[]', c.is_gift ? '1' : '0');
      fd.append('item_is_bundle[]', c.is_bundle ? '1' : '0');
      fd.append('item_price[]', c.price.toString());
      fd.append('item_discount[]', Number(c.discount).toString());
      fd.append('item_qty[]', Number(c.qty).toString());
    });

    try {
      const res = await fetch('/api/orders_cso', {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (json.status === 'success') {
        const audio = new Audio('/notif.mp3');
        audio.play().catch(e => console.error('Audio play error:', e));
        Swal.fire('Berhasil', 'Pesanan CSO berhasil dibuat dengan kode: ' + json.order_code, 'success').then(() => {
          window.location.reload();
        });
      } else {
        Swal.fire('Error', json.message || 'Terjadi kesalahan', 'error');
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Gagal menyimpan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-purple-400" /></div>;
  }

  const filteredProducts = data?.products.filter(p => p.product_name.toLowerCase().includes(productSearchKeyword.toLowerCase())) || [];
  const filteredBundlings = data?.bundlings?.filter(b => b.bundle_name.toLowerCase().includes(bundlingSearchKeyword.toLowerCase())) || [];
  const filteredGifts = data?.gifts?.filter(g => g.gift_name.toLowerCase().includes(giftSearchKeyword.toLowerCase())) || [];
  const selectedWarehouseData = data?.warehouses.find(w => w.id === warehouseId);

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Buat Pesanan Baru (CSO)</h1>
        <p className="text-sm text-slate-500">Masukkan rincian pesanan CSO baru di bawah ini.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">


            {/* Informasi Pelanggan & Pengiriman */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-bold text-slate-800">Informasi Pelanggan & Pengiriman</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nomor WhatsApp <span className="text-red-500">*</span></label>
              <input required value={whatsappNumber} onChange={e => handleWaCheck(e.target.value)} type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 focus:border-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Contoh: 081234567890" />
              {waCheckMsg.text && <p className={`text-[11px] font-medium mt-1 ${waCheckMsg.type}`}>{waCheckMsg.text}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nama Lengkap <span className="text-red-500">*</span></label>
              <input required value={customerName} onChange={e => setCustomerName(e.target.value)} type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 focus:border-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Contoh: Budi Santoso" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nama Advertiser</label>
              <select value={advertiserName} onChange={e => setAdvertiserName(e.target.value)} className="w-full border border-slate-300 text-slate-800 text-sm rounded-lg outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 px-3 py-2.5 bg-white">
                <option value="">-- Pilih Advertiser --</option>
                {data?.advertisers.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Sumber Iklan</label>
              <select value={adSource} onChange={e => setAdSource(e.target.value)} className="w-full border border-slate-300 text-slate-800 text-sm rounded-lg outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 px-3 py-2.5 bg-white">
                <option value="">-- Pilih Sumber Iklan --</option>
                {data?.adSources.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Repeat Order (RO) Ke-berapa?</label>
              <input value={roCount} onChange={e => setRoCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} type="number" min="0" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Kosongkan atau isi 0 jika pesanan baru" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Email (Opsional)</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Contoh: budi@gmail.com" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Alamat Lengkap</label>
              <textarea required value={address} onChange={e => setAddress(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Nama Jalan, RT/RW, Dusun..."></textarea>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Kecamatan / Kota / Provinsi <span className="text-red-500">*</span></label>
              <div className="relative">
                <input required value={destSearch} onChange={e => handleDestSearch(e.target.value)} onFocus={() => handleDestSearch(destSearch)} onBlur={() => setTimeout(() => setShowDestOpts(false), 200)} type="text" className="w-full border border-slate-300 rounded-lg pl-4 pr-10 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Pilih atau cari Kecamatan, Kota, atau Provinsi..." />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {showDestOpts && destOpts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {destOpts.map((opt, i) => (
                      <div key={i} onClick={() => {
                        setSubdistrict(opt.id);
                        setDestSearch(opt.id);
                        setShowDestOpts(false);
                      }} className="p-3 hover:bg-violet-50 cursor-pointer border-b border-slate-100 text-sm font-medium text-slate-700">
                        {opt.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Desa (Opsional)</label>
              <input value={desa} onChange={e => setDesa(e.target.value)} type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm placeholder:text-slate-400" placeholder="Contoh: Sukamaju" />
            </div>

          </div>
        </div>
        <div className="space-y-6">

          {/* KOLOM PRODUK & PENGIRIMAN */}
          <div className="space-y-6">

            {/* Produk */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 text-lg">Daftar Produk</h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowProductModal(true)} className="px-4 py-2 bg-purple-200 hover:bg-purple-300 text-purple-900 rounded-lg shadow-sm text-sm font-semibold transition-colors flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Tambah Produk
                  </button>
                  <button type="button" onClick={() => setShowBundlingModal(true)} className="px-4 py-2 bg-fuchsia-200 hover:bg-fuchsia-300 text-fuchsia-900 rounded-lg shadow-sm text-sm font-semibold transition-colors flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Tambah Bundling
                  </button>
                </div>
              </div>

              {cart.filter(item => !item.is_gift).length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-slate-500">
                  <Package className="w-12 h-12 mb-2 text-slate-300" />
                  <p>Belum ada produk yang ditambahkan.</p>
                  <p className="text-xs mt-1">Klik "+ Tambah Produk" untuk memilih produk.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-4 font-medium w-1/2">Produk</th>
                        <th className="p-4 font-medium text-right w-1/6">Harga</th>
                        <th className="p-4 font-medium text-right w-1/6">Diskon</th>
                        <th className="p-4 font-medium text-center w-1/6">Qty</th>
                        <th className="p-4 font-medium text-right w-1/6">Subtotal</th>
                        <th className="p-4 font-medium text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cart.map((item, idx) => !item.is_gift && (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover border border-slate-200" />
                              ) : (
                                <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400 border border-slate-300"><Package className="w-6 h-6" /></div>
                              )}
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{item.product_name}</p>
                                {item.is_bundle && <span className="text-[10px] font-bold px-2 py-0.5 bg-fuchsia-100 text-fuchsia-700 rounded-full mt-1 inline-block">Paket Bundling</span>}
                                {item.is_bundle && item.bundle_items && item.bundle_items.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {item.bundle_items.map((bi: any, i: number) => (
                                      <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                                        <div className="w-1 h-1 bg-slate-400 rounded-full mt-1.5"></div>
                                        <span className="font-medium">{bi.qty}x</span> {bi.products?.product_name || 'Produk'}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right text-sm font-medium text-slate-600">
                            Rp {formatCurrency(item.price)}
                          </td>
                          <td className="p-4 text-right">
                            <input type="number" min="0" value={item.discount} onChange={e => updateCartDiscount(idx, e.target.value === '' ? '' : parseInt(e.target.value) || 0)} className="w-24 text-right border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-purple-300 text-rose-500 font-medium text-sm" />
                          </td>
                          <td className="p-4 text-center">
                            <input type="number" min="1" value={item.qty} onChange={e => updateCartQty(idx, e.target.value === '' ? '' : parseInt(e.target.value))} className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-purple-300 text-sm font-medium" />
                          </td>
                          <td className="p-4 text-right font-bold text-slate-800">
                            Rp {formatCurrency((item.price - Number(item.discount || 0)) * Number(item.qty || 0))}
                          </td>
                          <td className="p-4 text-center">
                            <button type="button" onClick={() => removeCartItem(idx)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Tambah Bundling */}
      {showBundlingModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Pilih Bundling</h3>
              <button onClick={() => setShowBundlingModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Cari bundling..." value={bundlingSearchKeyword} onChange={e => setBundlingSearchKeyword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl outline-none transition-all text-sm" />
              </div>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredBundlings.map(b => {
                  const added = cart.find(c => c.product_id === b.id && c.is_bundle);
                  return (
                    <div key={b.id} className="border border-slate-200 rounded-xl p-3 flex gap-3 hover:border-purple-300 hover:shadow-md transition-all group bg-white cursor-pointer"
                      onClick={() => {
                        if (!added) {
                          let totalQty = 0;
                          let totalNormalPrice = 0;
                          
                          (b.product_bundle_items || []).forEach((item: any) => {
                            const q = Number(item.qty || 1);
                            totalQty += q;
                            totalNormalPrice += Number(item.products?.price || 0) * q;
                          });

                          const bundlePrice = Number(b.price || 0);
                          const totalDiscount = totalNormalPrice > bundlePrice ? totalNormalPrice - bundlePrice : 0;
                          const discountPerItem = totalQty > 0 ? Math.round(totalDiscount / totalQty) : 0;

                          setCart(prev => {
                            const nextItems = [...prev];
                            (b.product_bundle_items || []).forEach((item: any) => {
                              const existingIndex = nextItems.findIndex((c) => c.product_id === Number(item.product_id) && !c.is_gift && !c.is_bundle);
                              if (existingIndex >= 0) {
                                nextItems[existingIndex].qty = Number(nextItems[existingIndex].qty) + Number(item.qty || 1);
                              } else {
                                nextItems.push({
                                  product_id: Number(item.product_id),
                                  product_name: item.products?.product_name || 'Produk Bundling',
                                  price: Number(item.products?.price || 0),
                                  qty: Number(item.qty || 1),
                                  discount: discountPerItem,
                                  weight_gram: Number(item.products?.weight_gram || 0),
                                  is_gift: false,
                                  is_bundle: false,
                                  image_url: item.products?.image_url || '',
                                });
                              }
                            });
                            return nextItems;
                          });
                          setShowBundlingModal(false);
                        }
                      }}>
                      {b.image_url ? (
                        <img src={b.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-100" />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><Package className="w-8 h-8" /></div>
                      )}
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="font-bold text-slate-800 text-sm leading-tight mb-1 group-hover:text-purple-600 transition-colors">{b.bundle_name}</p>
                        <p className="text-purple-600 font-bold text-sm">Rp {formatCurrency(Number(b.price || 0))}</p>
                      </div>
                      <div className="flex items-center">
                        {added ? (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Dipilih</span>
                        ) : (
                          <button className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredBundlings.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500">
                    <p>Bundling tidak ditemukan.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Hadiah */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 text-lg">Daftar Hadiah</h2>
                <button type="button" onClick={() => setShowGiftModal(true)} className="px-4 py-2 bg-purple-200 hover:bg-purple-300 text-purple-900 rounded-lg shadow-sm text-sm font-semibold transition-colors flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Tambah Hadiah
                </button>
              </div>

              {cart.filter(item => item.is_gift).length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-slate-500">
                  <Package className="w-12 h-12 mb-2 text-slate-300" />
                  <p>Belum ada hadiah yang ditambahkan.</p>
                  <p className="text-xs mt-1">Klik "+ Tambah Hadiah" untuk memilih hadiah.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-4 font-medium w-1/2">Hadiah</th>
                        <th className="p-4 font-medium text-right w-1/6">Harga</th>
                        <th className="p-4 font-medium text-right w-1/6">Diskon</th>
                        <th className="p-4 font-medium text-center w-1/6">Qty</th>
                        <th className="p-4 font-medium text-right w-1/6">Subtotal</th>
                        <th className="p-4 font-medium text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cart.map((item, idx) => item.is_gift && (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover border border-slate-200" />
                              ) : (
                                <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400 border border-slate-300"><Package className="w-6 h-6" /></div>
                              )}
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{item.product_name}</p>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full mt-1 inline-block">Hadiah Gratis</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right text-sm font-medium text-slate-600">
                            Gratis
                          </td>
                          <td className="p-4 text-right">-</td>
                          <td className="p-4 text-center">
                            <input type="number" min="1" value={item.qty} onChange={e => updateCartQty(idx, parseInt(e.target.value) || 1)} className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-purple-300 text-sm font-medium" />
                          </td>
                          <td className="p-4 text-right font-bold text-slate-800">Rp 0</td>
                          <td className="p-4 text-center">
                            <button type="button" onClick={() => removeCartItem(idx)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          {/* KOLOM PEMBAYARAN & RINGKASAN */}
          <div className="space-y-6">

            {/* Pembayaran */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-800">Pembayaran</h2>
              </div>

              <div className="p-5 border-b border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Metode Pembayaran</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm font-medium">
                    {(() => {
                      const selectedCourierOpt = availableCouriers.find(c => c.warehouseId === warehouseId && c.courierName === courierName);
                      const currentOoc = selectedCourierOpt?.outOfCoverage?.trim().toUpperCase() || '';
                      
                      if (currentOoc === 'ALL') {
                        return (
                          <>
                            <option value="bank_transfer">Bank Transfer (Manual)</option>
                            <option value="cod">Cash on Delivery (COD)</option>
                            <option value="free">Free / Tanpa Pembayaran</option>
                          </>
                        );
                      } else if (currentOoc === 'TF') {
                        return (
                          <option value="bank_transfer">Bank Transfer (Manual)</option>
                        );
                      } else {
                        return (
                          <option value="" disabled>Metode Pembayaran Tidak Tersedia (OOC: Kosong / Lainnya)</option>
                        );
                      }
                    })()}
                  </select>
                </div>

                {paymentMethod === 'bank_transfer' && (
                  <div className="p-4 bg-violet-50/50 border border-violet-100 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-purple-500 mb-1">Rekening Tujuan *</label>
                      <select required value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 outline-none focus:border-purple-300 text-sm">
                        <option value="">Pilih Rekening...</option>
                        {data?.paymentAccounts.map(p => <option key={p.id} value={p.id}>{p.bank_name} - {p.account_name} ({p.account_number})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-500 mb-1">Upload Bukti Transfer</label>
                      <input type="file" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setPaymentProofFile(f); setPaymentProofPreview(URL.createObjectURL(f)); }
                      }} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-violet-100 file:text-purple-500 hover:file:bg-violet-200" />
                      {paymentProofPreview && <img src={paymentProofPreview} alt="Preview" className="mt-2 h-24 rounded-lg object-cover border border-violet-200" />}
                    </div>
                  </div>
                )}

                {paymentMethod === 'free' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Alasan Free *</label>
                      <select required value={noPaymentMethodId} onChange={e => setNoPaymentMethodId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-slate-500 text-sm">
                        <option value="">Pilih Alasan...</option>
                        {data?.noPaymentMethods.map(p => <option key={p.id} value={p.id}>{p.method_name}</option>)}
                      </select>
                    </div>
                    {noShippingCostForFreeMethod && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        Metode ini tidak membebankan ongkos kirim.
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Upload Bukti Approval</label>
                      <input type="file" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setPaymentProofFile(f); setPaymentProofPreview(URL.createObjectURL(f)); }
                      }} className="w-full text-sm" />
                    </div>
                  </div>
                )}
              </div>

            </div>

            </div>
            {/* Pengiriman & Kurir */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800">Pengiriman & Logistik</h2>
                <button type="button" onClick={() => setShowCourierModal(true)} disabled={availableCouriers.length === 0} className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700 disabled:opacity-50">Ubah Kurir</button>
              </div>
              <div className="p-5">
                {warehouseId ? (
                  <div className="flex items-start gap-4 p-4 border border-violet-100 bg-violet-50/50 rounded-xl">
                    <div className="p-2 bg-violet-100 text-purple-400 rounded-lg"><MapPin className="w-6 h-6" /></div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        {courierName} <span className="text-purple-400">- {bestOriginStr.toUpperCase()}</span>
                        {(() => {
                          const selectedOpt = availableCouriers.find(c => c.warehouseId === warehouseId && c.courierName === courierName);
                          const ooc = selectedOpt?.outOfCoverage?.trim().toUpperCase();
                          return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ooc === 'ALL' ? 'bg-emerald-100 text-emerald-700' : ooc === 'TF' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>Ketersediaan Pembayaran : {selectedOpt?.outOfCoverage || 'KOSONG'}</span>
                        })()}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">Gudang Asal: <strong>{selectedWarehouseData?.warehouse_name}</strong></p>
                      <p className="text-sm font-bold text-purple-500 mt-2">Biaya Ongkir: Rp {formatCurrency(effectiveShippingCost)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-amber-600 bg-amber-50 rounded-xl border border-amber-100 text-sm font-medium">
                    {cart.length === 0 ? "Tambahkan produk terlebih dahulu" : "Pilih kecamatan untuk melihat opsi ongkir"}
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Extra */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-800">Data Tambahan</h2>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Usia Pelanggan</label>
                  <input value={age} onChange={e => setAge(e.target.value)} type="number" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm" placeholder="Contoh: 45" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Promo</label>
                  <Select
                    isMulti
                    value={promoIds}
                    onChange={(newVal) => setPromoIds(newVal as any[])}
                    options={data?.promos.map(p => ({ value: p.id, label: p.promo_name })) || []}
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
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Keluhan Pelanggan</label>
                  <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm" placeholder="Tulis riwayat sakit..."></textarea>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Catatan Internal</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-purple-300 outline-none text-sm" placeholder="Catatan khusus..."></textarea>
                </div>
              </div>
            </div>

            {/* Ringkasan */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-800">Ringkasan</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Total Harga Produk</span>
                  <span className="font-bold text-slate-800">Rp {formatCurrency(totals.subtotalProducts)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Diskon Produk Ekstra</span>
                  <div className="flex items-center gap-2">
                    <span className="text-rose-500 font-bold">- Rp</span>
                    <input type="number" min="0" value={productDiscount} onChange={e => setProductDiscount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} className="w-28 text-right border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 outline-none text-rose-600 font-bold focus:border-rose-400 focus:bg-white transition-colors" />
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Ongkos Kirim</span>
                  <span className="font-bold text-slate-800">Rp {formatCurrency(shippingCost)}</span>
                </div>

                {paymentMethod === 'cod' && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Biaya COD (Manual)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-bold">+ Rp</span>
                      <input type="number" min="0" value={manualFeeCod} onChange={e => setManualFeeCod(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} className="w-28 text-right border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 outline-none text-slate-800 font-bold focus:border-violet-300 focus:bg-white transition-colors" />
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Biaya Lainnya</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">+ Rp</span>
                    <input type="number" min="0" value={otherFee} onChange={e => setOtherFee(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} className="w-28 text-right border border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 outline-none text-slate-800 font-bold focus:border-violet-300 focus:bg-white transition-colors" />
                  </div>
                </div>
                
                <div className="pt-5 mt-5 border-t border-slate-200 border-dashed flex justify-between items-center">
                  <span className="font-bold text-slate-800 uppercase tracking-wide">Total Pembayaran</span>
                  <span className="text-2xl font-black text-purple-500 tracking-tight">Rp {formatCurrency(totalPayment)}</span>
                </div>
              </div>

              <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                <button type="submit" disabled={submitting} className="w-full bg-purple-200 hover:bg-purple-300 text-purple-900 font-bold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(216,180,226,0.5)] hover:shadow-[0_6px_20px_rgba(216,180,226,0.6)] hover:-translate-y-0.5 transform transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0 flex justify-center items-center gap-2 text-sm tracking-wide">
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> MEMPROSES...</> : 'BUAT PESANAN SEKARANG'}
                </button>
              </div>
            </div>
          </div>

          </div>

      </form>

      {/* MODAL PRODUK */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800">Pilih Produk</h3>
              <button type="button" onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <input type="text" placeholder="Cari nama produk..." value={productSearchKeyword} onChange={e => setProductSearchKeyword(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-purple-300 text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" /> : <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-slate-400" /></div>}
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{p.product_name}</p>
                      <p className="text-xs text-purple-400 font-semibold mt-0.5">Rp {formatCurrency(p.price)} <span className="text-slate-400 font-normal ml-1">• Stok: {p.total_stock}</span></p>
                    </div>
                  </div>
                  <button type="button" disabled={p.total_stock <= 0} onClick={() => handleAddToCart(p, false)} className="px-3 py-1.5 bg-violet-100 text-purple-500 hover:bg-violet-200 rounded-lg text-xs font-bold disabled:opacity-50">Tambah</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HADIAH */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800">Pilih Hadiah Gratis</h3>
              <button type="button" onClick={() => setShowGiftModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <input type="text" placeholder="Cari nama hadiah..." value={giftSearchKeyword} onChange={e => setGiftSearchKeyword(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-emerald-500 text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredGifts.map(g => (
                <div key={g.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    {g.image_url ? <img src={g.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" /> : <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-slate-400" /></div>}
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{g.gift_name}</p>
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">Gratis <span className="text-slate-400 font-normal ml-1">• Stok: {g.total_stock}</span></p>
                    </div>
                  </div>
                  <button type="button" disabled={g.total_stock <= 0} onClick={() => handleAddToCart(g, true)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-bold disabled:opacity-50">Tambah</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL COURIER / PENGIRIMAN */}
      {showCourierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800">Opsi Kurir & Gudang</h3>
              <button type="button" onClick={() => setShowCourierModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {availableCouriers.map((c, i) => (
                <label key={i} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${c.outOfStock ? 'opacity-50 grayscale bg-slate-50' : 'hover:border-violet-300 border-slate-200'} ${warehouseId === c.warehouseId && courierName === c.courierName ? 'border-purple-300 bg-violet-50/50 ring-1 ring-purple-300' : ''}`}>
                  <input type="radio" name="courierSelection" disabled={c.outOfStock} checked={warehouseId === c.warehouseId && courierName === c.courierName} onChange={() => {
                    setWarehouseId(c.warehouseId);
                    setCourierName(c.courierName);
                    setShippingCost(c.price);
                    setBestOriginStr(c.origin);
                    setShowCourierModal(false);
                  }} className="mt-1 text-purple-400 focus:ring-purple-300" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm uppercase">
                      {c.courierName} <span className="text-purple-400 font-semibold ml-1">- {c.origin}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ml-2 ${c.outOfCoverage?.trim().toUpperCase() === 'ALL' ? 'bg-emerald-100 text-emerald-700' : c.outOfCoverage?.trim().toUpperCase() === 'TF' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>Ketersediaan Pembayaran : {c.outOfCoverage || 'KOSONG'}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Estimasi: {c.estimation || 'Reguler'}</p>
                    <p className="font-bold text-purple-500 mt-2">Rp {formatCurrency(c.price)}</p>
                    {c.outOfStock && <p className="text-[10px] text-red-500 font-bold mt-1">Stok Habis di Gudang Ini</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
