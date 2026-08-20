import React, { useState, useEffect } from 'react';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useOwnerMode } from '../context/OwnerModeContext.js';
import { OwnerPinModal } from '../components/common/OwnerPinModal.js';
import { BillDesigner } from '../components/settings/BillDesigner.js';
import { BackupRestoreManager } from '../components/settings/BackupRestoreManager.js';
import {
  ShopSettings,
  LabelTemplate,
  LabelPreset,
  LabelTemplateConfig,
  DEFAULT_LABEL_CONFIG,
  generateLabelPdf
} from '@jewellery-pos/shared';
import { CustomizableJewelleryTag } from '../components/barcode/CustomizableJewelleryTag.js';
import { printDedicatedLabel } from '../utils/printDedicatedLabel.js';
import { updateDynamicBranding } from '../utils/branding.js';
import {
  Settings,
  Save,
  Store,
  Printer,
  Download,
  FileText,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Tag,
  Eye,
  Sliders,
  CheckSquare,
  Square,
  Lock,
  Layers,
  Upload,
  Trash2,
  KeyRound,
  Database
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SHOWROOM' | 'BILL_DESIGNER' | 'LABEL_DESIGNER' | 'BACKUP_RESTORE' | 'OWNER_SECURITY'>('LABEL_DESIGNER');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinSetupMode, setIsPinSetupMode] = useState(false);

  const { isOwnerModeUnlocked, promptOwnerPin } = useOwnerMode();

  // Showroom Profile State
  const [shop, setShop] = useState<ShopSettings>({
    id: 'shop-kj-main-001',
    name: 'Kamal Jewellers — Flagship Showroom',
    code: 'KJ-MAIN',
    address: '104, Jewellery Palace, Johri Bazaar, Jaipur, Rajasthan — 302003',
    phone: '+91 98290 12345',
    email: 'contact@kamaljewellers.com',
    gstin: '08AAAAA0000A1Z5',
    taxStatus: 'GST_REGISTERED',
    defaultTaxPercent: '3.00',
    invoicePrefix: 'KJ',
    printerPaperSize: '80mm',
    termsAndConditions: '1. Goods once sold cannot be returned without original cash memo.\n2. Gold rate is determined as per today board rate.\n3. Subject to Jaipur jurisdiction.',
    logoUrl: null
  });

  // Label Template State
  const [template, setTemplate] = useState<LabelTemplate>({
    id: 'tpl-std-001',
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

  const [testItem, setTestItem] = useState({
    id: '00000000-0000-0000-0000-000000000099',
    itemCode: 'JWL-8F72A91C',
    category: 'Rings',
    designTitle: '22K Gold Diamond Solitaire Engagement Ring',
    metal: 'GOLD' as any,
    purity: '22K 916' as any,
    grossWeight: '5.230',
    stoneWeight: '0.110',
    netWeight: '5.120',
    huid: 'AB9912'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [previewScale, setPreviewScale] = useState(2.2);

  const { addToast } = useToast();
  const { user } = useAuth();

  const isAuthorizedToEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER' || !user;

  useEffect(() => {
    loadSettings();
    loadLabelTemplate();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get<ShopSettings>('/settings');
      setShop(data);
      updateDynamicBranding(data);
    } catch {
      // Fallback to initial
    }
  };

  const loadLabelTemplate = async () => {
    try {
      const tpl = await api.get<LabelTemplate>('/labels/template');
      if (tpl && tpl.config) {
        setTemplate(tpl);
      }
    } catch {
      // Fallback
    }
  };

  const handleSaveShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.put<ShopSettings>('/settings', shop);
      setShop(updated);
      updateDynamicBranding(updated);
      addToast('Showroom Settings Saved Successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      addToast('Only PNG, JPG, and WEBP image files are allowed', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('Logo file size must be less than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const updatedShop = await api.post<ShopSettings>('/settings/logo', { imageBase64: base64 });
        setShop(updatedShop);
        updateDynamicBranding(updatedShop);
        addToast('Shop Logo Uploaded Successfully!', 'success');
      } catch (err: any) {
        addToast(err.message || 'Failed to upload shop logo', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    try {
      const updatedShop = await api.delete<ShopSettings>('/settings/logo');
      setShop(updatedShop);
      updateDynamicBranding(updatedShop);
      addToast('Shop Logo Removed', 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to remove logo', 'error');
    }
  };

  const handleSaveLabelTemplate = async () => {
    if (!isAuthorizedToEdit) {
      addToast('Forbidden: Only Admin, Owner, or Manager can customize label templates', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await api.put<LabelTemplate>('/labels/template', {
        name: template.name,
        preset: template.preset,
        widthMm: template.widthMm,
        heightMm: template.heightMm,
        config: template.config
      });
      setTemplate(updated);
      addToast('Label Template & Layout Saved Successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save label template', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!isAuthorizedToEdit) return;
    if (!window.confirm('Reset label layout back to factory defaults?')) return;
    setIsSaving(true);
    try {
      const reset = await api.post<LabelTemplate>('/labels/template/reset');
      setTemplate(reset);
      addToast('Label template reset to standard factory default', 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to reset template', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintTestLabel = () => {
    printDedicatedLabel({
      items: [testItem],
      template,
      shopName: shop.name,
      shopGstin: shop.gstin
    });
  };

  const handleDownloadTestPdf = () => {
    const doc = generateLabelPdf([testItem], template, { shopName: shop.name, shopGstin: shop.gstin });
    doc.save(`test_label_${template.widthMm}x${template.heightMm}mm.pdf`);
  };

  const updateConfig = (key: keyof LabelTemplateConfig, value: any) => {
    setTemplate((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  const handlePresetChange = (preset: LabelPreset) => {
    let width = '50.00';
    let height = '25.00';

    if (preset === 'SMALL_RECTANGLE') {
      width = '50.00';
      height = '25.00';
    } else if (preset === 'MEDIUM_RECTANGLE') {
      width = '60.00';
      height = '30.00';
    } else if (preset === 'DUMBBELL_2INCH') {
      width = '75.00';
      height = '25.00';
    } else if (preset === 'BUTTERFLY') {
      width = '70.00';
      height = '30.00';
    }

    setTemplate((prev) => ({
      ...prev,
      preset,
      widthMm: width,
      heightMm: height
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" />
            <span>Showroom & POS Store Configuration</span>
          </h1>
          <p className="text-xs text-slate-500">
            Store branding, tax parameters, and barcode label designer
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('LABEL_DESIGNER')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'LABEL_DESIGNER'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Barcode & Label Designer</span>
          </button>
          <button
            onClick={() => setActiveTab('BILL_DESIGNER')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'BILL_DESIGNER'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Bill & Receipt Designer</span>
          </button>
          <button
            onClick={() => setActiveTab('SHOWROOM')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'SHOWROOM'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Showroom Profile & Tax</span>
          </button>
          <button
            onClick={() => setActiveTab('BACKUP_RESTORE')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'BACKUP_RESTORE'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup & Restore</span>
          </button>
          <button
            onClick={() => {
              setIsPinSetupMode(!shop.ownerPinSet);
              setIsPinModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-amber-800 hover:bg-amber-50 transition-all whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            <span>{shop.ownerPinSet ? 'Change Owner 6-Digit PIN' : 'Setup Owner 6-Digit PIN'}</span>
          </button>
        </div>
      </div>

      {/* Owner PIN Modal */}
      <OwnerPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        isSetupMode={isPinSetupMode}
        onSuccess={() => loadSettings()}
      />

      {/* BACKUP & RESTORE TAB */}
      {activeTab === 'BACKUP_RESTORE' && (
        <BackupRestoreManager shop={shop} onRefreshShop={loadSettings} />
      )}

      {/* BILL DESIGNER TAB */}
      {activeTab === 'BILL_DESIGNER' && (
        <BillDesigner shop={shop} />
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BARCODE & LABEL DESIGNER */}
      {/* ========================================================================= */}
      {activeTab === 'LABEL_DESIGNER' && (
        <div className="space-y-6">
          {/* Security Notice: Barcode Identity is Immutable */}
          <div className="no-print bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-950 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Permanent Barcode Identity Guarantee: </span>
              <span>
                The encoded barcode serial value (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-900">JWL-8F72A91C</code>) is permanently fixed and system-generated. Customizing this template alters only the visual formatting, typography, and printed tag dimensions without modifying real inventory item identities.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Control Panel: Presets & Field Toggles (7 Cols) */}
            <div className="no-print lg:col-span-7 space-y-5">
              {/* Presets & Physical Dimensions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <span>Tag Dimensions & Format Presets</span>
                  </span>
                  <span className="font-mono text-slate-500 font-bold">
                    {template.widthMm}mm × {template.heightMm}mm
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'SMALL_RECTANGLE', label: 'Small Tag', dims: '50×25 mm' },
                    { id: 'MEDIUM_RECTANGLE', label: 'Medium Tag', dims: '60×30 mm' },
                    { id: 'DUMBBELL_2INCH', label: '2" Dumbbell', dims: '75×25 mm' },
                    { id: 'BUTTERFLY', label: 'Butterfly', dims: '70×30 mm' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetChange(p.id as LabelPreset)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        template.preset === p.id
                          ? 'border-amber-500 bg-amber-50/50 text-slate-950 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs">{p.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.dims}</div>
                    </button>
                  ))}
                </div>

                {/* Dimension Customization */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tag Width (mm)</label>
                    <input
                      type="number"
                      step="1"
                      value={template.widthMm}
                      onChange={(e) => setTemplate({ ...template, widthMm: e.target.value, preset: 'CUSTOM' })}
                      className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tag Height (mm)</label>
                    <input
                      type="number"
                      step="1"
                      value={template.heightMm}
                      onChange={(e) => setTemplate({ ...template, heightMm: e.target.value, preset: 'CUSTOM' })}
                      className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Field Visibility Toggles */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>Display Fields & Information Toggles</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Live preview reflects toggles</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: 'showShopName', label: 'Showroom Name (Branding)', desc: shop.name },
                    { key: 'showPurity', label: 'Gold Purity & Karat', desc: 'e.g. 22K 916' },
                    { key: 'showGrossWeight', label: 'Gross Weight (G:)', desc: 'Total physical weight' },
                    { key: 'showNetWeight', label: 'Net Metal Weight (N:)', desc: 'Gold weight without stones' },
                    { key: 'showStoneWeight', label: 'Stone Weight (S:)', desc: 'Deducted gem weight' },
                    { key: 'showHuid', label: 'BIS Hallmark HUID', desc: '6-digit hallmarking code' },
                    { key: 'showCategory', label: 'Category / Design Title', desc: 'Product description' },
                    { key: 'showBarcode', label: 'Scannable Barcode', desc: 'Code 128 vector barcode' },
                    { key: 'showHumanReadableBarcode', label: 'Human-Readable Item Code', desc: 'Visible text serial under barcode' },
                    { key: 'showQrCode', label: 'QR Code Matrix', desc: 'Compact 2D lookup code' },
                    { key: 'showGstin', label: 'Showroom GSTIN', desc: shop.gstin || '27AAAAA0000A1Z5' }
                  ].map((field) => {
                    const isChecked = Boolean(template.config[field.key as keyof LabelTemplateConfig]);
                    return (
                      <label
                        key={field.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'border-amber-400 bg-amber-50/30'
                            : 'border-slate-200 bg-slate-50/50 opacity-75'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => updateConfig(field.key as keyof LabelTemplateConfig, e.target.checked)}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 text-xs truncate">{field.label}</div>
                          <div className="text-[10px] text-slate-500 truncate">{field.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Typography & Layout Spacing */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Typography, Barcode Sizing & Alignment</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shop Title Size (pt)</label>
                    <input
                      type="number"
                      min="5"
                      max="16"
                      step="0.5"
                      value={template.config.shopNameFontSizePt}
                      onChange={(e) => updateConfig('shopNameFontSizePt', parseFloat(e.target.value) || 8)}
                      className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Body Font Size (pt)</label>
                    <input
                      type="number"
                      min="4"
                      max="12"
                      step="0.5"
                      value={template.config.fontSizePt}
                      onChange={(e) => updateConfig('fontSizePt', parseFloat(e.target.value) || 6.5)}
                      className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Barcode Height (mm)</label>
                    <input
                      type="number"
                      min="4"
                      max="20"
                      step="1"
                      value={template.config.barcodeHeightMm}
                      onChange={(e) => updateConfig('barcodeHeightMm', parseFloat(e.target.value) || 8)}
                      className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Text Alignment</label>
                    <select
                      value={template.config.textAlignment}
                      onChange={(e) => updateConfig('textAlignment', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                    >
                      <option value="LEFT">Left Aligned</option>
                      <option value="CENTER">Center Aligned</option>
                      <option value="RIGHT">Right Aligned</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveLabelTemplate}
                  disabled={isSaving || !isAuthorizedToEdit}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetTemplate}
                  disabled={isSaving || !isAuthorizedToEdit}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Factory Default</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTestLabel}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all ml-auto"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Test Label</span>
                </button>
              </div>
            </div>

            {/* Right Panel: Live Real-Time Interactive Tag Preview (5 Cols) */}
            <div className="lg:col-span-5 space-y-4 sticky top-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span className="font-bold tracking-wide uppercase text-slate-200">Live WYSIWYG Tag Preview</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono">Zoom:</span>
                    {[1.5, 2.2, 3].map((z) => (
                      <button
                        key={z}
                        onClick={() => setPreviewScale(z)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          previewScale === z ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {z}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Render Box */}
                <div className="bg-slate-950/80 rounded-xl p-6 flex flex-col items-center justify-center min-h-[260px] border border-slate-800/80 overflow-x-auto">
                  <CustomizableJewelleryTag
                    item={testItem}
                    config={template.config}
                    preset={template.preset}
                    widthMm={template.widthMm}
                    heightMm={template.heightMm}
                    shopName={shop.name}
                    shopGstin={shop.gstin}
                    shopPhone={shop.phone}
                    isTestPreview={true}
                    scale={previewScale}
                  />
                </div>

                {/* Preview Specs & Printer Guide */}
                <div className="bg-slate-800/50 rounded-xl p-3.5 space-y-2 text-[11px] text-slate-300">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Selected Format:</span>
                    <span className="font-bold text-amber-300">{template.preset}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Physical Size:</span>
                    <span>{template.widthMm} mm × {template.heightMm} mm</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Target Printers:</span>
                    <span>Zebra / TSC / Citizen (ESC/POS)</span>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTestPdf}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                      title="Download exact size PDF test label"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Download PDF Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintTestLabel}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Print ONLY the test label with exact CSS @page"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Test Label</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHOWROOM PROFILE & TAX */}
      {/* ========================================================================= */}
      {activeTab === 'SHOWROOM' && (
        <form
          onSubmit={handleSaveShopSettings}
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md space-y-5 text-xs max-w-3xl"
        >
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Showroom / Trade Name *</label>
              <input
                type="text"
                value={shop.name}
                onChange={(e) => setShop({ ...shop, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-900 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GSTIN Number *</label>
                <input
                  type="text"
                  value={shop.gstin}
                  onChange={(e) => setShop({ ...shop, gstin: e.target.value.toUpperCase() })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold uppercase text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={shop.phone}
                  onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Showroom Address</label>
              <textarea
                value={shop.address}
                onChange={(e) => setShop({ ...shop, address: e.target.value })}
                rows={2}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice Number Prefix</label>
                <input
                  type="text"
                  value={shop.invoicePrefix}
                  onChange={(e) => setShop({ ...shop, invoicePrefix: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default GST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={shop.defaultTaxPercent}
                  onChange={(e) => setShop({ ...shop, defaultTaxPercent: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
                />
              </div>
            </div>

            {/* Shop Logo Section */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <label className="block font-bold text-slate-900 text-xs">Shop Logo</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                {/* LOGO PREVIEW */}
                <div className="w-24 h-24 bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                  {shop.logoUrl ? (
                    <img
                      src={shop.logoUrl}
                      alt="Shop Logo Preview"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <Upload className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                      <span className="text-[10px] font-mono block">LOGO PREVIEW</span>
                    </div>
                  )}
                </div>

                {/* UPLOAD & REMOVE BUTTONS */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>

                    {shop.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Remove Logo</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Allowed formats: PNG, JPG, WEBP. Max file size: 2MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
