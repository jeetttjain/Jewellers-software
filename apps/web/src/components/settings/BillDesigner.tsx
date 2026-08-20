import React, { useState, useEffect } from 'react';
import { api } from '../../services/api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { InvoiceTemplateConfig, ShopSettings } from '@jewellery-pos/shared';
import { 
  FileText, 
  Printer, 
  Eye, 
  Save, 
  Sliders, 
  Layout, 
  CheckSquare, 
  Square,
  Sparkles,
  QrCode
} from 'lucide-react';

interface BillDesignerProps {
  shop: ShopSettings | null;
}

const DEFAULT_TEMPLATE: InvoiceTemplateConfig = {
  paperSize: 'A4',
  logoVisible: true,
  shopNameVisible: true,
  addressVisible: true,
  gstinVisible: true,
  phoneVisible: true,
  emailVisible: true,
  customerNameVisible: true,
  customerMobileVisible: true,
  customerAddressVisible: true,
  customerPanVisible: true,
  customerGstinVisible: true,
  itemHuidVisible: true,
  itemBarcodeVisible: true,
  itemGrossWeightVisible: true,
  itemStoneWeightVisible: true,
  itemNetWeightVisible: true,
  itemMakingChargesVisible: true,
  itemWastageVisible: true,
  itemStoneValueVisible: true,
  itemDiscountVisible: true,
  cgstSgstBreakdownVisible: true,
  oldGoldDeductionVisible: true,
  termsVisible: true,
  termsText: '1. Goods once sold will be exchanged as per store policy.\n2. All disputes subject to local jurisdiction.',
  footerText: 'Thank you for shopping with us!'
};

