import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { ReturnRestockDestination, ReturnTransaction, JewelleryItemSummary } from '@jewellery-pos/shared';
import { ProductImageThumbnail } from '../components/common/ProductImageThumbnail.js';
import { ImageLightboxModal } from '../components/common/ImageLightboxModal.js';
import { ArrowLeft, RotateCcw, ShieldAlert, Lock, Sparkles, ZoomIn } from 'lucide-react';

export const ReturnsTerminalPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [invoiceId, setInvoiceId] = useState('');
  const [itemId, setItemId] = useState('');
  const [itemDetails, setItemDetails] = useState<JewelleryItemSummary | null>(null);
  const [returnReason, setReturnReason] = useState('Customer Exchange / Dissatisfaction');
  const [refundAmount, setRefundAmount] = useState('0.00');
  const [deductionAmount, setDeductionAmount] = useState('0.00');
  const [restockDestination, setRestockDestination] = useState<ReturnRestockDestination>(ReturnRestockDestination.BACK_TO_STOCK);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Auto-fetch item details when item code entered
  useEffect(() => {
    const clean = itemId.trim();
    if (!clean) {
      setItemDetails(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const found = await api.get<JewelleryItemSummary>(`/items/${clean}`);
        setItemDetails(found);
      } catch {
        setItemDetails(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [itemId]);

  const netRefund = Math.max(0, (parseFloat(refundAmount) || 0) - (parseFloat(deductionAmount) || 0)).toFixed(2);

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorPin || supervisorPin.length !== 4) {
      addToast('Manager / Admin 4-digit PIN is required for return authorization', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        originalInvoiceId: invoiceId,
        itemId,
        returnReason,
        refundAmount,
        deductionAmount,
        restockDestination,
        supervisorPin
      };

      const result = await api.post<ReturnTransaction>('/returns', payload);
      addToast(`Return Voucher ${result.returnNumber} authorized and generated!`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      addToast(err.message || 'Return authorization failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-base font-bold text-slate-900">
          Sales Return & Exchange Authorization
        </h1>
      </div>

      <form onSubmit={handleReturnSubmit} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-8 shadow-md space-y-5 text-xs">
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <span>All returns create immutable credit notes and adjust stock ledgers automatically.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Original Invoice # *</label>
            <input
              type="text"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
              placeholder="e.g. INV-202608-001"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Returned Item Code *</label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
              placeholder="e.g. KJ-GLD-001"
              required
            />
          </div>
        </div>

        {/* Visual Item Verification Card */}
        {itemDetails && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <ProductImageThumbnail
              imageUrl={itemDetails.imageUrl}
              size="md"
              onClick={() => {
                if (itemDetails.imageUrl) setIsLightboxOpen(true);
              }}
              zoomable={!!itemDetails.imageUrl}
              alt={itemDetails.designTitle}
            />
            <div className="flex-1 font-mono text-xs">
              <div className="font-sans font-bold text-slate-900">{itemDetails.designTitle}</div>
              <div className="text-slate-500">{itemDetails.purity} {itemDetails.metal} • Gross: {itemDetails.grossWeight}g</div>
              {itemDetails.imageUrl && (
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="text-[10px] text-amber-700 font-semibold underline mt-0.5"
                >
                  Verify photo
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Reason for Return / Exchange *</label>
          <input
            type="text"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2 text-xs"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Refund Base Value (₹) *</label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs font-bold"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Refurbish / Melting Deduction (₹)</label>
            <input
              type="number"
              value={deductionAmount}
              onChange={(e) => setDeductionAmount(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
            />
          </div>
        </div>

        {/* Restock Routing */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Physical Destination of Piece</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRestockDestination(ReturnRestockDestination.BACK_TO_STOCK)}
              className={`p-3 rounded-xl border text-left font-semibold cursor-pointer ${
                restockDestination === ReturnRestockDestination.BACK_TO_STOCK
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <div>Restock to Catalog</div>
              <span className="text-[10px] font-normal text-slate-500">Unused item back into inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setRestockDestination(ReturnRestockDestination.MELTING_SCRAP)}
              className={`p-3 rounded-xl border text-left font-semibold cursor-pointer ${
                restockDestination === ReturnRestockDestination.MELTING_SCRAP
                  ? 'border-red-500 bg-red-50 text-red-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <div>Send to Melting Pot</div>
              <span className="text-[10px] font-normal text-slate-500">Melt for old gold refining</span>
            </button>
          </div>
        </div>

        {/* Net Refund Calculation */}
        <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center font-mono">
          <div>
            <div className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Net Customer Refund / Credit</div>
            <div className="text-xl font-bold text-amber-400">₹{netRefund}</div>
          </div>
          <RotateCcw className="w-6 h-6 text-amber-400 opacity-60" />
        </div>

        {/* Supervisor PIN Authorization */}
        <div className="pt-2">
          <label className="block font-semibold text-slate-700 mb-1">
            Supervisor / Manager Authorization PIN (4 Digits) *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={4}
              value={supervisorPin}
              onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              aria-label="Supervisor / Manager Authorization PIN"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 font-mono text-base tracking-widest text-slate-900 focus:bg-white focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isSubmitting ? 'Authorizing...' : 'Authorize & Process Return'}</span>
          </button>
        </div>
      </form>

      {/* Lightbox Zoom Viewer */}
      {itemDetails && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          images={
            itemDetails.images && itemDetails.images.length > 0
              ? itemDetails.images
              : itemDetails.imageUrl
              ? [{ url: itemDetails.imageUrl, label: 'Main Product' }]
              : []
          }
          itemTitle={itemDetails.designTitle}
          itemCode={itemDetails.itemCode}
        />
      )}
    </div>
  );
};
