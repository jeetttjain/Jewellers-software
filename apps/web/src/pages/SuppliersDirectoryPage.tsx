import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { Supplier } from '@jewellery-pos/shared';
import {
  Truck,
  Search,
  Plus,
  Phone,
  CreditCard,
  ChevronRight,
  X,
  Building2,
  FileText,
  Clock,
  ShieldCheck
} from 'lucide-react';

export const SuppliersDirectoryPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [stateCode, setStateCode] = useState('27');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [notes, setNotes] = useState('');

  const { addToast } = useToast();

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const list = await api.get<Supplier[]>('/suppliers');
      setSuppliers(list);
    } catch (err: any) {
      addToast(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !supplierCode || !mobile) {
      addToast('Name, supplier code, and mobile are required.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const created = await api.post<Supplier>('/suppliers', {
        name,
        supplierCode: supplierCode.toUpperCase(),
        mobile,
        email: email || undefined,
        pan: pan ? pan.toUpperCase() : undefined,
        gstin: gstin ? gstin.toUpperCase() : undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        stateCode: stateCode || undefined,
        paymentTermsDays: Number(paymentTermsDays) || 30,
        openingBalance: openingBalance || '0.00',
        notes: notes || undefined
      });

      setSuppliers((prev) => [created, ...prev]);
      setIsNewModalOpen(false);
      resetForm();
      addToast(`Supplier ${created.name} (${created.supplierCode}) registered!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to add supplier', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setSupplierCode('');
    setMobile('');
    setEmail('');
    setPan('');
    setGstin('');
    setAddress('');
    setCity('');
    setState('Maharashtra');
    setStateCode('27');
    setPaymentTermsDays('30');
    setOpeningBalance('0.00');
    setNotes('');
  };

  // State Code auto-fill from GSTIN
  const handleGstinChange = (val: string) => {
    setGstin(val);
    if (val.length >= 2 && /^\d{2}/.test(val)) {
      setStateCode(val.substring(0, 2));
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
      s.mobile.includes(search) ||
      (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (s.pan && s.pan.toLowerCase().includes(search.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  );

  const totalOutstanding = suppliers.reduce(
    (acc, s) => acc + parseFloat(s.currentBalance || '0.00'),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <span>Supplier & Karigar Master</span>
          </h1>
          <p className="text-xs text-slate-500">
            Vendor profiles, GSTIN credentials, purchase ledgers, and accounts payable
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setSupplierCode('SUP-' + (suppliers.length + 101).toString());
            setIsNewModalOpen(true);
          }}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Vendors</div>
          <div className="text-2xl font-serif font-bold text-slate-900 mt-1">{suppliers.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Bullion & ornament suppliers</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Outstanding Payable</div>
          <div className={`text-2xl font-serif font-bold mt-1 ${totalOutstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Net accounts payable liabilities</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">GST Compliance</div>
          <div className="text-2xl font-serif font-bold text-slate-900 mt-1">
            {suppliers.filter((s) => s.gstin).length} / {suppliers.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Vendors with registered GSTIN</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier name, code, mobile, GSTIN, PAN, or city..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading Supplier Directory...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No suppliers found</p>
            <p className="text-[11px] text-slate-400">
              {search ? 'No vendors matched your search criteria.' : 'Start by registering your bullion/ornament suppliers.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Supplier / Code</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">GSTIN & PAN</th>
                  <th className="py-3 px-4">Location / State</th>
                  <th className="py-3 px-4 text-right">Current Payable</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((s) => {
                  const bal = parseFloat(s.currentBalance || '0.00');
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <Link to={`/suppliers/${s.id}`} className="font-bold text-slate-900 hover:text-amber-600 flex items-center gap-1.5">
                          <span>{s.name}</span>
                          {!s.isActive && (
                            <span className="text-[9px] px-1 py-0.2 bg-slate-200 text-slate-600 rounded">Inactive</span>
                          )}
                        </Link>
                        <span className="text-[10px] font-mono text-slate-400">{s.supplierCode}</span>
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{s.mobile}</span>
                        </div>
                        {s.email && <div className="text-[10px] text-slate-400">{s.email}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] space-y-0.5">
                        {s.gstin ? (
                          <div className="text-slate-800 font-bold">{s.gstin}</div>
                        ) : (
                          <div className="text-slate-400 italic text-[10px]">No GSTIN</div>
                        )}
                        {s.pan && <div className="text-[10px] text-slate-500">PAN: {s.pan}</div>}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{s.city || '—'}</div>
                        <div className="text-[10px] text-slate-400">{s.state || 'Maharashtra'} (Code: {s.stateCode || '27'})</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-mono font-bold ${bal > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                          ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-slate-400">Terms: {s.paymentTermsDays} Days</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          to={`/suppliers/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg transition-colors"
                        >
                          <span>Ledger</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Supplier Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                <span>Register New Supplier / Karigar</span>
              </h2>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Raj Bullion & Ornaments"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SUP-RAJ-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendor@domain.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GSTIN (15 Alphanumeric)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value.toUpperCase())}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PAN (10 Alphanumeric)
                  </label>
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Showroom / Workshop Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Landmark, Area"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State Code</label>
                  <input
                    type="text"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    placeholder="e.g. 27"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Credit Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    placeholder="30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="text"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Terms</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special hallmark / courier / payment terms"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSaving ? 'Registering...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
