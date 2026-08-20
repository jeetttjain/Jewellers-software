import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { JewelleryItemSummary, LabelTemplate, ItemImage } from '@jewellery-pos/shared';
import { CustomizableJewelleryTag } from '../components/barcode/CustomizableJewelleryTag.js';
import { ProductImageThumbnail } from '../components/common/ProductImageThumbnail.js';
import { ImageLightboxModal } from '../components/common/ImageLightboxModal.js';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  Printer, 
  ShieldCheck, 
  Scale, 
  ChevronRight, 
  Sparkles,
  Tag,
  ZoomIn,
  Image as ImageIcon,
  Upload,
  Trash2,
  RefreshCw,
  X,
  Info
} from 'lucide-react';

export const InventoryMasterPage: React.FC = () => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<JewelleryItemSummary[]>([]);
  const [search, setSearch] = useState('');
  const [metalFilter, setMetalFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Reprint Modal State
  const [reprintItem, setReprintItem] = useState<JewelleryItemSummary | null>(null);
  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [shopName, setShopName] = useState('KAMAL JEWELLERS');

  // Item Detail & Image Zoom State
  const [selectedDetailItem, setSelectedDetailItem] = useState<JewelleryItemSummary | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; label?: string } | ItemImage>>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    loadInventory();
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const [tpl, shop] = await Promise.allSettled([
        api.get<LabelTemplate>('/labels/template'),
        api.get<any>('/settings')
      ]);
      if (tpl.status === 'fulfilled' && tpl.value) setTemplate(tpl.value);
      if (shop.status === 'fulfilled' && shop.value?.name) setShopName(shop.value.name);
    } catch {
      // Fallback
    }
  };

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const list = await api.get<JewelleryItemSummary[]>('/items');
      setItems(list);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (item: JewelleryItemSummary) => {
    setSelectedDetailItem(item);
    setIsDetailModalOpen(true);
    // Fetch full item with all images
    try {
      const full = await api.get<JewelleryItemSummary>(`/items/${item.id}`);
      if (full) {
        setSelectedDetailItem(full);
      }
    } catch {
      // Fallback to list item
    }
  };

  const handleOpenZoom = (item: JewelleryItemSummary) => {
    const imgs = item.images && item.images.length > 0
      ? item.images
      : item.imageUrl
      ? [{ url: item.imageUrl, label: 'Main Product' }]
      : [];
    if (imgs.length > 0) {
      setLightboxImages(imgs);
      setIsLightboxOpen(true);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDetailItem) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      addToast('Only PNG, JPG/JPEG, and WEBP image files are allowed.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size must not exceed 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setIsUploadingImage(true);
      try {
        await api.post(`/items/${selectedDetailItem.id}/images`, {
          imageBase64: base64,
          label: 'Main',
          isPrimary: true
        });
        addToast('Product image uploaded successfully!', 'success');
        // Reload details & inventory list
        const updated = await api.get<JewelleryItemSummary>(`/items/${selectedDetailItem.id}`);
        setSelectedDetailItem(updated);
        loadInventory();
      } catch (err: any) {
        addToast(err.message || 'Image upload failed', 'error');
      } finally {
        setIsUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async (imageId?: string) => {
    if (!selectedDetailItem) return;
    const confirmRemove = window.confirm('Remove product image? This will not delete the inventory item.');
    if (!confirmRemove) return;

    setIsUploadingImage(true);
    try {
      const targetImageId = imageId || selectedDetailItem.images?.[0]?.id;
      if (targetImageId) {
        await api.delete(`/items/${selectedDetailItem.id}/images/${targetImageId}`);
      }
      addToast('Product image removed successfully.', 'success');
      const updated = await api.get<JewelleryItemSummary>(`/items/${selectedDetailItem.id}`);
      setSelectedDetailItem(updated);
      loadInventory();
    } catch (err: any) {
      addToast(err.message || 'Failed to remove image', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const filtered = items.filter((i) => {
    const matchesSearch =
      i.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      i.designTitle.toLowerCase().includes(search.toLowerCase()) ||
      (i.huid && i.huid.toLowerCase().includes(search.toLowerCase()));
    const matchesMetal = metalFilter === 'ALL' || i.metal === metalFilter;
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesMetal && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Image Upload / Replacement */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadImage}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-slate-900">
            Serialized Jewellery Stock Catalog
          </h1>
          <p className="text-xs text-slate-500">
            Gross/Net weight tracking, BIS HUID hallmarking, product photos, and barcode tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/inventory/labels/queue"
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Tag Print Queue</span>
          </Link>
          <Link
            to="/inventory/new"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, design title, or HUID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={metalFilter}
            onChange={(e) => setMetalFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Metals</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="PLATINUM">Platinum</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="SOLD">Sold</option>
            <option value="MELTED">Melted / Vault</option>
          </select>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs font-bold text-slate-900">{item.itemCode}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.status === 'IN_STOCK'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.status === 'SOLD'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {item.status}
                </span>
              </div>

              {/* Product Thumbnail Card */}
              <div className="my-2.5 flex justify-center">
                <ProductImageThumbnail
                  imageUrl={item.imageUrl}
                  alt={item.designTitle}
                  size="full"
                  onClick={() => handleOpenDetail(item)}
                  zoomable={!!item.imageUrl}
                />
              </div>

              <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                {item.designTitle}
              </h3>
              <p className="text-[11px] text-slate-500">{item.category} • {item.purity}</p>

              {/* Weight Details */}
              <div className="mt-2.5 p-2 bg-slate-50 rounded-lg text-[11px] space-y-1 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Gross:</span>
                  <span className="font-bold text-slate-900">{item.grossWeight}g</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Stone:</span>
                  <span>{item.stoneWeight}g</span>
                </div>
                <div className="flex justify-between text-amber-900 font-bold border-t border-slate-200 pt-0.5">
                  <span>Net:</span>
                  <span>{item.netWeight}g</span>
                </div>
              </div>

              {/* HUID Badge */}
              <div className="mt-2 flex items-center justify-between text-[10px]">
                {item.huid ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono font-bold border border-amber-200">
                    <ShieldCheck className="w-3 h-3" />
                    HUID: {item.huid}
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned HUID</span>
                )}
                <span className="text-slate-500 font-semibold">{item.makingChargeType}</span>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleOpenDetail(item)}
                className="text-[11px] font-semibold text-slate-700 hover:text-amber-700 flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Details</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReprintItem(item)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-amber-700 transition-colors"
                  title="Reprint Tag"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>

                <Link
                  to={`/scan/result/${item.itemCode}`}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold flex items-center gap-0.5"
                >
                  <span>Quote</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail & Image Management Modal */}
      {isDetailModalOpen && selectedDetailItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-serif font-bold text-slate-900 text-base">
                  {selectedDetailItem.designTitle}
                </h3>
                <p className="text-xs font-mono font-bold text-amber-700">
                  {selectedDetailItem.itemCode} • {selectedDetailItem.purity} {selectedDetailItem.metal}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Image Section with Zoom Trigger */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <ProductImageThumbnail
                imageUrl={selectedDetailItem.imageUrl || selectedDetailItem.images?.[0]?.imageUrl}
                alt={selectedDetailItem.designTitle}
                size="full"
                onClick={() => handleOpenZoom(selectedDetailItem)}
                zoomable={!!(selectedDetailItem.imageUrl || selectedDetailItem.images?.length)}
                className="max-h-56 object-contain"
              />

              {selectedDetailItem.imageUrl || (selectedDetailItem.images && selectedDetailItem.images.length > 0) ? (
                <div className="flex items-center justify-between w-full pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenZoom(selectedDetailItem)}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 underline"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>Fullscreen Lightbox & Zoom</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage()}
                      disabled={isUploadingImage}
                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">No product photo attached</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Product Photo</span>
                  </button>
                </div>
              )}
            </div>

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-500 font-sans">Category:</span>{' '}
                <span className="font-bold text-slate-900">{selectedDetailItem.category}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Status:</span>{' '}
                <span className="font-bold text-emerald-700">{selectedDetailItem.status}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Gross Weight:</span>{' '}
                <span className="font-bold text-slate-900">{selectedDetailItem.grossWeight}g</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Net Weight:</span>{' '}
                <span className="font-bold text-amber-900">{selectedDetailItem.netWeight}g</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Stone Weight:</span>{' '}
                <span className="font-bold text-slate-900">{selectedDetailItem.stoneWeight}g</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Stone Value:</span>{' '}
                <span className="font-bold text-slate-900">₹{selectedDetailItem.stoneValue}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Making Charge:</span>{' '}
                <span className="font-bold text-slate-900">
                  ₹{selectedDetailItem.makingChargeValue} ({selectedDetailItem.makingChargeType})
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">Wastage %:</span>{' '}
                <span className="font-bold text-slate-900">{selectedDetailItem.wastagePct}%</span>
              </div>
              {selectedDetailItem.huid && (
                <div className="col-span-2 text-amber-800 font-bold font-sans flex items-center gap-1 pt-1 border-t border-slate-200">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>BIS Hallmarking HUID: {selectedDetailItem.huid}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <Link
                to={`/scan/result/${selectedDetailItem.itemCode}`}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <span>Live Quotation</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Label Reprint Modal */}
      {reprintItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <Tag className="w-4 h-4 text-amber-600" />
                <span className="font-serif font-bold text-sm">Reprint Jewellery Tag</span>
              </div>
              <button
                onClick={() => setReprintItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl p-5 flex flex-col items-center justify-center min-h-[160px]">
              <CustomizableJewelleryTag
                item={reprintItem}
                config={template?.config}
                preset={template?.preset || 'SMALL_RECTANGLE'}
                widthMm={template?.widthMm || '50.00'}
                heightMm={template?.heightMm || '25.00'}
                shopName={shopName}
                scale={1.8}
              />
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg font-mono">
              <div><strong>Item Code:</strong> {reprintItem.itemCode}</div>
              <div><strong>Status:</strong> {reprintItem.status} (Barcode identity remains permanent)</div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReprintItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tag Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Viewer */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={lightboxImages}
        itemTitle={selectedDetailItem?.designTitle}
        itemCode={selectedDetailItem?.itemCode}
      />
    </div>
  );
};
