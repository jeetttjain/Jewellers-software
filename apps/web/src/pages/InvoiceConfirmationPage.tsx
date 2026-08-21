import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { Invoice } from '@jewellery-pos/shared';
import { BarcodeSvg } from '../components/barcode/BarcodeSvg.js';
import { QRCodeSvg } from '../components/barcode/QRCodeSvg.js';
import { 
  Printer, 
  Download, 
  ArrowLeft, 
  CheckCircle2, 
  Receipt, 
  FileText, 
  Share2, 
  ShieldCheck 
} from 'lucide-react';

const parseMoney = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(num) ? num : 0;
};

const formatMoney = (val: any): string => {
  return parseMoney(val).toFixed(2);
};

const formatCurrency = (val: any): string => {
  return parseMoney(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const InvoiceConfirmationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) loadInvoice(id);
  }, [id]);

  const loadInvoice = async (invId: string) => {
    setIsLoading(true);
    try {
      const data = await api.get<Invoice>(`/invoices/${invId}`);
      setInvoice(data);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono font-bold text-slate-700">Loading GST Tax Invoice...</p>
      </div>
    );
  }

  // Pre-calculate validated monetary values
  const taxableAmount = parseMoney(invoice.taxableAmount);
  const totalTaxAmount = parseMoney(invoice.totalTaxAmount ?? (invoice as any).taxAmount ?? (taxableAmount * 0.03));
  const cgstAmount = parseMoney(invoice.cgstAmount ?? (totalTaxAmount / 2));
  const sgstAmount = parseMoney(invoice.sgstAmount ?? (totalTaxAmount / 2));
  const oldGoldDeduction = parseMoney(invoice.oldGoldDeductionTotal ?? (invoice as any).oldGoldDeduction);
  const grandTotal = parseMoney(invoice.grandTotal ?? (invoice as any).finalPayable ?? (taxableAmount + totalTaxAmount - oldGoldDeduction));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/bills"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Invoices Directory</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setPrintFormat('A4')}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                printFormat === 'A4' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              A4 GST Tax Invoice
            </button>
            <button
              onClick={() => setPrintFormat('THERMAL')}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                printFormat === 'THERMAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              80mm Thermal Slip
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* PRINT CANVAS */}
      {printFormat === 'A4' ? (
        /* ================= A4 GST TAX INVOICE FORMAT ================= */
        <div className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-12 shadow-xl printable-invoice text-slate-900 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-950">
                KAMAL JEWELLERS
              </h1>
              <p className="text-xs text-slate-600">104, Zaveri Bazaar, M.G. Road, Mumbai - 400002</p>
              <p className="text-xs text-slate-600 font-mono">GSTIN: 27AAAAA0000A1Z5 | Phone: +91 98200 12345</p>
            </div>
            <div className="text-right space-y-1">
              <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold rounded text-xs">
                ORIGINAL TAX INVOICE
              </span>
              <div className="font-mono text-sm font-bold text-slate-900 mt-2">
                Invoice #: {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-500">
                Date: {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Billed To Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 text-xs p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Customer / Billed To:</span>
              <div className="font-bold text-sm text-slate-900">{invoice.customerName}</div>
              <div className="text-slate-600 font-mono">{invoice.customerMobile}</div>
            </div>
            <div className="text-left sm:text-right">
              {invoice.customerPan && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Customer PAN Number</span>
                  <div className="font-mono font-bold text-sm text-slate-900">{invoice.customerPan}</div>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-800 text-[10px] uppercase font-bold text-slate-600">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-3">Description & HUID</th>
                  <th className="py-2.5 px-3 text-right">Gross Wt</th>
                  <th className="py-2.5 px-3 text-right">Net Wt</th>
                  <th className="py-2.5 px-3 text-right">Rate/g</th>
                  <th className="py-2.5 px-3 text-right">Metal Value</th>
                  <th className="py-2.5 px-3 text-right">Making</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">GST (3%)</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {invoice.items.map((it, idx) => {
                  const itemMetal = parseMoney(it.metalValue ?? (it as any).baseMetalValue);
                  const itemMaking = parseMoney(it.makingCharges);
                  const itemTaxable = parseMoney(it.taxableAmount ?? (itemMetal + itemMaking));
                  const itemTax = parseMoney(it.taxAmount ?? (itemTaxable * 0.03));
                  const itemTotal = parseMoney(it.finalAmount ?? (it as any).totalAmount ?? (itemTaxable + itemTax));

                  return (
                    <tr key={it.id || idx}>
                      <td className="py-3 px-2 text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-sans">
                        <div className="font-bold text-slate-900">{it.designTitle}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {it.itemCode} • {it.purity} • HUID: <span className="font-bold text-slate-800">{it.huid || 'HALLMARKED'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">{it.grossWeight}g</td>
                      <td className="py-3 px-3 text-right font-bold">{it.netWeight}g</td>
                      <td className="py-3 px-3 text-right">₹{formatMoney(it.boardRate || (it as any).rateApplied)}</td>
                      <td className="py-3 px-3 text-right">₹{formatMoney(itemMetal)}</td>
                      <td className="py-3 px-3 text-right">₹{formatMoney(itemMaking)}</td>
                      <td className="py-3 px-3 text-right font-semibold">₹{formatMoney(itemTaxable)}</td>
                      <td className="py-3 px-3 text-right text-slate-600">₹{formatMoney(itemTax)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">₹{formatCurrency(itemTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary & Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pt-4 border-t border-slate-200 text-xs">
            <div className="space-y-4">
              <div className="text-[11px] text-slate-600 leading-relaxed border p-3 rounded-lg border-slate-200">
                <span className="font-bold block text-slate-900 mb-1">Terms & Hallmarking Guarantee:</span>
                1. Certified that all gold jewellery sold conforms to BIS Hallmarking standards.<br />
                2. Purity & weights unconditionally guaranteed by Kamal Jewellers.<br />
                3. Subject to Mumbai Jurisdiction.
              </div>
              <div className="flex items-center gap-4">
                <BarcodeSvg value={invoice.invoiceNumber} width={160} height={36} />
                <QRCodeSvg value={`pos://inv/${invoice.id}`} size={48} />
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-bold text-slate-900">₹{formatMoney(taxableAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (1.5%):</span>
                <span>₹{formatMoney(cgstAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (1.5%):</span>
                <span>₹{formatMoney(sgstAmount)}</span>
              </div>
              {oldGoldDeduction > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Old Gold Trade-In Credit:</span>
                  <span>- ₹{formatMoney(oldGoldDeduction)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold text-slate-950">
                <span>Grand Total (INR):</span>
                <span className="text-amber-700">₹{formatCurrency(grandTotal)}</span>
              </div>
              <div className="pt-6 text-right font-sans">
                <div className="h-10"></div>
                <div className="border-t border-slate-400 inline-block px-8 pt-1 text-[11px] font-semibold text-slate-700">
                  Authorized Signatory (Kamal Jewellers)
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= 80MM ESC/POS THERMAL SLIP FORMAT ================= */
        <div className="max-w-xs mx-auto bg-white border border-slate-300 p-4 font-mono text-[11px] text-slate-950 space-y-3 shadow-lg printable-thermal">
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-3">
            <div className="font-bold text-sm tracking-tight font-serif">KAMAL JEWELLERS</div>
            <div className="text-[10px]">104, Zaveri Bazaar, Mumbai</div>
            <div className="text-[9px]">GSTIN: 27AAAAA0000A1Z5</div>
            <div className="font-bold text-xs pt-1">RETAIL TAX INVOICE</div>
          </div>

          <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
            <div>Inv #: {invoice.invoiceNumber}</div>
            <div>Date: {new Date(invoice.createdAt).toLocaleString('en-IN')}</div>
            <div>Cust: {invoice.customerName} ({invoice.customerMobile.slice(-4)})</div>
            {invoice.customerPan && <div>PAN: {invoice.customerPan}</div>}
          </div>

          <div className="space-y-2 border-b border-dashed border-slate-400 pb-3">
            {invoice.items.map((it, idx) => {
              const itemMetal = parseMoney(it.metalValue ?? (it as any).baseMetalValue);
              const itemMaking = parseMoney(it.makingCharges);
              const itemTaxable = parseMoney(it.taxableAmount ?? (itemMetal + itemMaking));
              const itemTax = parseMoney(it.taxAmount ?? (itemTaxable * 0.03));
              const itemTotal = parseMoney(it.finalAmount ?? (it as any).totalAmount ?? (itemTaxable + itemTax));

              return (
                <div key={it.id || idx} className="space-y-0.5">
                  <div className="font-bold text-xs">{it.designTitle}</div>
                  <div className="flex justify-between text-[10px]">
                    <span>Net: {it.netWeight}g @ ₹{formatMoney(it.boardRate || (it as any).rateApplied)}</span>
                    <span>₹{formatMoney(itemMetal)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Making + GST:</span>
                    <span>₹{formatMoney(itemMaking + itemTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>HUID: {it.huid || '916'}</span>
                    <span>₹{formatMoney(itemTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Taxable:</span>
              <span>₹{formatMoney(taxableAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST 3%:</span>
              <span>₹{formatMoney(totalTaxAmount)}</span>
            </div>
            {oldGoldDeduction > 0 && (
              <div className="flex justify-between font-bold">
                <span>Old Gold Credit:</span>
                <span>- ₹{formatMoney(oldGoldDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-900 pt-1 text-sm font-bold">
              <span>NET PAYABLE:</span>
              <span>₹{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-dashed border-slate-400 text-[9px] space-y-1">
            <div>Thank You For Shopping!</div>
            <div>BIS Hallmarked 916 Guaranteed</div>
            <div className="flex justify-center pt-1">
              <QRCodeSvg value={`pos://inv/${invoice.id}`} size={42} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
