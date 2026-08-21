import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext.js';
import { Metal, OldGoldSettlementType, OldGoldTransaction } from '@jewellery-pos/shared';
import { Scale, Save, Sparkles, ShoppingCart, ArrowLeft, ShieldCheck } from 'lucide-react';

export const OldGoldAssayPage: React.FC = () => {
  const [customerName, setCustomerName] = useState('Anand Kumar Agarwal');
  const [customerMobile, setCustomerMobile] = useState('9769012345');
  const [grossWeight, setGrossWeight] = useState('24.500');
  const [dustStoneDeduction, setDustStoneDeduction] = useState('0.800');
  const [testedPurityPercent, setTestedPurityPercent] = useState('88.50');
  const [buybackRate, setBuybackRate] = useState('7450.00');
  const [settlementType, setSettlementType] = useState<OldGoldSettlementType>(OldGoldSettlementType.CART_EXCHANGE);
  const [notes, setNotes] = useState('Old 20K traditional jewellery melt testing');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { attachOldGoldTradeIn } = useCart();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const grossNum = parseFloat(grossWeight) || 0;
  const dustNum = parseFloat(dustStoneDeduction) || 0;
  const netScrapWeight = Math.max(0, grossNum - dustNum).toFixed(3);
  const purityNum = parseFloat(testedPurityPercent) || 0;
  const fineWeight = (parseFloat(netScrapWeight) * (purityNum / 100)).toFixed(3);
  const rateNum = parseFloat(buybackRate) || 0;
  const totalValuation = (parseFloat(fineWeight) * rateNum).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        customerName,
        customerMobile,
        metal: Metal.GOLD,
        grossWeight,
        dustStoneDeduction,
        testedPurityPercent,
        buybackRatePerGram: buybackRate,
        settlementType,
        notes
      };

      const result = await api.post<OldGoldTransaction>('/old-gold', payload);
      if (settlementType === OldGoldSettlementType.CART_EXCHANGE) {
        attachOldGoldTradeIn(result);
        addToast(`Assayed voucher ${result.transactionNumber} attached to POS cart!`, 'success');
        navigate('/billing/new');
      } else {
        addToast(`Old Gold Cash Payout Voucher ${result.transactionNumber} generated!`, 'success');
        navigate('/dashboard');
      }
    } catch (err: any) {
      addToast(err.message || 'Assay failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-base font-bold text-slate-900">
          Old Scrap Gold Assay & Trade-In Valuation
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-8 shadow-md space-y-6 text-xs">
        {/* Customer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer Full Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 text-xs"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Customer Mobile *</label>
            <input
              type="tel"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono"
              required
            />
          </div>
        </div>

        {/* Weights & Purity Assay */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-amber-600" />
            <span>Purity Assay & Fine Gold Conversion</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Scrap Gross Weight (g) *</label>
              <input
                type="number"
                step="0.001"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dust / Solder Deduction (g)</label>
              <input
                type="number"
                step="0.001"
                value={dustStoneDeduction}
                onChange={(e) => setDustStoneDeduction(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Net Scrap Weight</span>
              <span className="font-mono text-sm font-bold text-slate-900">{netScrapWeight} g</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tested Purity (%) *</label>
              <input
                type="number"
                step="0.01"
                max={100}
                value={testedPurityPercent}
                onChange={(e) => setTestedPurityPercent(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                required
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
              <span className="block text-[10px] font-bold text-amber-800 uppercase">Equivalent 24K Fine Wt</span>
              <span className="font-mono text-sm font-bold text-amber-900">{fineWeight} g</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">24K Buyback Rate (₹/g) *</label>
              <input
                type="number"
                value={buybackRate}
                onChange={(e) => setBuybackRate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                required
              />
            </div>
          </div>
        </div>

        {/* Valuation Total Box */}
        <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Scrap Valuation Voucher</span>
            <div className="text-2xl font-mono font-bold text-amber-400">
              ₹{Number(totalValuation).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSettlementType(OldGoldSettlementType.CART_EXCHANGE)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                settlementType === OldGoldSettlementType.CART_EXCHANGE
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              Exchange Credit
            </button>
            <button
              type="button"
              onClick={() => setSettlementType(OldGoldSettlementType.CASH_PAYOUT)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                settlementType === OldGoldSettlementType.CASH_PAYOUT
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              Direct Cash Payout
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Generating...' : 'Issue Old Scrap Gold Valuation Voucher'}</span>
        </button>
      </form>
    </div>
  );
};