export const BillDesigner: React.FC<BillDesignerProps> = ({ shop }) => {
  const { addToast } = useToast();
  const [template, setTemplate] = useState<InvoiceTemplateConfig>(DEFAULT_TEMPLATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<InvoiceTemplateConfig>('/settings/invoice-template');
      setTemplate({ ...DEFAULT_TEMPLATE, ...data });
    } catch {
      setTemplate(DEFAULT_TEMPLATE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof InvoiceTemplateConfig) => {
    setTemplate((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await api.put<InvoiceTemplateConfig>('/settings/invoice-template', template);
      setTemplate(saved);
      addToast('Bill & Receipt Template configuration saved successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save invoice template', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs font-semibold">
        Loading Bill Designer...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-lg">
            <FileText className="w-5 h-5 text-amber-600" />
            <span>Owner Invoice & Receipt Designer</span>
          </div>
          <p className="text-xs text-slate-500">
            Configure field visibility, legal disclosures, terms, and thermal/A4 formats with realistic rendered preview.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Template Config'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Format Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-amber-600" />
              <span>Print Format & Paper Preset</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTemplate((prev) => ({ ...prev, paperSize: 'A4' }))}
                className={`p-3 rounded-xl border text-left font-sans text-xs transition-all ${
                  template.paperSize === 'A4'
                    ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">A4 GST Tax Invoice</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Full sheet detailed GST bill</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplate((prev) => ({ ...prev, paperSize: '80mm' }))}
                className={`p-3 rounded-xl border text-left font-sans text-xs transition-all ${
                  template.paperSize === '80mm'
                    ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">80mm Thermal Receipt</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Compact roll printer bill</div>
              </button>
            </div>
          </div>

          {/* Section Toggles */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>Field Visibility Controls</span>
            </h3>

            {/* Shop Branding Header Toggles */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Showroom Branding</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  ['logoVisible', 'Shop Logo'],
                  ['shopNameVisible', 'Shop Name'],
                  ['addressVisible', 'Address'],
                  ['gstinVisible', 'GSTIN'],
                  ['phoneVisible', 'Phone Number'],
                  ['emailVisible', 'Email Address']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleToggle(key as keyof InvoiceTemplateConfig)}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg text-left text-slate-700 font-medium"
                  >
                    {template[key as keyof InvoiceTemplateConfig] ? (
                      <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Header Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Customer Info</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  ['customerNameVisible', 'Customer Name'],
                  ['customerMobileVisible', 'Mobile Number'],
                  ['customerAddressVisible', 'Address'],
                  ['customerPanVisible', 'PAN Number'],
                  ['customerGstinVisible', 'GSTIN']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleToggle(key as keyof InvoiceTemplateConfig)}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg text-left text-slate-700 font-medium"
                  >
                    {template[key as keyof InvoiceTemplateConfig] ? (
                      <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Line Item Table Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Jewellery Line Items</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  ['itemHuidVisible', 'HUID Tag'],
                  ['itemBarcodeVisible', 'Barcode'],
                  ['itemGrossWeightVisible', 'Gross Weight'],
                  ['itemStoneWeightVisible', 'Stone Weight'],
                  ['itemNetWeightVisible', 'Net Weight'],
                  ['itemMakingChargesVisible', 'Making Charges'],
                  ['itemWastageVisible', 'Wastage'],
                  ['itemStoneValueVisible', 'Stone Value'],
                  ['itemDiscountVisible', 'Discounts']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleToggle(key as keyof InvoiceTemplateConfig)}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg text-left text-slate-700 font-medium"
                  >
                    {template[key as keyof InvoiceTemplateConfig] ? (
                      <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Terms & Footer Text Inputs */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Terms & Conditions</label>
              <textarea
                rows={3}
                value={template.termsText}
                onChange={(e) => setTemplate((prev) => ({ ...prev, termsText: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Receipt Footer Line</label>
              <input
                type="text"
                value={template.footerText}
                onChange={(e) => setTemplate((prev) => ({ ...prev, footerText: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Realistic Live Preview Column (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-600" />
              <span>Rendered Document Preview ({template.paperSize})</span>
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Direct Print Preview</span>
          </div>

          {/* Rendered Invoice Paper Container */}
          <div className="bg-slate-200 p-6 rounded-2xl border border-slate-300 shadow-inner overflow-x-auto flex justify-center">
            {template.paperSize === '80mm' ? (
              /* 80mm Thermal Receipt Live Preview */
              <div className="w-[300px] bg-white p-4 shadow-xl border border-slate-300 rounded font-mono text-[10px] space-y-3 text-slate-900">
                {/* Header */}
                <div className="text-center space-y-1 pb-2 border-b border-slate-300">
                  {template.logoVisible && shop?.logoUrl && (
                    <img src={shop.logoUrl} alt="Logo" className="h-8 mx-auto object-contain mb-1" />
                  )}
                  {template.shopNameVisible && (
                    <div className="font-bold text-xs uppercase">{shop?.name || 'KAMAL JEWELLERS'}</div>
                  )}
                  {template.addressVisible && <div>{shop?.address || 'Showroom Street, Main Market'}</div>}
                  <div className="flex justify-center gap-2 text-[9px] text-slate-600">
                    {template.phoneVisible && <span>Ph: {shop?.phone || '9876543210'}</span>}
                    {template.gstinVisible && <span>GSTIN: {shop?.gstin || '07AAAAA0000A1Z5'}</span>}
                  </div>
                </div>

                {/* Bill Meta & Customer */}
                <div className="space-y-1 text-[9px] pb-2 border-b border-slate-200">
                  <div className="flex justify-between font-bold">
                    <span>INV: KJ-2026-00421</span>
                    <span>13/08/2026</span>
                  </div>
                  {template.customerNameVisible && (
                    <div className="flex justify-between">
                      <span>Cust: Rajesh Verma</span>
                      {template.customerMobileVisible && <span>9823011223</span>}
                    </div>
                  )}
                  {template.customerPanVisible && <div>PAN: ABCDE1234F</div>}
                </div>

                {/* Items */}
                <div className="space-y-1.5 pb-2 border-b border-slate-200">
                  <div className="flex justify-between font-bold border-b border-slate-300 pb-0.5">
                    <span>ITEM</span>
                    <span>NET(g)</span>
                    <span>AMT(₹)</span>
                  </div>

                  <div>
                    <div className="font-bold">22K Gold Bangle 18g</div>
                    {template.itemHuidVisible && <div className="text-[8px] text-slate-500">HUID: MH89A2</div>}
                    <div className="flex justify-between text-slate-700">
                      <span>{template.itemNetWeightVisible ? 'N: 18.250g' : ''}</span>
                      <span>₹1,32,400</span>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1 text-[9px] font-bold">
                  <div className="flex justify-between">
                    <span>Taxable:</span>
                    <span>₹1,32,400.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (3%):</span>
                    <span>₹3,972.00</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-900 font-bold">
                    <span>NET PAYABLE:</span>
                    <span>₹1,36,372.00</span>
                  </div>
                </div>

                {/* Footer */}
                {template.termsVisible && (
                  <div className="text-[8px] text-slate-500 pt-2 border-t border-slate-200 whitespace-pre-line">
                    {template.termsText}
                  </div>
                )}
                <div className="text-center font-bold text-[9px] pt-1">{template.footerText}</div>
              </div>
            ) : (
              /* A4 GST Tax Invoice Live Preview */
              <div className="w-[595px] min-h-[700px] bg-white p-6 shadow-xl border border-slate-300 rounded text-slate-900 space-y-4 text-xs font-sans">
                {/* Top Header */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div>
                    {template.logoVisible && shop?.logoUrl && (
                      <img src={shop.logoUrl} alt="Logo" className="h-10 object-contain mb-1.5" />
                    )}
                    {template.shopNameVisible && (
                      <h2 className="font-serif font-bold text-base text-slate-900 uppercase tracking-wide">
                        {shop?.name || 'KAMAL JEWELLERS'}
                      </h2>
                    )}
                    {template.addressVisible && (
                      <p className="text-[10px] text-slate-600">{shop?.address || '123 Jewellery Palace Road, Chandni Chowk'}</p>
                    )}
                    <div className="text-[10px] text-slate-500 flex gap-3 mt-0.5">
                      {template.phoneVisible && <span>Tel: {shop?.phone || '+91 98765 43210'}</span>}
                      {template.gstinVisible && <span className="font-mono font-bold">GSTIN: {shop?.gstin || '07AAAAA0000A1Z5'}</span>}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block bg-slate-900 text-white font-bold text-[10px] px-2.5 py-1 rounded uppercase tracking-wider mb-2">
                      Tax Invoice
                    </span>
                    <div className="font-mono text-xs font-bold text-slate-900">NO: KJ-2026-00421</div>
                    <div className="text-[10px] text-slate-500">Date: 13-Aug-2026</div>
                  </div>
                </div>

                {/* Customer Details Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Billed To Customer</span>
                    {template.customerNameVisible && <div className="font-bold text-slate-900">Rajesh Verma</div>}
                    {template.customerMobileVisible && <div className="text-slate-600 font-mono text-[11px]">+91 98230 11223</div>}
                    {template.customerAddressVisible && <div className="text-slate-500 text-[10px]">Sector 14, Main Road, Delhi</div>}
                  </div>
                  <div className="text-right">
                    {template.customerPanVisible && <div className="font-mono text-[11px]">PAN: <span className="font-bold">ABCDE1234F</span></div>}
                    {template.customerGstinVisible && <div className="font-mono text-[11px]">GSTIN: 07ABCDE1234F1Z5</div>}
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                      <th className="p-2">Description</th>
                      {template.itemGrossWeightVisible && <th className="p-2 text-right">Gross Wt</th>}
                      {template.itemNetWeightVisible && <th className="p-2 text-right">Net Wt</th>}
                      {template.itemMakingChargesVisible && <th className="p-2 text-right">Making</th>}
                      <th className="p-2 text-right">Taxable Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    <tr>
                      <td className="p-2">
                        <div className="font-bold font-sans">22K Gold Antique Bangle</div>
                        {template.itemHuidVisible && <div className="text-[9px] text-amber-800 font-bold">HUID: MH89A2</div>}
                      </td>
                      {template.itemGrossWeightVisible && <td className="p-2 text-right">18.500g</td>}
                      {template.itemNetWeightVisible && <td className="p-2 text-right font-bold">18.250g</td>}
                      {template.itemMakingChargesVisible && <td className="p-2 text-right">₹8,212.50</td>}
                      <td className="p-2 text-right font-bold">₹1,32,400.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* Calculations Summary */}
                <div className="flex justify-between items-start pt-2">
                  <div className="max-w-[280px]">
                    {template.termsVisible && (
                      <div className="text-[9px] text-slate-500 whitespace-pre-line border p-2 rounded bg-slate-50">
                        <span className="font-bold text-slate-700 uppercase block mb-0.5">Terms & Conditions</span>
                        {template.termsText}
                      </div>
                    )}
                  </div>

                  <div className="w-48 space-y-1.5 font-mono text-xs text-right">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span>₹1,32,400.00</span>
                    </div>
                    {template.cgstSgstBreakdownVisible && (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>CGST (1.5%):</span>
                          <span>₹1,986.00</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>SGST (1.5%):</span>
                          <span>₹1,986.00</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-300 pt-1">
                      <span>Grand Total:</span>
                      <span>₹1,36,372.00</span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] font-bold text-slate-600 border-t border-slate-200 pt-3">
                  {template.footerText}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
