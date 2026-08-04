'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Image as ImageIcon,
  List,
  Minus,
  Monitor,
  Palette,
  Rocket,
  Save,
  Settings2,
  ShoppingCart,
  Smartphone,
  Square,
  Star,
  Tablet,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { Block, BlockType, buildStoredHtml, sanitizeSlug } from '@/lib/landing-page-renderer';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultBlock(type: BlockType): Block {
  const id = generateId();

  switch (type) {
    case 'heading':
      return {
        id,
        type,
        content: { text: 'Judul utama landing page Anda' },
        styles: {
          fontSize: '28px',
          fontWeight: '800',
          color: '#111827',
          textAlign: 'center',
          padding: '16px',
        },
      };
    case 'text':
      return {
        id,
        type,
        content: { text: 'Tulis penjelasan singkat, manfaat, atau penawaran utama di sini.' },
        styles: {
          fontSize: '14px',
          color: '#4b5563',
          textAlign: 'left',
          lineHeight: '1.7',
          padding: '12px 16px',
        },
      };
    case 'image':
      return {
        id,
        type,
        content: { src: '', alt: 'Gambar Produk' },
        styles: {
          width: '100%',
          borderRadius: '12px',
          padding: '12px',
        },
      };
    case 'button':
      return {
        id,
        type,
        content: { text: 'Pesan Sekarang', href: '#' },
        styles: {
          backgroundColor: '#16a34a',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: '700',
          padding: '16px 24px',
          borderRadius: '999px',
          textAlign: 'center',
        },
      };
    case 'divider':
      return {
        id,
        type,
        content: {},
        styles: {
          borderColor: '#e5e7eb',
          margin: '8px 16px',
        },
      };
    case 'list':
      return {
        id,
        type,
        content: {
          items: '✅ Manfaat pertama\n✅ Manfaat kedua\n✅ Manfaat ketiga',
        },
        styles: {
          fontSize: '14px',
          color: '#374151',
          padding: '12px 16px',
          lineHeight: '2',
        },
      };
    case 'testimonial':
      return {
        id,
        type,
        content: {
          quote: '"Produknya bagus dan hasilnya terasa cepat."',
          name: 'Siti, 34 Tahun',
          rating: '5',
        },
        styles: {
          backgroundColor: '#fffbeb',
          borderRadius: '16px',
          padding: '16px',
          margin: '8px 16px',
        },
      };
    case 'pricing':
      return {
        id,
        type,
        content: {
          originalPrice: 'Rp 250.000',
          salePrice: 'Rp 125.000',
          label: 'Hemat 50%',
        },
        styles: {
          textAlign: 'center',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          margin: '8px 16px',
        },
      };
    default:
      return {
        id,
        type: 'text',
        content: { text: 'Block baru' },
        styles: {},
      };
  }
}

const PALETTE: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'heading', label: 'Judul', icon: <Type size={16} /> },
  { type: 'text', label: 'Teks', icon: <AlignLeft size={16} /> },
  { type: 'image', label: 'Gambar', icon: <ImageIcon size={16} /> },
  { type: 'button', label: 'Tombol', icon: <ShoppingCart size={16} /> },
  { type: 'divider', label: 'Pemisah', icon: <Minus size={16} /> },
  { type: 'list', label: 'Daftar', icon: <List size={16} /> },
  { type: 'testimonial', label: 'Testimoni', icon: <Star size={16} /> },
  { type: 'pricing', label: 'Harga', icon: <Square size={16} /> },
];

function uploadImage(onSuccess: (url: string) => void) {
  return async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (response.ok && result.url) {
      onSuccess(result.url);
    } else {
      Swal.fire('Upload gagal', result.error || 'Gagal upload gambar.', 'error');
    }
  };
}

