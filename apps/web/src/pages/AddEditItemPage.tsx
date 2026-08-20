import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { MakingChargeType, JewelleryItemSummary, RateDefinition } from '@jewellery-pos/shared';
import { ArrowLeft, Save, Sparkles, ShieldCheck, Scale, AlertCircle, Upload, Image as ImageIcon, X, RefreshCw } from 'lucide-react';

export const AddEditItemPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rateDefinitions, setRateDefinitions] = useState<RateDefinition[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);

  const [itemCode, setItemCode] = useState('KJ-GLD-' + Date.now().toString().slice(-4));
  const [designTitle, setDesignTitle] = useState('');
  const [category, setCategory] = useState('Necklace');
  const [selectedMetal, setSelectedMetal] = useState('GOLD');
  const [selectedPurity, setSelectedPurity] = useState('22K');
  const [fineness, setFineness] = useState<number | null>(916);
  const [rateDefinitionId, setRateDefinitionId] = useState<string | null>(null);
  const [activeBoardRate, setActiveBoardRate] = useState<string>('6980.00');

  const [grossWeight, setGrossWeight] = useState('15.500');
  const [stoneWeight, setStoneWeight] = useState('0.000');
  const [huid, setHuid] = useState('');
  const [hallmarkVerified, setHallmarkVerified] = useState(true);
  const [makingChargeType, setMakingChargeType] = useState<MakingChargeType>(MakingChargeType.PER_GRAM);
  const [makingChargeValue, setMakingChargeValue] = useState('450.00');
  const [wastagePct, setWastagePct] = useState('1.50');
  const [stoneValue, setStoneValue] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Optional Product Image State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileBase64, setImageFileBase64] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState<string>('Main');

  useEffect(() => {
    loadRateDefinitions();
  }, []);

  const loadRateDefinitions = async () => {
    try {
      const data = await api.get<RateDefinition[]>('/rates/definitions');
      const active = data.filter((d) => d.isActive);
      setRateDefinitions(active);

      // Default to first active 22K or first active item
      const defaultDef = active.find((d) => d.metal === 'GOLD' && d.purity.includes('22')) || active[0];
      if (defaultDef) {
        setSelectedMetal(defaultDef.metal);
        setSelectedPurity(defaultDef.purity);
        setFineness(defaultDef.fineness);
        setRateDefinitionId(defaultDef.id);
        setActiveBoardRate(defaultDef.currentRate);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingDefs(false);
    }
  };

  const handleMetalChange = (newMetal: string) => {
    setSelectedMetal(newMetal);
    const matchingPurities = rateDefinitions.filter(
      (d) => d.metal.toUpperCase() === newMetal.toUpperCase()
    );
    if (matchingPurities.length > 0) {
      const first = matchingPurities[0];
      setSelectedPurity(first.purity);
      setFineness(first.fineness);
      setRateDefinitionId(first.id);
      setActiveBoardRate(first.currentRate);
    }
  };

  const handlePurityChange = (newPurity: string) => {
    setSelectedPurity(newPurity);
    const matched = rateDefinitions.find(
      (d) => d.metal.toUpperCase() === selectedMetal.toUpperCase() && d.purity === newPurity
    );
    if (matched) {
      setFineness(matched.fineness);
      setRateDefinitionId(matched.id);
      setActiveBoardRate(matched.currentRate);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate mime type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      addToast('Only PNG, JPG/JPEG, and WEBP image files are allowed.', 'error');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size must not exceed 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageFileBase64(result);
    };
    reader.onerror = () => {
      addToast('Failed to read image file.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageFileBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode || !designTitle || !grossWeight) {
      addToast('Please fill all mandatory fields', 'warning');
      return;
    }

    if (huid && huid.length !== 6) {
      addToast('BIS HUID must be exactly 6 alphanumeric characters', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // Step 1: Create Item First
      const payload = {
        itemCode: itemCode.trim().toUpperCase(),
        designTitle: designTitle.trim(),
        category,
        metal: selectedMetal,
        purity: selectedPurity,
        fineness: fineness || undefined,
        rateDefinitionId: rateDefinitionId || undefined,
        grossWeight,
        stoneWeight,
        huid: huid ? huid.trim().toUpperCase() : undefined,
        hallmarkVerified,
        makingChargeType,
        makingChargeValue,
        wastagePct,
        stoneValue,
        notes: notes || undefined
      };

      const created = await api.post<JewelleryItemSummary>('/items', payload);

      // Step 2: Optional Image Upload (Never blocks item creation)
      if (imageFileBase64 && created?.id) {
        try {
          await api.post(`/items/${created.id}/images`, {
            imageBase64: imageFileBase64,
            label: imageLabel,
            isPrimary: true
          });
        } catch (imgErr: any) {
          addToast(
            'Item saved successfully, but image upload failed. You can upload it later from inventory.',
            'warning'
          );
          navigate('/inventory');
          return;
        }
      }

      addToast(`Item ${created.itemCode} created and inwarded to catalog!`, 'success');
      navigate('/inventory');
    } catch (err: any) {
      addToast(err.message || 'Failed to save item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory</span>
        </Link>
        <h1 className="text-base font-bold text-slate-900">
          Inward New Jewellery Piece to Stock
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md space-y-6 text-xs">
        {/* Section 1: Basic Identifiers */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Design & Serial Identification</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Item Serial Code *</label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Design Title *</label>
              <input
                type="text"
                value={designTitle}
                onChange={(e) => setDesignTitle(e.target.value)}
                placeholder="e.g. Royal Antique Bridal Choker"
                className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Optional Product Image */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            <span>Product Image</span>
            <span className="text-[10px] font-normal text-slate-400 capitalize">(Optional)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Optional — helps verify the jewellery item during scanning.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageFileChange}
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
          />

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-amber-50/40 group"
            >
              <div className="p-3 rounded-full bg-white shadow-xs group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <span className="font-semibold text-slate-700 hover:text-amber-700">
                  Click to upload product image
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Supports JPG, PNG, WEBP (Max 5MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <img
                src={imagePreview}
                alt="Product preview"
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl border border-slate-200 shadow-xs"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Image Label:</span>
                  <select
                    value={imageLabel}
                    onChange={(e) => setImageLabel(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Main">Main Product</option>
                    <option value="Hallmark / HUID">Hallmark / HUID</option>
                    <option value="Back / Clasp">Back / Clasp</option>
                    <option value="Detail">Detail</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Metal, Purity & Rate Master Link */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
            <Scale className="w-4 h-4" />
            <span>Metal, Dynamic Purity & Rate Master</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Metal</label>
              <select
                value={selectedMetal}
                onChange={(e) => handleMetalChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
              >
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Purity Definition *</label>
              <select
                value={selectedPurity}
                onChange={(e) => handlePurityChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white font-semibold"
              >
                {rateDefinitions
                  .filter((d) => d.metal.toUpperCase() === selectedMetal.toUpperCase())
                  .map((d) => (
                    <option key={d.id} value={d.purity}>
                      {d.purity} (Fineness {d.fineness}) — ₹{d.currentRate}/g
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
              >
                <option value="Necklace">Necklace</option>
                <option value="Ring">Ring</option>
                <option value="Earrings">Earrings</option>
                <option value="Bangle">Bangle</option>
                <option value="Chain">Chain</option>
                <option value="Pendant">Pendant</option>
                <option value="Bracelet">Bracelet</option>
                <option value="Coin">Coin / Bar</option>
              </select>
            </div>
          </div>

          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs font-mono">
            <span className="text-amber-900 font-sans font-semibold">Active Showroom Board Rate:</span>
            <span className="text-amber-950 font-bold">₹{activeBoardRate}/g</span>
          </div>
        </div>

        {/* Section 4: Weights & HUID */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Weight Matrix & Hallmarking</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gross Weight (g) *</label>
              <input
                type="number"
                step="0.001"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Stone / Enamel Weight (g)</label>
              <input
                type="number"
                step="0.001"
                value={stoneWeight}
                onChange={(e) => setStoneWeight(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Calculated Net Weight</label>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-mono font-bold text-amber-900 text-xs">
                {(Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(stoneWeight) || 0))).toFixed(3)} g
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">BIS 6-Digit HUID</label>
              <input
                type="text"
                maxLength={6}
                value={huid}
                onChange={(e) => setHuid(e.target.value.toUpperCase())}
                placeholder="e.g. MH89A2"
                className="w-full border border-slate-200 rounded-lg p-2 font-mono uppercase font-bold text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="hallmark"
                checked={hallmarkVerified}
                onChange={(e) => setHallmarkVerified(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <label htmlFor="hallmark" className="font-semibold text-slate-700">
                BIS Hallmarking Verified & Certified
              </label>
            </div>
          </div>
        </div>

        {/* Section 5: Making Charges & Wastage */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3">
            Making Charges & Wastage Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Making Charge Type</label>
              <select
                value={makingChargeType}
                onChange={(e) => setMakingChargeType(e.target.value as MakingChargeType)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
              >
                <option value={MakingChargeType.PER_GRAM}>Per Gram (₹/g)</option>
                <option value={MakingChargeType.PERCENTAGE}>Percentage (%)</option>
                <option value={MakingChargeType.FLAT}>Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Making Charge Value</label>
              <input
                type="number"
                step="0.01"
                value={makingChargeValue}
                onChange={(e) => setMakingChargeValue(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Wastage / Tunch (%)</label>
              <input
                type="number"
                step="0.01"
                value={wastagePct}
                onChange={(e) => setWastagePct(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Stone Value & Notes */}
        <div className="pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Precious Stone / Stud Value (₹)</label>
              <input
                type="number"
                step="0.01"
                value={stoneValue}
                onChange={(e) => setStoneValue(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vault Inventory Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Crafted in Rajkot, Hallmarked Surat"
                className="w-full border border-slate-200 rounded-lg p-2 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Inward to Catalog'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
