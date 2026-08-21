import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { Supplier, SupplierLedgerEntry, Purchase } from '@jewellery-pos/shared';
import {
  ArrowLeft,
  Truck,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Receipt,
  PlusCircle,
  CheckCircle2,
  Building2,
  FileText,
  Clock,
  Edit2,
  X,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    supplier: Supplier;
    summary: {
      openingBalance: string;
      totalPurchases: string;
      totalPayments: string;
      totalReturns: string;
      currentOutstanding: string;
    };
    entries: SupplierLedgerEntry[];
  } | null>(null);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PURCHASES'>('LEDGER');
  const [isLoading, setIsLoading] = useState(true);

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Edit Supplier Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPan, setEditPan] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editStateCode, setEditStateCode] = useState('');
  const [editPaymentTermsDays, setEditPaymentTermsDays] = useState('30');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNotes, setEditNotes] = useState('');
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    if (id) {
      loadSupplierLedger(id);
      loadSupplierPurchases(id);
    }
  }, [id]);

  const loadSupplierLedger = async (suppId: string) => {
    setIsLoading(true);
    try {
      const res = await api.get<any>(`/suppliers/${suppId}/ledger`);
      setData(res);
      if (parseFloat(res.supplier.currentBalance) > 0) {
        setPayAmount(res.supplier.currentBalance);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to load supplier profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSupplierPurchases = async (suppId: string) => {
    try {
      const list = await api.get<Purchase[]>(`/purchases?supplierId=${suppId}`);
      setPurchases(list);
    } catch {
      // purchases optional load
    }
  };

  const openEditModal = () => {
    if (!data) return;
    const s = data.supplier;
    setEditName(s.name);
    setEditMobile(s.mobile);
    setEditEmail(s.email || '');
    setEditPan(s.pan || '');
    setEditGstin(s.gstin || '');
    setEditAddress(s.address || '');
    setEditCity(s.city || '');
    setEditState(s.state || 'Maharashtra');
    setEditStateCode(s.stateCode || '27');
    setEditPaymentTermsDays(s.paymentTermsDays.toString());
    setEditIsActive(s.isActive);
    setEditNotes(s.notes || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsUpdatingSupplier(true);
    try {
      const updated = await api.put<Supplier>(`/suppliers/${id}`, {
        name: editName,
        mobile: editMobile,
        email: editEmail || undefined,
        pan: editPan ? editPan.toUpperCase() : undefined,
        gstin: editGstin ? editGstin.toUpperCase() : undefined,
        address: editAddress || undefined,
        city: editCity || undefined,
        state: editState || undefined,
        stateCode: editStateCode || undefined,
        paymentTermsDays: Number(editPaymentTermsDays) || 30,
        isActive: editIsActive,
        notes: editNotes || undefined
      });
      addToast('Supplier profile updated successfully', 'success');
      setIsEditModalOpen(false);
      loadSupplierLedger(id);
    } catch (err: any) {
      addToast(err.message || 'Failed to update supplier', 'error');
    } finally {
      setIsUpdatingSupplier(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !payAmount || parseFloat(payAmount) <= 0) {
      addToast('Please enter a valid payment amount', 'warning');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      // Find open purchase if applicable, or record against latest
      const openPurchase = purchases.find((p) => p.paymentStatus !== 'PAID');
      if (openPurchase) {
        await api.post(`/purchases/${openPurchase.id}/payments`, {
          amount: payAmount,
          mode: payMode,
          referenceNo: payRef || undefined,
          notes: payNotes || undefined
        });
      } else {
        addToast('No open purchase invoice found to link this payment.', 'warning');
        return;
      }

      addToast(`Payment of ₹${payAmount} recorded successfully!`, 'success');
      setIsPayModalOpen(false);
      setPayRef('');
      setPayNotes('');
      loadSupplierLedger(id);
      loadSupplierPurchases(id);
    } catch (err: any) {
      addToast(err.message || 'Payment recording failed', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono font-bold text-slate-700">Loading Supplier Ledger Account...</p>
      </div>
    );
  }

  const { supplier, summary, entries } = data;
  const currentPayable = parseFloat(summary.currentOutstanding || '0.00');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Supplier Directory</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 rounded-md text-slate-600 font-bold">
            {supplier.supplierCode}
          </span>
          <button
            onClick={openEditModal}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Supplier Profile Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-xl">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-serif font-bold text-slate-900">{supplier.name}</h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    supplier.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {supplier.isActive ? 'Active Vendor' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.mobile}
                </span>
                {supplier.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {supplier.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.city ? `${supplier.city}, ${supplier.state || 'Maharashtra'}` : 'Location Unset'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {purchases.some((p) => p.paymentStatus !== 'PAID') && (
              <button
                onClick={() => setIsPayModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Settle Dues / Pay Supplier</span>
              </button>
            )}
          </div>
        </div>

        {/* Tax & Compliance Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">GSTIN</span>
            <span className="font-mono font-bold text-slate-800">{supplier.gstin || 'Unregistered'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">PAN</span>
            <span className="font-mono font-bold text-slate-800">{supplier.pan || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">State / State Code</span>
            <span className="text-slate-800">{supplier.state || 'Maharashtra'} ({supplier.stateCode || '27'})</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Payment Terms</span>
            <span className="text-slate-800 font-bold">{supplier.paymentTermsDays} Days Credit</span>
          </div>
        </div>
      </div>

      {/* Financial Statement KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Opening Balance</div>
          <div className="text-lg font-mono font-bold text-slate-800 mt-1">
            ₹{parseFloat(summary.openingBalance || '0.00').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Initial liability setup</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Total Purchases (Credit)</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">
            ₹{parseFloat(summary.totalPurchases || '0.00').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Inward stock invoices</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Total Payments (Debit)</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-mono font-bold text-emerald-700 mt-1">
            ₹{parseFloat(summary.totalPayments || '0.00').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tenders settled to date</div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Current Balance Due</div>
          <div className="text-xl font-serif font-bold text-white mt-1">
            ₹{currentPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {currentPayable > 0 ? 'Payable to supplier' : 'All accounts settled'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'LEDGER'
              ? 'border-b-2 border-amber-500 text-amber-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Accounts Payable Ledger ({entries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PURCHASES')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'PURCHASES'
              ? 'border-b-2 border-amber-500 text-amber-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Inward Purchase Bills ({purchases.length})</span>
        </button>
      </div>

      {/* TAB 1: LEDGER STATEMENT */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Chronological Ledger Statement
            </h3>
            <span className="text-[10px] text-slate-500">Credit = Payable Increased (+) | Debit = Paid (-)</span>
          </div>

          {entries.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">No ledger transactions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Ref #</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Credit (₹)</th>
                    <th className="py-3 px-4 text-right">Debit (₹)</th>
                    <th className="py-3 px-4 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-mono">
                  {entries.map((e) => {
                    const isCredit = parseFloat(e.credit) > 0;
                    const isDebit = parseFloat(e.debit) > 0;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-600">
                          {new Date(e.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-3 px-4 font-sans font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              e.type === 'PURCHASE_BILL'
                                ? 'bg-amber-100 text-amber-800'
                                : e.type === 'PAYMENT_OUT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {e.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{e.referenceNo}</td>
                        <td className="py-3 px-4 font-sans text-slate-600">{e.description}</td>
                        <td className="py-3 px-4 text-right font-bold text-amber-700">
                          {isCredit ? parseFloat(e.credit).toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {isDebit ? parseFloat(e.debit).toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{parseFloat(e.runningBalance).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INWARD PURCHASES */}
      {activeTab === 'PURCHASES' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {purchases.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No purchase bills recorded for this supplier yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Purchase #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Weight (g)</th>
                    <th className="py-3 px-4 text-right">Taxable (₹)</th>
                    <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                    <th className="py-3 px-4 text-right">Due (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors font-mono">
                      <td className="py-3 px-4 font-bold text-slate-900">{p.purchaseNumber}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(p.purchaseDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{p.metalTotalWeight}g</td>
                      <td className="py-3 px-4 text-right text-slate-700">₹{p.taxableAmount}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">₹{p.grandTotal}</td>
                      <td className="py-3 px-4 text-right font-bold text-amber-700">₹{p.balanceDue}</td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <span>Record Payment Out</span>
              </h2>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="text"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (RTGS / NEFT / IMPS)</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="OLD_GOLD_EXCHANGE">Old Gold Barter Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  UTR / Reference #
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR-982138912"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Cleared 50% advance for 22K chain batch"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSubmittingPayment ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <span>Edit Supplier Profile</span>
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supplier / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PAN</label>
                  <input
                    type="text"
                    value={editPan}
                    onChange={(e) => setEditPan(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State Code</label>
                  <input
                    type="text"
                    value={editStateCode}
                    onChange={(e) => setEditStateCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Credit Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={editPaymentTermsDays}
                    onChange={(e) => setEditPaymentTermsDays(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                    />
                    <span className="text-xs font-bold text-slate-800">Active Vendor</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSupplier}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isUpdatingSupplier ? 'Saving...' : 'Update Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