function BlockRenderer({
  block,
  onClick,
  onContentChange,
}: {
  block: Block;
  onClick: () => void;
  onContentChange: (key: string, value: string) => void;
}) {
  const s = block.styles;

  const editableProps = (key: string) => ({
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (event: React.FocusEvent<HTMLElement>) => onContentChange(key, event.currentTarget.innerText),
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      onClick();
    },
  });

  switch (block.type) {
    case 'heading':
      return (
        <h2
          style={{
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            color: s.color,
            textAlign: s.textAlign as React.CSSProperties['textAlign'],
            padding: s.padding,
            outline: 'none',
            cursor: 'text',
          }}
          {...editableProps('text')}
        >
          {block.content.text}
        </h2>
      );
    case 'text':
      return (
        <p
          style={{
            fontSize: s.fontSize,
            color: s.color,
            textAlign: s.textAlign as React.CSSProperties['textAlign'],
            lineHeight: s.lineHeight,
            padding: s.padding,
            outline: 'none',
            cursor: 'text',
            whiteSpace: 'pre-wrap',
          }}
          {...editableProps('text')}
        >
          {block.content.text}
        </p>
      );
    case 'image':
      return (
        <div style={{ padding: s.padding }} onClick={onClick}>
          {block.content.src ? (
            <div className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.content.src}
                alt={block.content.alt}
                style={{ width: s.width, borderRadius: s.borderRadius }}
                className="block"
              />
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/45 opacity-0 transition group-hover:opacity-100">
                <div className="flex flex-col items-center text-white">
                  <Upload size={22} className="mb-1" />
                  <span className="text-xs font-semibold">Ganti gambar</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadImage((url) => onContentChange('src', url))}
                />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-10 text-gray-400 transition hover:border-purple-400 hover:bg-purple-50">
              <ImageIcon size={36} className="mb-2" />
              <span className="text-xs font-semibold text-gray-500">Klik untuk upload gambar</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadImage((url) => onContentChange('src', url))}
              />
            </label>
          )}
        </div>
      );
    case 'button':
      return (
        <div style={{ margin: '8px 16px' }}>
          <span
            style={{
              backgroundColor: s.backgroundColor,
              color: s.color,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              padding: s.padding,
              borderRadius: s.borderRadius,
              display: 'block',
              textAlign: s.textAlign as React.CSSProperties['textAlign'],
              cursor: 'text',
              outline: 'none',
            }}
            {...editableProps('text')}
          >
            {block.content.text}
          </span>
        </div>
      );
    case 'divider':
      return <hr style={{ borderColor: s.borderColor, margin: s.margin }} onClick={onClick} className="cursor-pointer" />;
    case 'list':
      return (
        <div
          style={{
            fontSize: s.fontSize,
            color: s.color,
            padding: s.padding,
            lineHeight: s.lineHeight,
            outline: 'none',
            cursor: 'text',
            whiteSpace: 'pre-wrap',
          }}
          {...editableProps('items')}
        >
          {block.content.items}
        </div>
      );
    case 'testimonial':
      return (
        <div
          style={{
            backgroundColor: s.backgroundColor,
            borderRadius: s.borderRadius,
            padding: s.padding,
            margin: s.margin,
          }}
          onClick={onClick}
          className="cursor-pointer"
        >
          <div className="mb-2 text-lg text-yellow-400">{'★'.repeat(Number(block.content.rating || '0'))}</div>
          <p
            style={{ fontSize: '13px', color: '#374151', fontStyle: 'italic', outline: 'none', cursor: 'text' }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => onContentChange('quote', event.currentTarget.innerText)}
          >
            {block.content.quote}
          </p>
          <div
            style={{ fontSize: '12px', fontWeight: '700', marginTop: '8px', outline: 'none', cursor: 'text' }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => onContentChange('name', event.currentTarget.innerText)}
          >
            {block.content.name}
          </div>
        </div>
      );
    case 'pricing':
      return (
        <div
          style={{
            textAlign: s.textAlign as React.CSSProperties['textAlign'],
            padding: s.padding,
            backgroundColor: s.backgroundColor,
            borderRadius: s.borderRadius,
            margin: s.margin,
          }}
          onClick={onClick}
          className="cursor-pointer"
        >
          <div style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through', marginBottom: '4px' }}>
            {block.content.originalPrice}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#dc2626', marginBottom: '4px' }}>
            {block.content.salePrice}
          </div>
          <span style={{ background: '#fef9c3', color: '#92400e', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px' }}>
            {block.content.label}
          </span>
        </div>
      );
    default:
      return null;
  }
}

