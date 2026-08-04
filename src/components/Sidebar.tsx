'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import {
    type LucideIcon,
    LayoutDashboard,
    ShoppingCart, 
    CheckSquare, 
    PackageOpen, 
    Package, 
    Tag, 
    UserCircle, 
    Globe, 
    Gift, 
    Layers, 
    Truck, 
    Banknote, 
    Plane,
    Plus,
    Warehouse,
    CreditCard,
    UserCog,
    Activity,
    ChevronDown,
    X,
    LogOut,
    Settings
} from 'lucide-react';

type NavItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
};

type SubmenuItemProps = {
  href: string;
  label: string;
  active: boolean;
};

function NavItem({ href, icon: Icon, label, active }: NavItemProps) {
  return (
    <Link href={href} className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}>
      <span className="sidebar__label-wrap">
        <Icon className="sidebar__icon" size={18} strokeWidth={1.9} />
        <span className="sidebar__link-text">{label}</span>
      </span>
    </Link>
  );
}

function SubmenuItem({ href, label, active, count }: SubmenuItemProps & { count?: number }) {
  return (
    <Link href={href} className={`sidebar__sublink ${active ? 'sidebar__sublink--active' : ''} flex items-center justify-between`}>
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ isOpen = false, onClose = () => {} }: { isOpen?: boolean, onClose?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [problemCount, setProblemCount] = useState(0);

  const fetchProblemCount = useCallback(async () => {
    try {
      const res = await fetch('/api/olahan?status=problem', { cache: 'no-store' });
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setProblemCount(json.data.length);
      }
    } catch (err) {
      console.error('Failed to fetch problem count:', err);
    }
  }, []);

  useEffect(() => {
    void fetchProblemCount();
  }, [fetchProblemCount, pathname]);

  // Close sidebar on route change on mobile
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useSocketEvent('NEW_ORDER', () => {
    const audio = new Audio('/notif.mp3');
    audio.play().catch(e => console.error(e));
  });

  useSocketEvent('NEW_OLAHAN', () => {
    const audio = new Audio('/notif.mp3');
    audio.play().catch(e => console.error('Audio play error (requires user interaction first):', e));
    void fetchProblemCount();
  });

  useSocketEvent('REFRESH_OLAHAN', () => {
    void fetchProblemCount();
  });

  const roleInitial = user?.name?.charAt(0)?.toUpperCase() || 'A';
  const userRole = user?.role ?? '';
  const permissions = user?.permissions ?? [];

  const hasAccess = (menuKey: string) => {
    if (userRole === 'admin' || userRole === 'owner') return true;
    const roleMapping: Record<string, string[]> = {
      'dashboard': ['finance', 'cs', 'cs_crm', 'warehouse'],
      'buat_pesanan': ['cs', 'cs_crm'],
      'produk': ['warehouse'],
      'pembelian_terbaru': ['finance'],
      'olahan': ['finance'],
    };
    if (roleMapping[menuKey]?.includes(userRole)) return true;
    return permissions.includes(menuKey);
  };

  const toggleSubmenu = (menu: string) => {
    setOpenSubmenu(openSubmenu === menu ? null : menu);
  };

  const isPesananActive = ['/buat_pesanan', '/buat_pesanan_cso', '/buat_pesanan_crm', '/buat_pesanan_resend', '/orders'].includes(pathname);
  const isDataPesananActive = pathname === '/olahan';
  const isDataLengkapActive = pathname === '/data_lengkap_customer';
  const isGudangActive = ['/setting_gudang', '/stok_produk', '/stok_hadiah'].includes(pathname);
  const isPembayaranActive = ['/setting_payment', '/setting_no_payment'].includes(pathname);

  const hasPengaturanAccess = hasAccess('produk') || hasAccess('promo') || hasAccess('advertiser') || hasAccess('sumber_iklan') || hasAccess('hadiah') || hasAccess('bundling') || hasAccess('biaya_ongkir') || hasAccess('penambahan_ekspedisi') || hasAccess('penambahan_ongkir') || hasAccess('gudang') || hasAccess('pembayaran') || hasAccess('scalev');

  return (
    <>
      <div 
        className={`sidebar__overlay ${isOpen ? 'sidebar__overlay--open' : ''}`} 
        onClick={onClose}
        aria-hidden="true"
      />

      <aside 
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} 
      >
        <div className="sidebar__header">
            <div className="sidebar__brand">
                <div className="sidebar__brand-mark">
                    <Image src="/app-logo.png" alt="GreatSales logo" fill className="sidebar__brand-image" sizes="40px" />
                </div>
                <div>
                    <h2 className="sidebar__brand-title">GreatSales</h2>
                    <p className="sidebar__brand-subtitle">Sales System</p>
                </div>
            </div>
            <button onClick={onClose} className="sidebar__close">
               <X size={20} />
            </button>
        </div>

        <nav className="sidebar__nav custom-scrollbar">
            <div className="sidebar__section">
                <p className="sidebar__section-title">Menu Utama</p>
                <div className="sidebar__list">

                {hasAccess('dashboard') && <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === '/dashboard'} />}
                {hasAccess('dashboard') && <NavItem href="/landing-page" icon={Globe} label="Landing Page" active={pathname === '/landing-page'} />}

                {hasAccess('buat_pesanan') && (
                <div>
                    <button 
                      className={`sidebar__toggle ${(isPesananActive || openSubmenu === 'pesanan') ? 'sidebar__toggle--active' : ''}`} 
                      onClick={() => toggleSubmenu('pesanan')}
                    >
                        <span className="sidebar__label-wrap">
                            <ShoppingCart className="sidebar__icon" size={18} strokeWidth={1.9} />
                            <span className="sidebar__link-text">Buat Pesanan</span>
                        </span>
                        <ChevronDown className={`sidebar__chevron ${(isPesananActive || openSubmenu === 'pesanan') ? 'sidebar__chevron--open' : ''}`} size={16} />
                    </button>
                    
                    <div className={`sidebar__submenu ${(isPesananActive || openSubmenu === 'pesanan') ? '' : 'sidebar__submenu--closed'}`}>
                        <SubmenuItem href="/buat_pesanan" label="Akuisisi" active={pathname === '/buat_pesanan' || pathname === '/orders'} />
                        <SubmenuItem href="/buat_pesanan_cso" label="CSO" active={pathname === '/buat_pesanan_cso'} />
                        <SubmenuItem href="/buat_pesanan_crm" label="CRM" active={pathname === '/buat_pesanan_crm'} />
                        <SubmenuItem href="/buat_pesanan_resend" label="Resend" active={pathname === '/buat_pesanan_resend'} />
                    </div>
                </div>
                )}

                {hasAccess('validasi_fat') && <NavItem href="/validasi_pembayaran" icon={CheckSquare} label="Validasi FAT" active={pathname === '/validasi_pembayaran'} />}
                {hasAccess('olahan') && (
                <div>
                    <button
                      className={`sidebar__toggle ${(isDataPesananActive || openSubmenu === 'data-pesanan') ? 'sidebar__toggle--active' : ''}`}
                      onClick={() => toggleSubmenu('data-pesanan')}
                    >
                        <span className="sidebar__label-wrap">
                            <PackageOpen className="sidebar__icon" size={18} strokeWidth={1.9} />
                            <span className="sidebar__link-text">Data Pesanan</span>
                        </span>
                        <ChevronDown className={`sidebar__chevron ${(isDataPesananActive || openSubmenu === 'data-pesanan') ? 'sidebar__chevron--open' : ''}`} size={16} />
                    </button>
                    
                    <div className={`sidebar__submenu ${(isDataPesananActive || openSubmenu === 'data-pesanan') ? '' : 'sidebar__submenu--closed'}`}>
                        <SubmenuItem href="/olahan" label="Semua Status" active={pathname === '/olahan' && !searchParams.has('status') && !searchParams.has('sort')} />
                        <SubmenuItem href="/olahan?sort=created_at" label="Create Order" active={pathname === '/olahan' && searchParams.get('sort') === 'created_at'} />
                        <SubmenuItem href="/olahan?sort=processing_at" label="Processing At" active={pathname === '/olahan' && searchParams.get('sort') === 'processing_at'} />
                        <SubmenuItem href="/olahan?sort=last_update" label="Last Update" active={pathname === '/olahan' && searchParams.get('sort') === 'last_update'} />
                        <SubmenuItem href="/olahan?status=problem" label="Problem" active={pathname === '/olahan' && searchParams.get('status') === 'problem'} count={problemCount} />
                    </div>
                </div>
                )}
                {hasAccess('olahan') && (
                <div>
                    <button
                      className={`sidebar__toggle ${(isDataLengkapActive || openSubmenu === 'data-lengkap') ? 'sidebar__toggle--active' : ''}`}
                      onClick={() => toggleSubmenu('data-lengkap')}
                    >
                        <span className="sidebar__label-wrap">
                            <PackageOpen className="sidebar__icon" size={18} strokeWidth={1.9} />
                            <span className="sidebar__link-text">Data Lengkap</span>
                        </span>
                        <ChevronDown className={`sidebar__chevron ${(isDataLengkapActive || openSubmenu === 'data-lengkap') ? 'sidebar__chevron--open' : ''}`} size={16} />
                    </button>

                    <div className={`sidebar__submenu ${(isDataLengkapActive || openSubmenu === 'data-lengkap') ? '' : 'sidebar__submenu--closed'}`}>
                        <SubmenuItem href="/data_lengkap_customer" label="Semua Status" active={pathname === '/data_lengkap_customer' && !searchParams.has('status') && !searchParams.has('sort')} />
                        <SubmenuItem href="/data_lengkap_customer?sort=created_at" label="Create Order" active={pathname === '/data_lengkap_customer' && searchParams.get('sort') === 'created_at'} />
                        <SubmenuItem href="/data_lengkap_customer?sort=processing_at" label="Processing At" active={pathname === '/data_lengkap_customer' && searchParams.get('sort') === 'processing_at'} />
                        <SubmenuItem href="/data_lengkap_customer?sort=last_update" label="Last Update" active={pathname === '/data_lengkap_customer' && searchParams.get('sort') === 'last_update'} />
                        <SubmenuItem href="/data_lengkap_customer?status=problem" label="Problem" active={pathname === '/data_lengkap_customer' && searchParams.get('status') === 'problem'} count={problemCount} />
                        <SubmenuItem href="/data_lengkap_customer?status=rts" label="Khusus Retur" active={pathname === '/data_lengkap_customer' && searchParams.get('status') === 'rts'} />
                    </div>
                </div>
                )} 
                </div>
            </div>

            {hasPengaturanAccess && (
            <div className="sidebar__section">
                <p className="sidebar__section-title">Pengaturan</p>
                <div className="sidebar__list">

                {hasAccess('produk') && <NavItem href="/products" icon={Package} label="Produk" active={pathname === '/products'} />}
                {hasAccess('promo') && <NavItem href="/promo" icon={Tag} label="Promo" active={pathname === '/promo'} />}
                {hasAccess('advertiser') && <NavItem href="/advertiser" icon={UserCircle} label="Advertiser" active={pathname === '/advertiser'} />}
                {hasAccess('sumber_iklan') && <NavItem href="/ad_source" icon={Globe} label="Sumber Iklan" active={pathname === '/ad_source'} />}
                {hasAccess('hadiah') && <NavItem href="/gifts" icon={Gift} label="Hadiah" active={pathname === '/gifts'} />}
                {hasAccess('bundling') && <NavItem href="/bundling" icon={Layers} label="Bundling" active={pathname === '/bundling'} />}
                {hasAccess('biaya_ongkir') && <NavItem href="/pengaturan_ongkir" icon={Truck} label="Pengaturan Ongkir" active={pathname === '/pengaturan_ongkir'} />}
                {hasAccess('biaya_ongkir') && <NavItem href="/biaya_ongkir" icon={Banknote} label="Biaya Ongkir" active={pathname === '/biaya_ongkir'} />}
                {hasAccess('penambahan_ekspedisi') && <NavItem href="/penambahan_ekspedisi" icon={Plane} label="Penambahan Ekspedisi" active={pathname === '/penambahan_ekspedisi'} />}
                {hasAccess('penambahan_ongkir') && <NavItem href="/penambahan_ongkir" icon={Plus} label="Penambahan Ongkir" active={pathname === '/penambahan_ongkir'} />}

                {hasAccess('gudang') && (
                <div>
                    <button 
                      className={`sidebar__toggle ${(isGudangActive || openSubmenu === 'gudang') ? 'sidebar__toggle--active' : ''}`} 
                      onClick={() => toggleSubmenu('gudang')}
                    >
                        <span className="sidebar__label-wrap">
                            <Warehouse className="sidebar__icon" size={18} strokeWidth={1.9} />
                            <span className="sidebar__link-text">Gudang</span>
                        </span>
                        <ChevronDown className={`sidebar__chevron ${(isGudangActive || openSubmenu === 'gudang') ? 'sidebar__chevron--open' : ''}`} size={16} />
                    </button>
                    
                    <div className={`sidebar__submenu ${(isGudangActive || openSubmenu === 'gudang') ? '' : 'sidebar__submenu--closed'}`}>
                        <SubmenuItem href="/setting_gudang" label="Setting Gudang" active={pathname === '/setting_gudang'} />
                        <SubmenuItem href="/stok_produk" label="Stok Produk" active={pathname === '/stok_produk'} />
                        <SubmenuItem href="/stok_hadiah" label="Stok Hadiah" active={pathname === '/stok_hadiah'} />
                    </div>
                </div>
                )}

                {hasAccess('scalev') && (
                <div>
                    <button 
                      className={`sidebar__toggle ${(pathname.startsWith('/setting_scalev') || pathname.startsWith('/scalev_ubah_status') || pathname.startsWith('/scalev_bundling') || openSubmenu === 'scalev') ? 'sidebar__toggle--active' : ''}`} 
                      onClick={() => toggleSubmenu('scalev')}
                    >
                        <span className="sidebar__label-wrap">
                            <Settings className="sidebar__icon" size={18} strokeWidth={1.9} />
                            <span className="sidebar__link-text">Scalev</span>
                        </span>
                        <ChevronDown className={`sidebar__chevron ${(pathname.startsWith('/setting_scalev') || pathname.startsWith('/scalev_ubah_status') || pathname.startsWith('/scalev_bundling') || openSubmenu === 'scalev') ? 'sidebar__chevron--open' : ''}`} size={16} />
                    </button>
                    
                    <div className={`sidebar__submenu ${(pathname.startsWith('/setting_scalev') || pathname.startsWith('/scalev_ubah_status') || pathname.startsWith('/scalev_bundling') || openSubmenu === 'scalev') ? '' : 'sidebar__submenu--closed'}`}>
                        <SubmenuItem href="/setting_scalev" label="Pengaturan API" active={pathname === '/setting_scalev'} />
                        <SubmenuItem href="/scalev_ubah_status" label="Ubah Status Pesanan" active={pathname === '/scalev_ubah_status'} />
                        <SubmenuItem href="/scalev_bundling" label="Daftar Bundling" active={pathname === '/scalev_bundling'} />
                    </div>
                </div>
                )}

                {hasAccess('pembayaran') && (
                <div>
                    <button 
                      className={`sidebar__toggle ${(isPembayaranActive || openSubmenu === 'pembayaran') ? 'sidebar__toggle--active' : ''}`} 
                      onClick={() => toggleSubmenu('pembayaran')}
                    >
                        <span className="sidebar__label-wrap">
                            <CreditCard className="sidebar__icon" size={18} strokeWidth={1.9} />
                            <span className="sidebar__link-text">Pembayaran</span>
                        </span>
                        <ChevronDown className={`sidebar__chevron ${(isPembayaranActive || openSubmenu === 'pembayaran') ? 'sidebar__chevron--open' : ''}`} size={16} />
                    </button>
                    
                    <div className={`sidebar__submenu ${(isPembayaranActive || openSubmenu === 'pembayaran') ? '' : 'sidebar__submenu--closed'}`}>
                        <SubmenuItem href="/setting_payment" label="Payment" active={pathname === '/setting_payment'} />
                        <SubmenuItem href="/setting_no_payment" label="No Payment" active={pathname === '/setting_no_payment'} />
                    </div>
                </div>
                )}
                </div>
            </div>
            )}

            {(userRole === 'admin' || userRole === 'owner') && (
            <div className="sidebar__section">
                <p className="sidebar__section-title">Administrator</p>
                <div className="sidebar__list">
                <NavItem href="/manajemen_user" icon={UserCog} label="Manajemen User" active={pathname === '/manajemen_user'} />
                <NavItem href="/logs" icon={Activity} label="Log Aktivitas" active={pathname === '/logs'} />
                </div>
            </div>
            )}
        </nav>

        <div className="sidebar__footer">
            <div className="sidebar__user">
                <div className="sidebar__avatar">
                    {user?.photo_url ? (
                      <Image src={user.photo_url} alt={user.name || 'User'} fill unoptimized className="sidebar__avatar-image" sizes="40px" />
                    ) : (
                      roleInitial
                    )}
                </div>
                <div className="sidebar__user-body">
                    <p className="sidebar__user-name">{user?.name || 'User'}</p>
                    <p className="sidebar__user-role">{userRole || 'Role'}</p>
                </div>
                <button onClick={logout} className="sidebar__logout" title="Logout">
                    <LogOut size={16} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    </aside>
    </>
  );
}




