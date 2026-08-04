import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Copy, RefreshCw, Trash2, Globe, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface CustomDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  landingPage: any; // LP object from page.tsx
  onSuccess: () => void; // callback to refresh table
}

export default function CustomDomainModal({ isOpen, onClose, landingPage, onSuccess }: CustomDomainModalProps) {
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  // Data from LP
  const cfStatus = landingPage?.domain_status;
  const cfDomain = landingPage?.domain;
  const hostnameId = landingPage?.cf_hostname_id;
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && landingPage) {
      setDomain(cfDomain || '');
    }
  }, [isOpen, landingPage, cfDomain]);

  if (!isOpen || !landingPage) return null;

  const handleRegister = async () => {
    if (!domain) return Swal.fire('Error', 'Domain wajib diisi', 'error');
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/custom-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          landingPageId: landingPage.id, 
          customDomain: domain 
        })
      });
      const json = await res.json();
      
      if (res.ok) {
        Swal.fire('Berhasil', 'Domain didaftarkan. Selesaikan verifikasi DNS.', 'success');
        onSuccess();
      } else {
        Swal.fire('Error', json.error || 'Gagal', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Internal error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!hostnameId) return;
    setIsChecking(true);
    try {
      const res = await fetch(`/api/custom-domain?id=${hostnameId}&lpId=${landingPage.id}`);
      const json = await res.json();
      if (res.ok) {
        if (json.data.status === 'active' && json.data.sslStatus === 'active') {
          Swal.fire('Berhasil', 'Domain sudah aktif dan terverifikasi!', 'success');
          onSuccess();
        } else {
          Swal.fire('Status', `Status Hostname: ${json.data.status}, SSL: ${json.data.sslStatus}`, 'info');
        }
      }
    } catch (err) {
      Swal.fire('Error', 'Gagal cek status', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Hapus Custom Domain?',
      text: "Domain ini akan dilepas dari Landing Page ini.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus'
    });
    
    if (result.isConfirmed) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/custom-domain?id=${hostnameId || ''}&lpId=${landingPage.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          Swal.fire('Dihapus', 'Custom domain berhasil dihapus', 'success');
          setDomain('');
          onSuccess();
        }
      } catch (err) {
        Swal.fire('Error', 'Gagal menghapus', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      title: 'Disalin!',
      toast: true,
      position: 'top-end',
      timer: 1500,
      showConfirmButton: false,
      icon: 'success'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 font-sans">
      <div className={`bg-white rounded shadow-xl w-full flex flex-col ${!hostnameId ? 'max-w-md' : 'max-w-2xl'}`}>
        
        {/* Header */}
        <div className="px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            {!hostnameId ? 'Tambah Domain' : `Domain ${cfDomain}`}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 overflow-y-auto max-h-[70vh]">
          {!hostnameId ? (
            // Form Tambah Domain
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Masukkan domain pribadi Kamu di bawah ini.
              </p>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1">
                  Domain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0ea5e9] focus:ring-1 focus:ring-[#0ea5e9] transition-colors"
                />
              </div>
            </div>
          ) : (
            // Domain Sudah Terdaftar (Pending atau Active)
            <div className="space-y-4">
              {cfStatus !== 'active' && (
                <>
                  <div className="bg-[#fff9e6] border border-[#ffecb3] p-4 rounded text-[13px] text-gray-800 flex gap-3">
                    <Info className="text-yellow-600 shrink-0" size={18} />
                    <p><strong>Langkah Terakhir:</strong> Buka pengaturan DNS di tempat Anda membeli domain (misal: Hostinger, Niagahoster), lalu tambahkan data CNAME/TXT di bawah ini.</p>
                  </div>
                  
                  {/* CNAME Target */}
                  <div className="bg-[#f8f9fa] rounded p-4">
                    <table className="w-full text-left mb-3">
                      <thead>
                        <tr>
                          <th className="text-[13px] font-normal text-gray-500 pb-1 w-1/4">Type</th>
                          <th className="text-[13px] font-normal text-gray-500 pb-1 w-2/4">Name</th>
                          <th className="text-[13px] font-normal text-gray-500 pb-1 w-1/4 text-right">TTL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-[13px] font-semibold text-gray-800">CNAME</td>
                          <td className="text-[13px] font-semibold text-gray-800">@</td>
                          <td className="text-[13px] font-semibold text-gray-800 text-right">Auto</td>
                        </tr>
                      </tbody>
                    </table>
                    <div>
                      <div className="text-[13px] font-normal text-gray-500 mb-1">Target</div>
                      <div className="text-[13px] font-semibold text-gray-800 break-all flex items-center justify-between group">
                        pos.ptslu.cloud
                        <button onClick={() => copyToClipboard('pos.ptslu.cloud')} className="text-gray-400 hover:text-[#0ea5e9] opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* SSL TXT */}
                  {landingPage.cf_ssl_name && (
                    <div className="bg-[#f8f9fa] rounded p-4">
                      <table className="w-full text-left mb-3">
                        <thead>
                          <tr>
                            <th className="text-[13px] font-normal text-gray-500 pb-1 w-1/4">Type</th>
                            <th className="text-[13px] font-normal text-gray-500 pb-1 w-2/4">Name</th>
                            <th className="text-[13px] font-normal text-gray-500 pb-1 w-1/4 text-right">TTL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-[13px] font-semibold text-gray-800">TXT</td>
                            <td className="text-[13px] font-semibold text-gray-800">{landingPage.cf_ssl_name}</td>
                            <td className="text-[13px] font-semibold text-gray-800 text-right">Auto</td>
                          </tr>
                        </tbody>
                      </table>
                      <div>
                        <div className="text-[13px] font-normal text-gray-500 mb-1">Target</div>
                        <div className="text-[13px] font-semibold text-gray-800 break-all flex items-center justify-between group">
                          {landingPage.cf_ssl_value}
                          <button onClick={() => copyToClipboard(landingPage.cf_ssl_value)} className="text-gray-400 hover:text-[#0ea5e9] opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={14} /></button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ownership TXT */}
                  {landingPage.cf_ownership_name && (
                    <div className="bg-[#f8f9fa] rounded p-4">
                      <table className="w-full text-left mb-3">
                        <thead>
                          <tr>
                            <th className="text-[13px] font-normal text-gray-500 pb-1 w-1/4">Type</th>
                            <th className="text-[13px] font-normal text-gray-500 pb-1 w-2/4">Name</th>
                            <th className="text-[13px] font-normal text-gray-500 pb-1 w-1/4 text-right">TTL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-[13px] font-semibold text-gray-800">TXT</td>
                            <td className="text-[13px] font-semibold text-gray-800">{landingPage.cf_ownership_name}</td>
                            <td className="text-[13px] font-semibold text-gray-800 text-right">Auto</td>
                          </tr>
                        </tbody>
                      </table>
                      <div>
                        <div className="text-[13px] font-normal text-gray-500 mb-1">Target</div>
                        <div className="text-[13px] font-semibold text-gray-800 break-all flex items-center justify-between group">
                          {landingPage.cf_ownership_value}
                          <button onClick={() => copyToClipboard(landingPage.cf_ownership_value)} className="text-gray-400 hover:text-[#0ea5e9] opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={14} /></button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pb-2">
                    <button 
                      onClick={handleCheckStatus}
                      disabled={isChecking}
                      className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-5 py-2.5 rounded text-[13px] font-medium transition-colors flex items-center gap-2"
                    >
                      {isChecking ? <RefreshCw size={16} className="animate-spin" /> : null}
                      Verifikasi
                    </button>
                  </div>
                </>
              )}
              
              {cfStatus === 'active' && (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Domain Terverifikasi</h3>
                  <p className="text-sm text-gray-500">Domain {cfDomain} sudah terhubung dengan aman.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!hostnameId ? (
          <div className="px-6 pb-6 pt-2 flex justify-end gap-3">
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleRegister} 
              disabled={isLoading} 
              className="px-4 py-2 text-[13px] font-medium text-white bg-[#0ea5e9] hover:bg-[#0284c7] rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Menyimpan...' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 flex justify-between items-center bg-white border-t border-gray-100">
            <button 
              onClick={handleDelete}
              className="text-[#ef4444] hover:text-red-700 text-[13px] font-medium transition-colors"
            >
              Hapus Domain
            </button>
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