function PropertiesPanel({
  block,
  onChange,
  onChangeStyle,
}: {
  block: Block;
  onChange: (key: string, value: string) => void;
  onChangeStyle: (key: string, value: string) => void;
}) {
  const input = (label: string, key: string, value: string, isStyle = false, type = 'text') => (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">{label}</label>
      <input
        type={type}
        value={value}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
        onChange={(event) => (isStyle ? onChangeStyle(key, event.target.value) : onChange(key, event.target.value))}
      />
    </div>
  );

  const s = block.styles;
  const c = block.content;

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-1 text-[10px] font-bold uppercase text-purple-600">
        <Settings2 size={11} />
        Konten
      </div>

      {(block.type === 'heading' || block.type === 'text' || block.type === 'button') && input('Teks', 'text', c.text || '')}
      {block.type === 'list' && input('Daftar', 'items', c.items || '')}
      {block.type === 'image' && (
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Gambar</label>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-purple-300 px-2 py-2.5 text-xs font-semibold text-purple-600 transition hover:bg-purple-50">
            <Upload size={13} />
            Upload Gambar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadImage((url) => onChange('src', url))}
            />
          </label>
          {c.src ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt={c.alt || ''} className="mt-2 rounded" />
            </>
          ) : null}
          {input('Alt Text', 'alt', c.alt || '')}
        </div>
      )}
      {block.type === 'button' && input('Link Tombol', 'href', c.href || '')}
      {block.type === 'testimonial' && (
        <>
          {input('Kutipan', 'quote', c.quote || '')}
          {input('Nama', 'name', c.name || '')}
          {input('Rating', 'rating', c.rating || '5')}
        </>
      )}
      {block.type === 'pricing' && (
        <>
          {input('Harga Normal', 'originalPrice', c.originalPrice || '')}
          {input('Harga Promo', 'salePrice', c.salePrice || '')}
          {input('Label', 'label', c.label || '')}
        </>
      )}

      <div className="mb-3 mt-5 flex items-center gap-1 text-[10px] font-bold uppercase text-purple-600">
        <Palette size={11} />
        Tampilan
      </div>

      {s.fontSize !== undefined && input('Ukuran Font', 'fontSize', s.fontSize, true)}
      {s.color !== undefined && input('Warna Teks', 'color', s.color, true, 'color')}
      {s.backgroundColor !== undefined && input('Warna Background', 'backgroundColor', s.backgroundColor, true, 'color')}
      {s.borderRadius !== undefined && input('Border Radius', 'borderRadius', s.borderRadius, true)}
      {s.padding !== undefined && input('Padding', 'padding', s.padding, true)}
      {s.textAlign !== undefined && (
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Rata Teks</label>
          <select
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
            value={s.textAlign}
            onChange={(event) => onChangeStyle('textAlign', event.target.value)}
          >
            <option value="left">Kiri</option>
            <option value="center">Tengah</option>
            <option value="right">Kanan</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  const searchParams = useSearchParams();
  const editSlug = searchParams.get('edit');

  const initialBlocks = (): Block[] => {
    if (typeof window === 'undefined') {
      return [];
    }

    const saved = localStorage.getItem('lp_builder_blocks');
    if (saved) {
      try {
        return JSON.parse(saved) as Block[];
      } catch {
        localStorage.removeItem('lp_builder_blocks');
      }
    }

    return [
      defaultBlock('heading'),
      defaultBlock('text'),
      defaultBlock('image'),
      defaultBlock('button'),
      defaultBlock('divider'),
      defaultBlock('testimonial'),
      defaultBlock('pricing'),
    ];
  };

  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('Landing Page Baru');
  const [slug, setSlug] = useState(`my-landing-page-${generateId().slice(0, 4)}`);
  const [domain, setDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<'inactive' | 'pending' | 'active'>('inactive');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(() => Boolean(editSlug));
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragPaletteType = useRef<BlockType | null>(null);

  useEffect(() => {
    if (!editSlug) {
      return;
    }

    fetch(`/api/landing-pages/${editSlug}`)
      .then((response) => response.json())
      .then((result) => {
        if (!result.data) return;
        const page = result.data;
        setTitle(page.title || 'Landing Page Baru');
        setSlug(page.slug || '');
        setDomain(page.domain || '');
        setDomainStatus(page.domain_status || 'inactive');

        if (page.blocks_json) {
          try {
            setBlocks(JSON.parse(page.blocks_json));
          } catch {
            setBlocks([]);
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingEdit(false));
  }, [editSlug]);

  const selectedBlock = blocks.find((block) => block.id === selectedId) || null;

  const updateBlock = useCallback((id: string, key: string, value: string) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, content: { ...block.content, [key]: value } } : block)));
  }, []);

  const updateStyle = useCallback((id: string, key: string, value: string) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, styles: { ...block.styles, [key]: value } } : block)));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const moveBlock = useCallback((index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;

    setBlocks((prev) => {
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }, [blocks.length]);

  const handleSave = async () => {
    const html = buildStoredHtml(blocks);
    localStorage.setItem('lp_builder_blocks', JSON.stringify(blocks));
    setIsSavingDraft(true);

    try {
      const response = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          html_data: html,
          blocks_json: JSON.stringify(blocks),
          status: 'Draft',
          domain: domain || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal menyimpan draft.');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Draft disimpan',
        html: `Draft berhasil disimpan.<br><br><div class="p-3 bg-gray-50 border rounded text-sm text-left"><span class="text-gray-500 font-semibold block mb-1">Preview Link:</span><a href="/lp/${slug}" target="_blank" class="text-purple-600 hover:underline">http://localhost:3000/lp/${slug}</a></div>`,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#7e22ce',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan draft.';
      Swal.fire('Error', message, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    localStorage.setItem('lp_builder_blocks', JSON.stringify(blocks));
    setIsPublishing(true);

    try {
      const response = await fetch('/api/landing-pages/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          blocks_json: JSON.stringify(blocks),
          domain: domain || null,
          domain_status: domain ? domainStatus : 'inactive',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Gagal publish landing page.');
      }

      const publishInfo = result.publish;
      const deployTone =
        publishInfo?.deploy_status === 'deployed'
          ? 'green'
          : publishInfo?.deploy_status === 'failed'
            ? 'red'
            : 'yellow';

      await Swal.fire({
        icon: 'success',
        title: 'Publish berhasil',
        html: `Landing page berhasil dipublish.<br><br><div class="p-3 bg-green-50 border border-green-200 rounded text-sm text-left"><span class="text-green-700 font-semibold block mb-1">Preview Link:</span><a href="/lp/${slug}" target="_blank" class="text-green-600 hover:underline font-medium">http://localhost:3000/lp/${slug}</a></div><div class="mt-3 p-3 bg-${deployTone}-50 border border-${deployTone}-200 rounded text-sm text-left"><span class="text-${deployTone}-700 font-semibold block mb-1">Status Deploy:</span><div class="text-${deployTone}-700">${publishInfo?.deploy_message || 'Bundle static berhasil dibuat.'}</div>${publishInfo?.remote_path ? `<div class="mt-2 text-xs text-${deployTone}-700"><strong>Remote Path:</strong> ${publishInfo.remote_path}</div>` : ''}${publishInfo?.output_dir ? `<div class="mt-2 text-xs text-${deployTone}-700"><strong>Output Lokal:</strong> ${publishInfo.output_dir}</div>` : ''}</div>`,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#4c1d95',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal publish landing page.';
      Swal.fire('Error', message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const onPaletteDragStart = (type: BlockType) => {
    dragPaletteType.current = type;
    dragItem.current = null;
  };

  const onBlockDragStart = (index: number) => {
    dragItem.current = index;
    dragPaletteType.current = null;
  };

  const onBlockDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault();

    if (dragPaletteType.current) {
      const newBlock = defaultBlock(dragPaletteType.current);
      setBlocks((prev) => {
        const next = [...prev];
        next.splice(index, 0, newBlock);
        return next;
      });
      setSelectedId(newBlock.id);
    } else if (dragItem.current !== null && dragItem.current !== index) {
      setBlocks((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragItem.current!, 1);
        next.splice(index, 0, moved);
        return next;
      });
    }

    dragItem.current = null;
    dragPaletteType.current = null;
    setDragOverIdx(null);
  };

  const onCanvasDrop = (event: React.DragEvent) => {
    event.preventDefault();

    if (dragPaletteType.current) {
      const newBlock = defaultBlock(dragPaletteType.current);
      setBlocks((prev) => [...prev, newBlock]);
      setSelectedId(newBlock.id);
    }

    dragPaletteType.current = null;
    dragItem.current = null;
    setDragOverIdx(null);
  };

  const canvasWidth =
    device === 'desktop' ? 'max-w-4xl' : device === 'tablet' ? 'max-w-[768px]' : 'max-w-[390px]';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f4f7f9] text-sm">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between bg-[#7e22ce] px-4 text-white shadow">
        <div className="flex items-center gap-3">
          <Link href="/landing-page" className="rounded p-1 transition-colors hover:bg-white/10">
            <X size={20} />
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-white text-xs font-bold text-[#7e22ce] shadow-sm">
              S
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <input
                className="w-48 border-b border-white/30 bg-transparent text-xs font-semibold outline-none focus:border-white"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="flex items-center gap-1 border-b border-white/20 pb-0.5">
                <span className="select-none text-[10px] text-purple-200">/lp/</span>
                <input
                  className="w-40 bg-transparent text-[10px] text-white/90 outline-none"
                  value={slug}
                  placeholder="nama-produk-anda"
                  onChange={(event) => setSlug(sanitizeSlug(event.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden gap-0.5 rounded bg-white/20 p-0.5 sm:flex">
            {[
              ['desktop', <Monitor size={14} key="desktop-icon" />],
              ['tablet', <Tablet size={14} key="tablet-icon" />],
              ['mobile', <Smartphone size={14} key="mobile-icon" />],
            ].map(([name, icon]) => (
              <button
                key={name as string}
                onClick={() => setDevice(name as 'desktop' | 'tablet' | 'mobile')}
                className={`rounded p-1.5 transition-colors ${
                  device === name ? 'bg-white text-[#7e22ce]' : 'hover:bg-white/10'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSavingDraft || isPublishing}
              className="flex items-center gap-1.5 rounded border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={13} />
              <span className="hidden sm:inline">{isSavingDraft ? 'Menyimpan...' : 'Simpan'}</span>
            </button>
            <button
              onClick={handlePublish}
              disabled={isSavingDraft || isPublishing}
              className="flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-xs font-bold text-[#7e22ce] transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Rocket size={13} />
              <span className="hidden sm:inline">{isPublishing ? 'Publishing...' : 'Terbitkan'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside
          className={`z-10 flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
            sidebarOpen ? 'w-[220px]' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Komponen</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <ChevronsLeft size={14} />
            </button>
          </div>

          <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
            {PALETTE.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={() => onPaletteDragStart(item.type)}
                onClick={() => {
                  const newBlock = defaultBlock(item.type);
                  setBlocks((prev) => [...prev, newBlock]);
                  setSelectedId(newBlock.id);
                }}
                className="select-none rounded-lg border border-gray-200 bg-white p-3 text-[10px] font-semibold text-gray-600 shadow-sm transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600"
              >
                <div className="mb-1.5 text-gray-400">{item.icon}</div>
                {item.label}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-purple-300 hover:text-purple-600"
            >
              <Settings2 size={14} />
              Pengaturan Halaman
            </button>
          </div>
        </aside>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-md border border-l-0 border-gray-200 bg-white p-1.5 text-gray-500 shadow transition hover:text-purple-600"
          >
            <ChevronsRight size={16} />
          </button>
        )}

        <section
          className="flex flex-1 flex-col items-center overflow-y-auto bg-[#e8edf2] px-4 py-8 pb-32"
          onClick={() => setSelectedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onCanvasDrop}
        >
          {isLoadingEdit ? (
            <div className="mt-24 rounded-2xl bg-white px-8 py-6 shadow-lg">Memuat landing page...</div>
          ) : null}

          <div className={`relative w-full rounded-sm bg-white shadow-2xl ${canvasWidth}`}>
            {blocks.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-gray-400">
                <div className="text-5xl">□</div>
                <p className="text-sm font-medium">Seret komponen ke sini</p>
                <p className="text-xs">atau klik komponen di sidebar kiri</p>
              </div>
            ) : (
              blocks.map((block, index) => {
                const isSelected = block.id === selectedId;

                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => onBlockDragStart(index)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverIdx(index);
                    }}
                    onDrop={(event) => onBlockDrop(event, index)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(block.id);
                      setRightPanelOpen(true);
                    }}
                    className={`group relative transition-all ${
                      isSelected ? 'ring-2 ring-purple-500' : 'hover:ring-2 hover:ring-purple-300'
                    } ${dragOverIdx === index ? 'border-t-4 border-purple-400' : ''}`}
                  >
                    <div className={`absolute left-1 top-1 z-20 text-gray-400 ${isSelected ? 'flex' : 'hidden group-hover:flex'}`}>
                      <GripVertical size={13} />
                    </div>

                    <div className={`absolute right-1 top-1 z-20 gap-1 ${isSelected ? 'flex' : 'hidden group-hover:flex'}`}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          moveBlock(index, -1);
                        }}
                        className="rounded border border-gray-200 bg-white p-0.5 text-gray-500 shadow transition hover:text-purple-600"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          moveBlock(index, 1);
                        }}
                        className="rounded border border-gray-200 bg-white p-0.5 text-gray-500 shadow transition hover:text-purple-600"
                      >
                        <ChevronDown size={11} />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteBlock(block.id);
                        }}
                        className="rounded border border-red-200 bg-white p-0.5 text-red-400 shadow transition hover:text-red-600"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {isSelected ? (
                      <div className="absolute left-0 top-0 z-20 rounded-br bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        {block.type}
                      </div>
                    ) : null}

                    <BlockRenderer
                      block={block}
                      onClick={() => {
                        setSelectedId(block.id);
                        setRightPanelOpen(true);
                      }}
                      onContentChange={(key, value) => updateBlock(block.id, key, value)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside
          className={`flex shrink-0 flex-col border-l border-gray-200 bg-white transition-all duration-300 ${
            rightPanelOpen && selectedBlock ? 'w-[240px]' : 'w-0 overflow-hidden'
          }`}
        >
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Edit Elemen</span>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <PropertiesPanel
                  block={selectedBlock}
                  onChange={(key, value) => updateBlock(selectedBlock.id, key, value)}
                  onChangeStyle={(key, value) => updateStyle(selectedBlock.id, key, value)}
                />
              </div>
            </>
          ) : null}
        </aside>
      </main>

      {isSettingsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-4">
              <h3 className="flex items-center gap-2 font-bold text-gray-800">
                <Settings2 size={18} className="text-purple-600" />
                Pengaturan Halaman
              </h3>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="rounded-full p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-gray-700">Slug URL</label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 transition focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                  <span className="select-none text-sm font-medium text-gray-500">/lp/</span>
                  <input
                    className="flex-1 bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
                    value={slug}
                    placeholder="nama-produk-anda"
                    onChange={(event) => setSlug(sanitizeSlug(event.target.value))}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">URL ini dipakai untuk preview internal dan folder publish.</p>
              </div>

              <hr className="border-gray-100" />

              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-gray-700">Custom Domain</label>
                <input
                  type="text"
                  placeholder="contoh: promo.domainanda.com"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value.trim())}
                />

                {domain ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div
                      className={`inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold ${
                        domainStatus === 'active'
                          ? 'bg-green-100 text-green-700'
                          : domainStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          domainStatus === 'active'
                            ? 'bg-green-500'
                            : domainStatus === 'pending'
                              ? 'bg-yellow-500'
                              : 'bg-gray-400'
                        }`}
                      />
                      {domainStatus === 'active'
                        ? 'Domain terhubung'
                        : domainStatus === 'pending'
                          ? 'Menunggu propagasi DNS'
                          : 'Belum diatur'}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                      Jika domain ini dipakai, status publish akan tetap sukses walau propagasi DNS belum selesai.
                    </p>
                  </div>
                ) : null}
              </div>

              <hr className="border-gray-100" />

              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-gray-700">Konfigurasi Hosting Publish</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-6 text-slate-600">
                  <div>`DEPLOY_HOST` host server website</div>
                  <div>`DEPLOY_PORT` port SFTP/SSH, biasanya `22`</div>
                  <div>`DEPLOY_USERNAME` username server hosting</div>
                  <div>`DEPLOY_PATH` folder root publish, misalnya `/home/user/sites`</div>
                  <div>`DEPLOY_SSH_KEY_PATH` direkomendasikan untuk auto upload</div>
                  <div>`DEPLOY_PASSWORD` bisa dipakai jika server builder punya `sshpass`</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-100 bg-gray-50 p-4">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
