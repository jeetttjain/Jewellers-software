import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api/client.js';
import { PaymentMode, PaymentTender, Invoice } from '@jewellery-pos/shared';
import { QRCodeSvg } from '../components/barcode/QRCodeSvg.js';
import { 
  ArrowLeft, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Building2, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  ShieldCheck,
  Zap,
  Printer
} from 'lucide-react';

export const PaymentCheckoutPage: React.FC = () => {
  const { items, customer, oldGoldTradeIn, totals, clearCart } = useCart();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [tenders, setTenders] = useState<PaymentTender[]>([
    { mode: PaymentMode.UPI, amount: totals.finalPayable.toFixed(2), referenceNo: 'UPI-' + Date.now().toString().slice(-6) }
  ]);
  const [activeTab, setActiveTab] = useState<PaymentMode>(PaymentMode.UPI);
  const [customerPan, setCustomerPan] = useState(customer?.pan || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/billing/new');
    }
  }, [items, navigate]);

  const totalTendered = tenders.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
  const remainingDue = Math.max(0, totals.finalPayable - totalTendered);
  const cashTenderAmount = tenders
    .filter((t) => t.mode === PaymentMode.CASH)
    .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

  const isPanRequired = totals.finalPayable >= 200000;
  const isCashExceeded = cashTenderAmount > 199999;

  // Single dynamic UPI intent URL string
  const upiIntentString = `upi://pay?pa=kamaljewellers@icici&pn=Kamal%20Jewellers&am=${totals.finalPayable.toFixed(2)}&cu=INR&tn=POS%20Invoice`;

  const handleSetSingleMode = (mode: PaymentMode) => {
    setActiveTab(mode);
    setTenders([{ mode, amount: totals.finalPayable.toFixed(2), referenceNo: mode === PaymentMode.CASH ? undefined : `${mode}-${Date.now().toString().slice(-4)}` }]);
  };

  const handleFinalizeInvoice = async () => {
    if (Math.abs(remainingDue) > 1) {
      addToast(`Full invoice amount must be tendered. Pending: ₹${remainingDue.toFixed(2)}`, 'warning');
      return;
    }

    if (isPanRequired && (!customerPan || customerPan.length !== 10)) {
      addToast('Mandatory PAN Number is required for transactions ≥ ₹2,00,000 under Rule 114B', 'error');
      return;
    }

    if (isCashExceeded) {
      addToast('Section 269ST Violation: Single cash payment cannot exceed ₹1,99,999', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: customer?.id,
        customerName: customer?.name || 'Walk-in Showroom Guest',
        customerMobile: customer?.mobile || '9999999999',
        customerPan: customerPan || undefined,
        items: items.map((i) => ({
          itemId: i.itemId || i.item?.id,
          itemCode: i.itemCode,
          designTitle: i.designTitle,
          metal: i.metal,
          purity: i.purity,
          fineness: i.fineness || (i.item as any)?.fineness,
          grossWeight: i.grossWeight,
          netWeight: i.netWeight,
          rateApplied: i.breakdown?.rateApplied || i.boardRate,
          masterRate: i.breakdown?.masterRate || i.masterRate || i.boardRate,
          isRateOverridden: i.isRateOverridden || false,
          overrideReason: i.overrideReason,
          baseMetalValue: i.breakdown?.baseMetalValue || i.baseMetalValue,
          makingCharges: i.breakdown?.makingCharges || i.makingChargesTotal,
          wastageValue: i.breakdown?.wastageValue || i.wastageValue,
          stoneValue: i.breakdown?.stoneValue || i.stoneValue,
          taxableAmount: i.breakdown?.taxableAmount || i.taxableAmount,
          taxPercent: i.breakdown?.taxPercent || i.taxPercent,
          taxAmount: i.breakdown?.taxAmount || i.taxAmount,
          totalAmount: i.breakdown?.totalAmount || i.finalPrice,
          huid: i.huid
        })),
        oldGoldTransactionId: oldGoldTradeIn?.id,
        oldGoldDeduction: totals.oldGoldDeduction.toFixed(2),
        subtotalMetal: totals.subtotalMetal.toFixed(2),
        subtotalMaking: totals.subtotalMaking.toFixed(2),
        discountAmount: totals.discountAmount.toFixed(2),
        taxableAmount: totals.taxableAmount.toFixed(2),
        taxAmount: totals.taxAmount.toFixed(2),
        roundOff: '0.00',
        finalPayable: totals.finalPayable.toFixed(2),
        payments: tenders
      };

      const invoice = await api.post<Invoice>('/invoices', payload);
      clearCart();
      addToast(`Tax Invoice ${invoice.invoiceNumber} Generated Successfully!`, 'success');
      navigate(`/bills/${invoice.id}`);
    } catch (err: any) {
      addToast(err.message || 'Invoice generation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          to="/billing/new"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Billing Cart</span>
        </Link>
        <span className="text-xs font-mono font-bold text-slate-500">
          Total Payable: <span className="text-slate-900 font-bold">₹{Number(totals.finalPayable).toLocaleString('en-IN')}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Tender Mode & UPI QR (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Select Settlement Tender Mode
            </h2>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Full Settlement: ₹{Number(totals.finalPayable).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Tender Mode Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { mode: PaymentMode.UPI, label: 'Dynamic UPI QR', icon: Smartphone },
              { mode: PaymentMode.CARD_CREDIT, label: 'Card Swipe / POS', icon: CreditCard },
              { mode: PaymentMode.CASH, label: 'Cash Tender', icon: Banknote },
              { mode: PaymentMode.NET_BANKING, label: 'NEFT / RTGS', icon: Building2 }
            ].map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSetSingleMode(mode)}
                className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all ${
                  activeTab === mode
                    ? 'border-amber-500 bg-amber-50/60 text-amber-950 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${activeTab === mode ? 'text-amber-600' : 'text-slate-500'}`} />
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>

          {/* DYNAMIC UPI QR DISPLAY */}
          {activeTab === PaymentMode.UPI && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 text-center space-y-3">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Scan & Pay via any UPI App (GPay / PhonePe / Paytm / BHIM)
              </div>
              <div className="inline-block p-3 bg-white rounded-2xl shadow-xl">
                <QRCodeSvg value={upiIntentString} size={160} />
              </div>
              <div className="text-xs font-mono text-slate-300">
                Amount: <span className="font-bold text-emerald-400 text-base">₹{Number(totals.finalPayable).toLocaleString('en-IN')}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                VPA: kamaljewellers@icici • Kamalsons Jewellers Pvt Ltd
              </div>
            </div>
          )}

          {/* CASH / CARD / NEFT REFERENCE INPUT */}
          {activeTab !== PaymentMode.UPI && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Settled Amount (₹)
                </label>
                <input
                  type="number"
                  value={tenders[0]?.amount || totals.finalPayable}
                  onChange={(e) => setTenders([{ ...tenders[0], amount: e.target.value }])}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs"
                />
              </div>

              {activeTab !== PaymentMode.CASH && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bank Auth Code / UTR / Reference No
                  </label>
                  <input
                    type="text"
                    value={tenders[0]?.referenceNo || ''}
                    onChange={(e) => setTenders([{ ...tenders[0], referenceNo: e.target.value }])}
                    placeholder="e.g. UTR891238491"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Statutory PAN Compliance & Finalize (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Statutory Rule 114B PAN Warning Box */}
          {isPanRequired && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>Statutory PAN Required (≥ ₹2 Lakhs)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                As per Income Tax Rule 114B, quoting valid PAN is mandatory for jewellery transactions exceeding ₹2,00,000.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1 uppercase">Customer PAN Number *</label>
                <input
                  type="text"
                  maxLength={10}
                  value={customerPan}
                  onChange={(e) => setCustomerPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono uppercase font-bold text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  required
                />
              </div>
            </div>
          )}

          {/* Section 269ST Cash Limit Alert */}
          {isCashExceeded && (
            <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 text-xs text-red-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>Section 269ST Cash Breach Alert!</span>
              </div>
              <p className="text-[11px] text-red-800">
                Cash receipts of ₹2,00,000 or more in a single day are prohibited by Income Tax law. Please split into Card or UPI.
              </p>
            </div>
          )}

          {/* Summary Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 text-xs font-mono">
            <div className="flex justify-between text-slate-600">
              <span>Customer:</span>
              <span className="font-bold text-slate-900 font-sans">{customer?.name || 'Walk-in Guest'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Items:</span>
              <span className="font-bold text-slate-900">{items.length} Piece(s)</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Gross Metal Wt:</span>
              <span className="font-bold text-slate-900">{items.reduce((a, i) => a + parseFloat(i.grossWeight), 0).toFixed(3)} g</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-slate-900 text-sm font-bold">
              <span>Payable:</span>
              <span className="text-amber-700">₹{Number(totals.finalPayable).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            onClick={handleFinalizeInvoice}
            disabled={isSubmitting || isCashExceeded}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all active:scale-98"
          >
            <ShieldCheck className="w-5 h-5 text-slate-950" />
            <span>{isSubmitting ? 'Finalizing Invoice...' : 'Generate & Print GST Tax Invoice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
