import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api/client.js';
import { JewelleryItemSummary, Customer, GoldRateSnapshot, Metal, PurityKarat, ItemStatus, OldGoldTransaction } from '@jewellery-pos/shared';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Trash2, 
  User, 
  Scale, 
  CreditCard, 
  Tag, 
  Sparkles, 
  X, 
  ChevronRight, 
  ShieldCheck,
  UserPlus,
  ZoomIn,
  Image as ImageIcon
} from 'lucide-react';
import { ImageLightboxModal } from '../components/common/ImageLightboxModal.js';
import { ProductImageThumbnail } from '../components/common/ProductImageThumbnail.js';

export const BillingTerminalPage: React.FC = () => {
  const { items, customer, oldGoldTradeIn, addItem, addCustomItem, removeItem, updateDiscount, setCustomer, attachOldGoldTradeIn, clearCart, totals } = useCart();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Search Catalog Items
  const [catalog, setCatalog] = useState<JewelleryItemSummary[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Item Details Confirmation Modal State
  const [pendingQuote, setPendingQuote] = useState<{ item: JewelleryItemSummary; breakdown: any } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isOverridingRate, setIsOverridingRate] = useState(false);
  const [overrideRateVal, setOverrideRateVal] = useState('');
  const [overrideReasonVal, setOverrideReasonVal] = useState('');

  // Customer Autocomplete
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustPan, setNewCustPan] = useState('');

  // Custom Item Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('Custom Order Piece');
  const [customMetal, setCustomMetal] = useState<Metal>(Metal.GOLD);
  const [customPurity, setCustomPurity] = useState<PurityKarat>(PurityKarat.K22);
  const [customGrossWt, setCustomGrossWt] = useState('10.000');
  const [customNetWt, setCustomNetWt] = useState('10.000');
  const [customMc, setCustomMc] = useState('4500.00');
  const [customHuid, setCustomHuid] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [itemsRes, custRes] = await Promise.all([
        api.get<JewelleryItemSummary[]>('/items', { params: { status: 'IN_STOCK' } }),
        api.get<Customer[]>('/customers')
      ]);
      setCatalog(itemsRes);
      setCustomersList(custRes);
    } catch {
      // Fallback
    }
  };

  const handleResolveItem = async (code: string) => {
    if (!code || !code.trim()) return;
    const clean = code.replace(/^pos:\/\/t\//, '').trim();

    // Prevent duplicate items in cart
    const isDuplicate = items.some(
      (ci) =>
        ci.itemCode.toLowerCase() === clean.toLowerCase() ||
        (ci.item?.id && ci.item.id === clean)
    );
    if (isDuplicate) {
      addToast(`This item (${clean}) is already added to the bill.`, 'error');
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.get<{ item: JewelleryItemSummary; breakdown: any }>(`/scan/lookup?code=${encodeURIComponent(clean)}`);
      setPendingQuote(res);
      setIsOverridingRate(false);
      setOverrideRateVal(res.breakdown.rateApplied);
      setOverrideReasonVal('');
      setIsConfirmModalOpen(true);
    } catch (err: any) {
      addToast(err.message || `Item code '${clean}' was not found`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmAddToCart = () => {
    if (!pendingQuote) return;
    try {
      const masterRate = pendingQuote.breakdown.masterRate || pendingQuote.breakdown.rateApplied;
      const appliedRate = isOverridingRate && overrideRateVal ? overrideRateVal : pendingQuote.breakdown.rateApplied;

      addItem(pendingQuote.item, appliedRate, {
        isRateOverridden: isOverridingRate && appliedRate !== masterRate,
        masterRate,
        overrideReason: isOverridingRate ? overrideReasonVal : undefined
      });

      addToast(
        isOverridingRate && appliedRate !== masterRate
          ? `Added ${pendingQuote.item.itemCode} with rate override (₹${appliedRate}/g)`
          : `Added ${pendingQuote.item.itemCode} to cart`,
        'success'
      );
      setSearchCode('');
      setIsConfirmModalOpen(false);
      setPendingQuote(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to add item to cart', 'error');
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.post<Customer>('/customers', {
        name: newCustName,
        mobile: newCustMobile,
        pan: newCustPan || undefined
      });
      setCustomer(created);
      setCustomersList((prev) => [created, ...prev]);
      setIsNewCustModalOpen(false);
      setNewCustName('');
      setNewCustMobile('');
      setNewCustPan('');
      addToast(`Customer ${created.name} selected`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to create customer', 'error');
    }
  };

  const handleAddCustomPiece = () => {
    const gross = parseFloat(customGrossWt) || 0;
    const net = parseFloat(customNetWt) || 0;
    const mc = parseFloat(customMc) || 0;
    const rate = customPurity === PurityKarat.K24 ? 7450 : 6980;
    const baseMetal = (net * rate).toFixed(2);
    const taxable = (parseFloat(baseMetal) + mc).toFixed(2);
    const tax = (parseFloat(taxable) * 0.03).toFixed(2);
    const total = (parseFloat(taxable) + parseFloat(tax)).toFixed(2);

    addCustomItem({
      designTitle: customTitle,
      metal: customMetal,
      purity: customPurity,
      grossWeight: gross.toFixed(3),
      netWeight: net.toFixed(3),
      makingCharges: mc.toFixed(2),
      huid: customHuid || undefined,
      breakdown: {
        rateApplied: rate.toFixed(2),
        baseMetalValue: baseMetal,
        makingCharges: mc.toFixed(2),
        wastageValue: '0.00',
        stoneValue: '0.00',
        taxableAmount: taxable,
        taxPercent: '3.00',
        taxAmount: tax,
        totalAmount: total
      }
    });

    setIsCustomModalOpen(false);
    addToast('Custom jewellery item added to POS cart', 'success');
  };

  const filteredCustomers = customersList.filter(
    (c) => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.mobile.includes(custSearch)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-slate-900">
            Showroom POS Billing Terminal
          </h1>
          <p className="text-xs text-slate-500">
            Live metal rates, itemized making charges, Old Gold exchange, and split settlement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-600" />
            <span>Add Custom Order Item</span>
          </button>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Cart Items & Barcode Scanner Bar (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Rapid Add Bar / Barcode & Item Code Manual Search */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleResolveItem(searchCode);
                }}
                placeholder="Scan barcode / Enter Item Code (e.g. RN-10245, JWL-BCK-001)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => handleResolveItem(searchCode)}
              disabled={isSearching || !searchCode.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>ADD ITEM</span>
            </button>
          </div>

          {/* Quick Catalog Picker Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">Stock:</span>
            {catalog.slice(0, 5).map((catItem) => (
              <button
                key={catItem.id}
                onClick={() => handleResolveItem(catItem.itemCode)}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors bg-white border border-slate-200 hover:border-amber-400 text-slate-700"
              >
                {catItem.itemCode} ({catItem.netWeight}g)
              </button>
            ))}
          </div>

          {/* Cart Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <p className="text-xs font-semibold">POS Cart is Empty</p>
                <p className="text-[11px] text-slate-400">Scan or select jewellery items above to begin billing</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 bg-slate-50">
                      <th className="py-2.5 px-3">Item / Design</th>
                      <th className="py-2.5 px-3">Weights (G/N)</th>
                      <th className="py-2.5 px-3 text-right">Metal Value</th>
                      <th className="py-2.5 px-3 text-right">Making Chg</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {items.map((ci) => {
                      const itemKey = ci.tempId || ci.id || Math.random().toString();
                      const baseMetalVal = ci.breakdown?.baseMetalValue ?? ci.baseMetalValue ?? '0.00';
                      const makingChgVal = ci.breakdown?.makingCharges ?? ci.makingChargesTotal ?? '0.00';
                      const totalVal = ci.breakdown?.totalAmount ?? ci.finalPrice ?? '0.00';

                      return (
                        <tr key={itemKey} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-sans font-bold text-slate-900 text-xs line-clamp-1">{ci.designTitle}</div>
                            <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1">
                              <span>{ci.itemCode}</span>
                              <span>•</span>
                              <span>{ci.purity}</span>
                              {ci.fineness ? (
                                <span>({ci.fineness})</span>
                              ) : null}
                              {ci.huid && (
                                <span className="text-amber-700 font-bold">HUID: {ci.huid}</span>
                              )}
                              {ci.isRateOverridden && (
                                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded font-sans">
                                  Override: ₹{ci.boardRate}/g
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-700">
                            <div>G: {ci.grossWeight}g</div>
                            <div className="font-bold text-amber-900">N: {ci.netWeight}g</div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-800 font-semibold">
                            ₹{baseMetalVal}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-800">
                            ₹{makingChgVal}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 text-sm">
                            ₹{Number(totalVal).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => removeItem(ci.tempId || ci.id)}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Attached Old Scrap Gold Trade-In Banner */}
          {oldGoldTradeIn && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                  <Scale className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-amber-950">
                    Old Scrap Gold Trade-In Voucher Attached
                  </div>
                  <div className="text-amber-800 font-mono text-[11px]">
                    Voucher: {oldGoldTradeIn.transactionNumber} • {oldGoldTradeIn.fineWeightGrams}g Fine Gold Credit
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-amber-900 font-mono">
                  - ₹{Number(oldGoldTradeIn.totalValuation).toLocaleString('en-IN')}
                </span>
                <button
                  onClick={() => attachOldGoldTradeIn(null)}
                  className="block text-[10px] text-red-600 hover:underline mt-0.5"
                >
                  Detach
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Customer KYC & Billing Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Customer Selection Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-900">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-600" />
                <span>Customer & KYC Profile</span>
              </div>
              <button
                onClick={() => setIsNewCustModalOpen(true)}
                className="text-[11px] text-amber-700 hover:text-amber-800 flex items-center gap-0.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Customer</span>
              </button>
            </div>

            {customer ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-900">{customer.name}</div>
                  <div className="text-slate-500 font-mono">{customer.mobile}</div>
                  {customer.pan && (
                    <div className="text-[10px] text-emerald-700 font-bold font-mono">PAN: {customer.pan}</div>
                  )}
                </div>
                <button
                  onClick={() => setCustomer(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={custSearch}
                  onChange={(e) => {
                    setCustSearch(e.target.value);
                    setShowCustDropdown(true);
                  }}
                  onFocus={() => setShowCustDropdown(true)}
                  placeholder="Search customer by name or phone..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
                />

                {showCustDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setCustomer(c);
                          setShowCustDropdown(false);
                          setCustSearch('');
                        }}
                        className="p-2 hover:bg-amber-50 cursor-pointer text-xs border-b border-slate-100 last:border-0"
                      >
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.mobile} • PAN: {c.pan || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totals & Price Breakdown Card */}
          <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Taxable Invoice Breakdown
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Base Metal Subtotal:</span>
                <span className="font-bold text-white">₹{totals.subtotalMetal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Making Charges Total:</span>
                <span className="font-bold text-white">₹{totals.subtotalMaking.toFixed(2)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex justify-between items-center text-slate-300 py-1">
                <span>Discount / Concession:</span>
                <div className="flex items-center gap-1 w-24">
                  <span className="text-slate-500">₹</span>
                  <input
                    type="number"
                    value={totals.discountAmount}
                    onChange={(e) => updateDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-400">
                <span>Taxable Value:</span>
                <span className="text-slate-200">₹{totals.taxableAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-amber-400 font-semibold">
                <span>GST (3% Output Tax):</span>
                <span>₹{totals.taxAmount.toFixed(2)}</span>
              </div>

              {totals.oldGoldDeduction > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Old Scrap Gold Credit:</span>
                  <span>- ₹{totals.oldGoldDeduction.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-700 pt-3 text-lg font-bold">
                <span className="text-white">Net Payable:</span>
                <span className="text-amber-400">₹{Number(totals.finalPayable).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (items.length === 0) {
                  addToast('Please add items to cart before proceeding', 'warning');
                  return;
                }
                navigate('/billing/payment');
              }}
              disabled={items.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-98"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Split Settlement (₹{Number(totals.finalPayable).toLocaleString('en-IN')})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* NEW CUSTOMER MODAL */}
      {isNewCustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">Register New Customer</h3>
              <button onClick={() => setIsNewCustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Smt. Kavita Mehta"
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  value={newCustMobile}
                  onChange={(e) => setNewCustMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PAN Card Number (Required for ≥ ₹2L)</label>
                <input
                  type="text"
                  maxLength={10}
                  value={newCustPan}
                  onChange={(e) => setNewCustPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono uppercase font-bold text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-xs"
                >
                  Save & Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM ORDER PIECE MODAL */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Add Custom / Untagged Jewellery Piece</span>
              </h3>
              <button onClick={() => setIsCustomModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Design Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purity Karat</label>
                  <select
                    value={customPurity}
                    onChange={(e) => setCustomPurity(e.target.value as PurityKarat)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  >
                    <option value={PurityKarat.K22}>22K (91.6% Hallmark)</option>
                    <option value={PurityKarat.K24}>24K (99.9% Pure)</option>
                    <option value={PurityKarat.K18}>18K (75.0% Diamond)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">BIS HUID (Optional)</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={customHuid}
                    onChange={(e) => setCustomHuid(e.target.value.toUpperCase())}
                    placeholder="e.g. AH8921"
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono uppercase font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gross Wt (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={customGrossWt}
                    onChange={(e) => setCustomGrossWt(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Net Metal (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={customNetWt}
                    onChange={(e) => setCustomNetWt(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Making Chg (₹)</label>
                  <input
                    type="number"
                    value={customMc}
                    onChange={(e) => setCustomMc(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomPiece}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-xs"
                >
                  Add Custom Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Confirmation Modal (Scan or Manual Entry Fallback) */}
      {isConfirmModalOpen && pendingQuote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-sm">
                    Item Found & Price Verified
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Code: {pendingQuote.item.itemCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsConfirmModalOpen(false); setPendingQuote(null); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Image Display with Zoom Lightbox Trigger */}
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <ProductImageThumbnail
                imageUrl={pendingQuote.item.imageUrl || pendingQuote.item.images?.[0]?.imageUrl}
                size="full"
                onClick={() => {
                  if (pendingQuote.item.imageUrl || (pendingQuote.item.images && pendingQuote.item.images.length > 0)) {
                    setIsLightboxOpen(true);
                  }
                }}
                zoomable={!!(pendingQuote.item.imageUrl || pendingQuote.item.images?.length)}
                alt={pendingQuote.item.designTitle}
                className="max-h-44 object-contain"
              />
              {pendingQuote.item.imageUrl || (pendingQuote.item.images && pendingQuote.item.images.length > 0) ? (
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="mt-2 text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 underline cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Tap image to view full size & zoom</span>
                </button>
              ) : (
                <span className="mt-1 text-[10px] text-slate-400 font-medium">No product image available</span>
              )}
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between font-sans font-bold text-slate-900">
                  <span>{pendingQuote.item.designTitle}</span>
                  <span className="text-amber-700">{pendingQuote.item.purity} {pendingQuote.item.metal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Gross Wt: {pendingQuote.item.grossWeight}g</span>
                  <span>Net Wt: {pendingQuote.item.netWeight}g</span>
                </div>
                {pendingQuote.item.huid && (
                  <div className="text-[11px] text-amber-800 font-bold">
                    BIS HUID: {pendingQuote.item.huid}
                  </div>
                )}
                {(pendingQuote.item as any).fineness && (
                  <div className="text-[11px] text-slate-500 font-bold">
                    Fineness Ratio: {(pendingQuote.item as any).fineness}
                  </div>
                )}
              </div>

              {/* Rate Override Section */}
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <span>Showroom Master Rate:</span>
                    <span className="font-mono text-amber-800">₹{pendingQuote.breakdown.masterRate || pendingQuote.breakdown.rateApplied}/g</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOverridingRate(!isOverridingRate);
                      if (!isOverridingRate) {
                        setOverrideRateVal(pendingQuote.breakdown.rateApplied);
                      }
                    }}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-800 underline"
                  >
                    {isOverridingRate ? 'Cancel Override' : 'Override Rate'}
                  </button>
                </div>

                {isOverridingRate && (
                  <div className="space-y-2 pt-1.5 border-t border-amber-200">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Applied Rate (₹/g) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={overrideRateVal}
                          onChange={(e) => setOverrideRateVal(e.target.value)}
                          className="w-full bg-white border border-amber-400 rounded p-1.5 font-mono font-bold text-xs"
                          placeholder="e.g. 6900.00"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Reason / Note</label>
                        <input
                          type="text"
                          value={overrideReasonVal}
                          onChange={(e) => setOverrideReasonVal(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                          placeholder="e.g. Negotiated bulk discount"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-amber-900 italic">
                      Notice: This override applies strictly to this sale line and will NOT permanently modify the Rate Master.
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs font-mono border-t border-slate-100 pt-3">
                <div className="flex justify-between text-slate-600">
                  <span>Applied Metal Rate:</span>
                  <span className="font-bold text-slate-900">
                    ₹{isOverridingRate && overrideRateVal ? overrideRateVal : pendingQuote.breakdown.rateApplied}/g
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Base Metal Value:</span>
                  <span>
                    ₹{(
                      parseFloat(pendingQuote.item.netWeight) *
                      parseFloat(isOverridingRate && overrideRateVal ? overrideRateVal : pendingQuote.breakdown.rateApplied)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Making Charges ({pendingQuote.item.makingChargeType}):</span>
                  <span>₹{pendingQuote.breakdown.makingCharges}</span>
                </div>
                {parseFloat(pendingQuote.breakdown.stoneValue || '0') > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Stone Charges:</span>
                    <span>₹{pendingQuote.breakdown.stoneValue}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>GST Tax (3%):</span>
                  <span>₹{pendingQuote.breakdown.taxAmount}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm border-t border-slate-200 pt-2">
                  <span>ESTIMATED PRICE:</span>
                  <span className="text-amber-700">
                    ₹{(
                      (
                        parseFloat(pendingQuote.item.netWeight) *
                          parseFloat(isOverridingRate && overrideRateVal ? overrideRateVal : pendingQuote.breakdown.rateApplied) +
                        parseFloat(pendingQuote.breakdown.makingCharges || '0') +
                        parseFloat(pendingQuote.breakdown.wastageValue || '0') +
                        parseFloat(pendingQuote.breakdown.stoneValue || '0')
                      ) * 1.03
                    ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setIsConfirmModalOpen(false); setPendingQuote(null); }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddToCart}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                ADD TO BILL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Zoom Modal for Visual Verification */}
      {pendingQuote && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          images={
            pendingQuote.item.images && pendingQuote.item.images.length > 0
              ? pendingQuote.item.images
              : pendingQuote.item.imageUrl
              ? [{ url: pendingQuote.item.imageUrl, label: 'Main Product' }]
              : []
          }
          itemTitle={pendingQuote.item.designTitle}
          itemCode={pendingQuote.item.itemCode}
        />
      )}
    </div>
  );
};
