import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { Customer, CustomerLedgerEntry, Invoice } from '@jewellery-pos/shared';
import { ArrowLeft, User, Phone, MapPin, CreditCard, Receipt, PlusCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ customer: Customer; ledger: CustomerLedgerEntry[]; invoices: Invoice[] } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { addToast } = useToast();

  useEffect(() => {
    if (id) loadCustomer(id);
  }, [id]);

  const loadCustomer = async (cid: string) => {
    setIsLoading(true);
    try {
      const res = await api.get<{ customer: Customer; ledger: CustomerLedgerEntry[]; invoices: Invoice[] }>(
        `/customers/${cid}`
      );
      setData(res);
      if (parseFloat(res.customer.ledgerBalance) > 0) {
        setPayAmount(res.customer.ledgerBalance);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettleDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !id) return;
    setIsPaying(true);
    try {
      const res = await api.post<{ customer: Customer; receiptNumber: string }>(
        `/customers/${id}/payment`,
        {
          amount: payAmount,
          mode: payMode,
          referenceNo: payRef || undefined
        }
      );
      addToast(`Payment recorded! Voucher: ${res.receiptNumber}`, 'success');
      loadCustomer(id);
    } catch (err: any) {
      addToast(err.message || 'Payment recording failed', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono font-bold text-slate-700">Loading Customer Ledger Account...</p>
      </div>
    );
  }

  const { customer, ledger, invoices } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </Link>
        <span className="text-xs font-mono font-bold text-slate-500">ID: {customer.id}</span>
      </div>

      {/* Customer Profile Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
              {customer.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {customer.mobile}
                </span>
                {customer.pan && (
                  <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    PAN: {customer.pan}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Ledger Balance Due</span>
            <span className={`text-xl font-mono font-bold ${parseFloat(customer.ledgerBalance) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              ₹{Number(customer.ledgerBalance).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Record Payment Voucher Section */}
      {parseFloat(customer.ledgerBalance) > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-900 mb-3 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-red-600" />
            <span>Record Dues Settlement Voucher</span>
          </h3>

          <form onSubmit={handleSettleDue} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount to Settle (₹)</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
              >
                <option value="UPI">UPI QR</option>
                <option value="CASH">Cash</option>
                <option value="CARD_CREDIT">Card</option>
                <option value="NET_BANKING">Bank NEFT</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reference # (Optional)</label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="UPI / UTR Ref"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isPaying}
              className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors"
            >
              {isPaying ? 'Recording...' : 'Issue Receipt Voucher'}
            </button>
          </form>
        </div>
      )}

      {/* Ledger History */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
          Chronological Khata Ledger Statement
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Ref #</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Debit (+)</th>
                <th className="py-2.5 px-3 text-right">Credit (-)</th>
                <th className="py-2.5 px-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-3 px-3 text-slate-600">{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{entry.type}</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{entry.referenceNo}</td>
                  <td className="py-3 px-3 text-slate-700">{entry.description}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {parseFloat(entry.debit) > 0 ? `₹${entry.debit}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                    {parseFloat(entry.credit) > 0 ? `₹${entry.credit}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    ₹{entry.runningBalance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
