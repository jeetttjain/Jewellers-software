import React, { useState, useEffect } from 'react';
import { api } from '../services/api/client.js';
import {
  JewelleryItemSummary,
  LabelTemplate,
  LabelPreset,
  DEFAULT_LABEL_CONFIG,
  generateLabelPdf,
  ThermalPrinterService
} from '@jewellery-pos/shared';
import { CustomizableJewelleryTag } from '../components/barcode/CustomizableJewelleryTag.js';
import { printDedicatedLabel } from '../utils/printDedicatedLabel.js';
import { Tag, Printer, Download, FileCode, CheckSquare, Square, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LabelPrintQueuePage: React.FC = () => {
  const [items, setItems] = useState<JewelleryItemSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<LabelTemplate>({
    id: 'tpl-default',
    shopId: 'shop-kj-main-001',
    name: 'Standard Jewellery Tag',
    preset: 'SMALL_RECTANGLE',
    widthMm: '50.00',
    heightMm: '25.00',
    config: DEFAULT_LABEL_CONFIG,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const [shopName, setShopName] = useState('KAMAL JEWELLERS');
  const [shopGstin, setShopGstin] = useState('27AAAAA0000A1Z5');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemList, tpl, shopSettings] = await Promise.allSettled([
        api.get<JewelleryItemSummary[]>('/items', { params: { status: 'IN_STOCK' } }),
        api.get<LabelTemplate>('/labels/template'),
        api.get<any>('/settings')
      ]);

      if (itemList.status === 'fulfilled' && itemList.value) {
        setItems(itemList.value);
        setSelectedIds(new Set(itemList.value.slice(0, 6).map((i) => i.id)));
      }

      if (tpl.status === 'fulfilled' && tpl.value && tpl.value.config) {
        setTemplate(tpl.value);
      }

      if (shopSettings.status === 'fulfilled' && shopSettings.value) {
        if (shopSettings.value.name) setShopName(shopSettings.value.name);
        if (shopSettings.value.gstin) setShopGstin(shopSettings.value.gstin);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const selectedItems = items.filter((i) => selectedIds.has(i.id));

  const handleDownloadPdf = () => {
    const doc = generateLabelPdf(selectedItems, template, { shopName, shopGstin });
    doc.save(`jewellery_labels_${template.widthMm}x${template.heightMm}mm.pdf`);
  };

  const handlePrintDedicated = () => {
    printDedicatedLabel({
      items: selectedItems,
      template,
      shopName,
      shopGstin
    });
  };

  const handleExportZpl = () => {
    const zpl = ThermalPrinterService.generateBatchCommands(selectedItems, template, 'ZPL', shopName);
    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jewellery_labels_${template.widthMm}x${template.heightMm}mm.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuickPreset = (preset: LabelPreset) => {
    let width = '50.00';
    let height = '25.00';
    if (preset === 'SMALL_RECTANGLE') { width = '50.00'; height = '25.00'; }
    else if (preset === 'MEDIUM_RECTANGLE') { width = '60.00'; height = '30.00'; }
    else if (preset === 'DUMBBELL_2INCH') { width = '75.00'; height = '25.00'; }
    else if (preset === 'BUTTERFLY') { width = '70.00'; height = '30.00'; }

    setTemplate((prev) => ({
      ...prev,
      preset,
      widthMm: width,
      heightMm: height
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-600" />
            <span>Thermal Jewellery Label Printing Queue</span>
          </h1>
          <p className="text-xs text-slate-500">
            Zebra, TSC, and Citizen exact physical thermal tag output engine
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => handleQuickPreset('SMALL_RECTANGLE')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                template.preset === 'SMALL_RECTANGLE' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              50×25mm
            </button>
            <button
              onClick={() => handleQuickPreset('DUMBBELL_2INCH')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                template.preset === 'DUMBBELL_2INCH' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              80×20mm Dumbbell
            </button>
            <button
              onClick={() => handleQuickPreset('BUTTERFLY')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                template.preset === 'BUTTERFLY' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Butterfly
            </button>
          </div>

          <Link
            to="/settings"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Designer</span>
          </Link>

          <button
            onClick={handleDownloadPdf}
            disabled={selectedItems.length === 0}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            title="Generates exact physical size PDF (e.g. 80x20mm)"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download Label PDF</span>
          </button>

          <button
            onClick={handleExportZpl}
            disabled={selectedItems.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            title="Export ZPL for Zebra thermal printer"
          >
            <FileCode className="w-3.5 h-3.5 text-slate-400" />
            <span>ZPL</span>
          </button>

          <button
            onClick={handlePrintDedicated}
            disabled={selectedItems.length === 0}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            title="Prints ONLY the label using dedicated print CSS"
          >
            <Printer className="w-4 h-4" />
            <span>Print {selectedItems.length} Tag(s)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Selection Queue (Left 4 cols) */}
        <div className="no-print lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs font-bold text-slate-900">
            <button
              onClick={toggleSelectAll}
              className="text-amber-700 hover:text-amber-800 flex items-center gap-1 font-bold"
            >
              {selectedIds.size === items.length ? 'Deselect All' : 'Select All In-Stock'}
            </button>
            <span className="text-slate-500">{selectedIds.size} of {items.length}</span>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-3 transition-colors ${
                  selectedIds.has(item.id)
                    ? 'border-amber-400 bg-amber-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {selectedIds.has(item.id) ? (
                  <CheckSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                )}
                <div className="text-xs min-w-0 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 font-mono">{item.itemCode}</span>
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100/70 px-1 rounded">{item.purity}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">{item.designTitle}</div>
                  <div className="text-[10px] text-slate-400 font-mono flex justify-between pt-0.5">
                    <span>G: {item.grossWeight}g</span>
                    <span className="font-bold text-slate-700">N: {item.netWeight}g</span>
                    <span>HUID: {item.huid || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visualizer & Print Canvas (Right 8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="no-print flex justify-between items-center text-white border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                Print Queue Visualizer ({template.widthMm}mm × {template.heightMm}mm)
              </h2>
              <p className="text-xs text-slate-400">
                Vector Code 128 barcodes rendered with active shop template configuration
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-800 rounded text-xs font-mono text-slate-300">
              Format: {template.preset}
            </span>
          </div>

          {/* PRINTABLE LABELS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 printable-tags">
            {selectedItems.map((item) => (
              <div key={item.id} className="flex justify-center p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <CustomizableJewelleryTag
                  item={item}
                  config={template.config}
                  preset={template.preset}
                  widthMm={template.widthMm}
                  heightMm={template.heightMm}
                  shopName={shopName}
                  shopGstin={shopGstin}
                  scale={1.3}
                />
              </div>
            ))}

            {selectedItems.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
                No items selected for printing. Check items in the queue to preview tags.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
