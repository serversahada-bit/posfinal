'use client';

import React, { useState, useEffect } from 'react';
import { Package, Search, RefreshCw, ChevronDown, ChevronUp, Box } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DaftarBundlingPage() {
  const [bundles, setBundles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for expanded rows and their contents
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [bundleContents, setBundleContents] = useState<Record<number, any[]>>({});
  const [loadingContents, setLoadingContents] = useState<Record<number, boolean>>({});

  const fetchBundles = async () => {
    setIsLoading(true);
    setExpandedId(null);
    try {
      const res = await fetch('/api/scalev/bundles');
      const json = await res.json();
      if (json.success) {
        setBundles(json.data);
      } else {
        Swal.fire('Gagal', json.message || 'Gagal mengambil data bundling', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Terjadi kesalahan pada jaringan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBundles();
  }, []);

  const toggleExpand = async (bundleId: number) => {
    if (expandedId === bundleId) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(bundleId);
    
    // If we haven't fetched the contents for this bundle yet, fetch it
    if (!bundleContents[bundleId]) {
      setLoadingContents(prev => ({ ...prev, [bundleId]: true }));
      try {
        const res = await fetch(`/api/scalev/bundles/${bundleId}`);
        const json = await res.json();
        if (json.success) {
          setBundleContents(prev => ({ ...prev, [bundleId]: json.data }));
        } else {
          console.error(json.message);
        }
      } catch (err) {
        console.error("Gagal menarik detail bundling", err);
      } finally {
        setLoadingContents(prev => ({ ...prev, [bundleId]: false }));
      }
    }
  };

  const filteredBundles = bundles.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.public_name && b.public_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format currency
  const formatRupiah = (amount: string | number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(amount));
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f9] pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Daftar Bundling Scalev</h1>
            <p className="text-sm text-gray-500">Menampilkan semua bundling beserta isi produknya dari akun Scalev Anda.</p>
          </div>
        </div>
        
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari bundling..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-64"
            />
          </div>
          
          <button 
            onClick={fetchBundles}
            disabled={isLoading}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin text-purple-600" : ""} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Internal</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Publik</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tgl Dibuat</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Jml Varian</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <RefreshCw size={28} className="animate-spin text-purple-600 mb-3" />
                      <p>Mengambil data dari Scalev...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredBundles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    {searchQuery ? 'Tidak ada bundling yang cocok dengan pencarian.' : 'Belum ada data bundling di akun Scalev Anda.'}
                  </td>
                </tr>
              ) : (
                filteredBundles.map((b) => (
                  <React.Fragment key={b.id}>
                    <tr 
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expandedId === b.id ? 'bg-purple-50/30' : ''}`}
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {b.id}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {b.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {b.public_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {b.status === 'active' ? (
                          <span className="inline-block bg-emerald-50 text-emerald-600 font-semibold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block bg-gray-100 text-gray-500 font-semibold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide">
                            {b.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => toggleExpand(b.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-purple-600 transition-colors"
                        >
                          <Box size={14} /> 
                          {expandedId === b.id ? 'Tutup Isi' : 'Lihat Isi'}
                          {expandedId === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expandable Row Content */}
                    {expandedId === b.id && (
                      <tr className="bg-purple-50/20 border-b border-gray-200">
                        <td colSpan={7} className="px-6 py-0">
                          <div className="py-4 pl-12 pr-6">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Isi Produk Dalam Bundling:</h4>
                            
                            {loadingContents[b.id] ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                                <RefreshCw size={16} className="animate-spin text-purple-600" /> Memuat isi produk...
                              </div>
                            ) : bundleContents[b.id] && bundleContents[b.id].length > 0 ? (
                              <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500">Nama Produk</th>
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-center">Qty</th>
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Harga Satuan</th>
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bundleContents[b.id].map((item: any, idx: number) => (
                                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                                        <td className="px-4 py-2.5 text-sm text-gray-700 flex items-center gap-3">
                                          {item.variant?.images?.[0] ? (
                                            <img src={item.variant.images[0]} alt={item.variant.product_name} className="w-8 h-8 object-cover rounded border border-gray-200" />
                                          ) : (
                                            <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                                              <Box size={14} className="text-gray-400" />
                                            </div>
                                          )}
                                          <span>
                                            <div className="font-medium">{item.variant?.product_name || 'Unknown Product'}</div>
                                            <div className="text-xs text-gray-400">{item.variant?.sku || 'No SKU'}</div>
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-700 text-center">
                                          {item.quantity}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-gray-600 text-right">
                                          {formatRupiah(item.variant?.price || 0)}
                                        </td>
                                        <td className="px-4 py-2.5 text-sm font-medium text-purple-700 text-right bg-purple-50/30">
                                          {formatRupiah(item.subtotal || 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 py-3 italic bg-white border border-gray-200 rounded px-4">
                                Tidak ada produk di dalam bundling ini.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
