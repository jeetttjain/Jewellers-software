import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext.js';
import { JewelleryItemSummary, PriceBreakdown } from '@jewellery-pos/shared';
import { BarcodeSvg } from '../components/barcode/BarcodeSvg.js';
import { QRCodeSvg } from '../components/barcode/QRCodeSvg.js';
import { ProductImageThumbnail } from '../components/common/ProductImageThumbnail.js';
import { ImageLightboxModal } from '../components/common/ImageLightboxModal.js';
import { 
  ArrowLeft, 
  ShoppingCart, 
  ShieldCheck, 
  Scale, 
  Sparkles, 
  Tag, 
  Printer, 
  Zap,
  ZoomIn
} from 'lucide-react';

export const ScanResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<JewelleryItemSummary | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const { addItem } = useCart();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) loadItemQuote(id);
  }, [id]);

  const loadItemQuote = async (code: string) => {
    setIsLoading(true);
    try {
      const res = await api.get<{ item: JewelleryItemSummary; breakdown: PriceBreakdown }>(
        `/scan/lookup?code=${encodeURIComponent(code)}`
      );
      setItem(res.item);
      setBreakdown(res.breakdown);
    } catch (err: any) {
      addToast(err.message || 'Item lookup failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (item && breakdown) {
      addItem(item, breakdown);
      addToast(`Added ${item.itemCode} to POS billing cart!`, 'success');
      navigate('/billing/new');
    }
  };

  if (isLoading || !item || !breakdown) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono font-bold text-slate-700">Calculating Sub-300ms Quotation...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          to="/scan"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Scanner</span>
        </Link>
        <span className="text-xs font-mono text-slate-400">POS Serial #{item.itemCode}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Tag Details (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex justify-between items-start">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {item.status}
            </span>
            <span className="font-mono text-xs font-bold text-slate-500">{item.category}</span>
          </div>

          {/* Product Image Display & Zoom Trigger */}
          <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <ProductImageThumbnail
              imageUrl={item.imageUrl || item.images?.[0]?.imageUrl}
              size="full"
              onClick={() => {
                if (item.imageUrl || (item.images && item.images.length > 0)) {
                  setIsLightboxOpen(true);
                }
              }}
              zoomable={!!(item.imageUrl || item.images?.length)}
              alt={item.designTitle}
              className="max-h-48 object-contain"
            />
            {item.imageUrl || (item.images && item.images.length > 0) ? (
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="mt-2 text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 underline"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Tap image to zoom full size</span>
              </button>
            ) : (
              <span className="mt-1 text-[10px] text-slate-400 font-medium">No product photo uploaded</span>
            )}
          </div>

          <div>
            <h2 className="text-lg font-serif font-bold text-slate-900">{item.designTitle}</h2>
            <div className="text-xs text-amber-700 font-bold mt-0.5">{item.purity} Gold • 916 Hallmark</div>
          </div>

          {/* Weight Matrix */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-600">
              <span>Gross Weight:</span>
              <span className="font-bold text-slate-900">{item.grossWeight} g</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Stone / Dust Weight:</span>
              <span className="text-slate-700">{item.stoneWeight} g</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-amber-900 font-bold">
              <span>Net Pure Metal:</span>
              <span>{item.netWeight} g</span>
            </div>
          </div>

          {/* HUID Badge */}
          {item.huid && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">BIS Hallmarking</div>
                <div className="text-xs font-mono font-bold text-amber-950">HUID: {item.huid}</div>
              </div>
            </div>
          )}

          {/* Barcode / QR Preview */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <BarcodeSvg value={item.itemCode} width={130} height={32} />
            <QRCodeSvg value={`pos://t/${item.id}`} size={42} />
          </div>
        </div>

        {/* Right Col: Instant Live Quote Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Live Showroom Valuation
              </span>
              <h3 className="text-sm font-semibold text-slate-300">Rate at ₹{breakdown.rateApplied}/g ({item.purity})</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Sub-300ms Quote</span>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Base Metal Value ({item.netWeight}g × ₹{breakdown.rateApplied})</span>
              <span className="font-bold text-white">₹{breakdown.baseMetalValue}</span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Making Charges ({item.makingChargeType} @ {item.makingChargeValue})</span>
              <span className="font-bold text-white">₹{breakdown.makingCharges}</span>
            </div>

            {parseFloat(breakdown.wastageValue) > 0 && (
              <div className="flex justify-between text-slate-300">
                <span>Wastage ({item.wastagePct}%)</span>
                <span className="font-bold text-white">₹{breakdown.wastageValue}</span>
              </div>
            )}

            {parseFloat(breakdown.stoneValue) > 0 && (
              <div className="flex justify-between text-slate-300">
                <span>Stone / Gem Value</span>
                <span className="font-bold text-white">₹{breakdown.stoneValue}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-400">
              <span>Taxable Value (Before GST)</span>
              <span className="text-slate-200">₹{breakdown.taxableAmount}</span>
            </div>

            <div className="flex justify-between text-amber-400 font-semibold">
              <span>GST ({breakdown.taxPercent}%)</span>
              <span>₹{breakdown.taxAmount}</span>
            </div>

            <div className="flex justify-between border-t border-slate-700 pt-3 text-lg font-bold">
              <span className="text-white">Total Showroom Price:</span>
              <span className="text-amber-400">₹{Number(breakdown.totalAmount).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex gap-3">
            <button
              onClick={handleAddToCart}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Add to POS Bill</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Viewer */}
      {item && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          images={
            item.images && item.images.length > 0
              ? item.images
              : item.imageUrl
              ? [{ url: item.imageUrl, label: 'Main Product' }]
              : []
          }
          itemTitle={item.designTitle}
          itemCode={item.itemCode}
        />
      )}
    </div>
  );
};
