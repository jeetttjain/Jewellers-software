import React, { useState, useEffect } from 'react';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { RateDefinition, RateHistoryEntry } from '@jewellery-pos/shared';
import {
  TrendingUp,
  Sparkles,
  CheckCircle2,
  History,
  Shield,
  Save,
  Plus,
  Layers,
  Edit2,
  Power,
  X,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';

export const RatesManagerPage: React.FC = () => {
  const [definitions, setDefinitions] = useState<RateDefinition[]>([]);
  const [history, setHistory] = useState<RateHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Dynamic daily rates editable state: Record<id, string>
  const [dailyRates, setDailyRates] = useState<Record<string, string>>({});

  // Add Custom Purity Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMetal, setAddMetal] = useState('Gold');
  const [customMetalName, setCustomMetalName] = useState('');
  const [addPurity, setAddPurity] = useState('');
  const [addFineness, setAddFineness] = useState('');
  const [addRate, setAddRate] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Rate Modal State
  const [editingDef, setEditingDef] = useState<RateDefinition | null>(null);
  const [editRate, setEditRate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [defsData, histData] = await Promise.all([
        api.get<RateDefinition[]>('/rates/definitions'),
        api.get<RateHistoryEntry[]>('/rates/history')
      ]);

      setDefinitions(defsData);
      setHistory(histData);

      // Populate daily rates map for active definitions
      const ratesMap: Record<string, string> = {};
      defsData.forEach((d) => {
        if (d.isActive) {
          ratesMap[d.id] = d.currentRate;
        }
      });
      setDailyRates(ratesMap);
    } catch (err: any) {
      addToast(err.message || 'Failed to load rate definitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  // When 24K Gold changes in daily rates, optionally auto-derive other Gold purities based on fineness
  const handleRateInputChange = (id: string, val: string) => {
    setDailyRates((prev) => ({ ...prev, [id]: val }));

    const changedDef = definitions.find((d) => d.id === id);
    if (changedDef && changedDef.metal.toUpperCase() === 'GOLD' && changedDef.purity.includes('24')) {
      const base24k = parseFloat(val);
      if (!isNaN(base24k) && base24k > 0) {
        setDailyRates((prev) => {
          const updated = { ...prev, [id]: val };
          definitions.forEach((d) => {
            if (d.id !== id && d.isActive && d.metal.toUpperCase() === 'GOLD' && d.fineness) {
              const derived = ((base24k * d.fineness) / 999).toFixed(2);
              updated[d.id] = derived;
            }
          });
          return updated;
        });
      }
    }
  };

  // Bulk Publish Today's Showroom Rates
  const handlePublishRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);

    try {
      const ratesPayload = Object.entries(dailyRates).map(([id, rate]) => ({
        id,
        rate: parseFloat(rate || '0').toFixed(2)
      }));

      await api.post('/rates/publish', { rates: ratesPayload });
      addToast("Today's Showroom Rates Published Successfully!", 'success');
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to publish rates', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Toggle Active / Deactivated status for a rate definition
  const handleToggleStatus = async (def: RateDefinition) => {
    const newStatus = !def.isActive;
    try {
      await api.patch(`/rates/definitions/${def.id}/status`, { isActive: newStatus });
      addToast(
        `${def.metal} ${def.purity} is now ${newStatus ? 'Active' : 'Deactivated'}`,
        'success'
      );
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  // Add New Metal / Purity Definition
  const handleCreatePurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const metalFinal = (addMetal === 'Custom' ? customMetalName : addMetal).trim().toUpperCase();
    const purityFinal = addPurity.trim().toUpperCase();
    const finenessNum = parseInt(addFineness, 10);
    const rateVal = parseFloat(addRate);

    if (!metalFinal) {
      setAddError('Metal name is required');
      return;
    }
    if (!purityFinal) {
      setAddError('Purity label is required (e.g. 20K, 19K, 925)');
      return;
    }
    if (isNaN(finenessNum) || finenessNum < 1 || finenessNum > 1000) {
      setAddError('Fineness must be an integer between 1 and 1000');
      return;
    }
    if (isNaN(rateVal) || rateVal < 0) {
      setAddError('Rate must be 0 or positive');
      return;
    }

    // Duplicate Check
    const exists = definitions.some(
      (d) =>
        d.metal.toUpperCase() === metalFinal &&
        (d.purity.toUpperCase() === purityFinal || d.fineness === finenessNum)
    );
    if (exists) {
      setAddError(`This purity (${purityFinal} / ${finenessNum}) already exists for ${metalFinal}.`);
      return;
    }

    setIsAdding(true);
    try {
      await api.post('/rates/definitions', {
        metal: metalFinal,
        purity: purityFinal,
        fineness: finenessNum,
        currentRate: rateVal.toFixed(2),
        isActive: true,
        sortOrder: definitions.length + 1
      });

      addToast(`Rate definition for ${metalFinal} ${purityFinal} added successfully!`, 'success');
      setShowAddModal(false);
      setAddPurity('');
      setAddFineness('');
      setAddRate('');
      setCustomMetalName('');
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add rate definition');
    } finally {
      setIsAdding(false);
    }
  };

  // Update Single Rate Definition
  const handleUpdateSingleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDef) return;

    setIsUpdating(true);
    try {
      await api.put(`/rates/definitions/${editingDef.id}`, {
        currentRate: parseFloat(editRate || '0').toFixed(2)
      });
      addToast(`Updated rate for ${editingDef.metal} ${editingDef.purity}`, 'success');
      setEditingDef(null);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update rate', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <span>Showroom Rate Master & Metal Rates</span>
          </h1>
          <p className="text-xs text-slate-500">
            Configure dynamic metals, purities, fineness ratios, and broadcast daily showroom bullion pricing
          </p>
        </div>

        <button
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Metal / Purity</span>
        </button>
      </div>

      {/* Main Grid: Rate Master Table (Left 7 cols) & Publish Daily Rates / Audit (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Rate Master Table */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Rate Master Definitions</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  {definitions.filter((d) => d.isActive).length} Active Purities configured for showroom POS & Inventory
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                Single Source of Truth
              </span>
            </div>

            {/* Rate Master Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Metal</th>
                    <th className="py-2.5 px-3">Purity</th>
                    <th className="py-2.5 px-3">Fineness</th>
                    <th className="py-2.5 px-3 text-right">Current Rate</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {definitions.map((def) => (
                    <tr
                      key={def.id}
                      className={`hover:bg-slate-50/75 transition-colors ${
                        !def.isActive ? 'opacity-60 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-sans font-bold text-slate-900">
                        {def.metal}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-700">
                        {def.purity}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {def.fineness}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ₹{def.currentRate}
                        <span className="text-[10px] font-sans font-normal text-slate-400">/g</span>
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        {def.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-sans space-x-1">
                        <button
                          onClick={() => {
                            setEditingDef(def);
                            setEditRate(def.currentRate);
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                          title="Edit Rate"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(def)}
                          className={`p-1.5 rounded-md transition-colors ${
                            def.isActive
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={def.isActive ? 'Deactivate Purity' : 'Activate Purity'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Immutable Rate Audit Trail Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <span>Immutable Rate History & Audit Trail</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400">
                {history.length} Event Logs
              </span>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No rate changes logged yet.
                </div>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span className="font-bold font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700">
                        {h.action}
                      </span>
                      <span>{new Date(h.createdAt).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex items-center justify-between font-mono text-[11px] pt-1">
                      <span className="font-bold text-slate-900">
                        {h.metal} {h.purity} {h.fineness ? `(${h.fineness})` : ''}
                      </span>
                      <div>
                        {h.previousRate ? (
                          <span className="text-slate-400 line-through mr-2">
                            ₹{h.previousRate}
                          </span>
                        ) : null}
                        <span className="font-bold text-amber-700">₹{h.newRate}/g</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      <span>Changed by: {h.changedByName || 'Authorized Owner'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Publish Today's Showroom Rates Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-5 sticky top-20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>Publish Today's Rates</span>
            </h2>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
              Live Showroom POS
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Set today's live selling board rates for all active showroom purities. Changing 24K Gold automatically derives standard ratios.
          </p>

          <form onSubmit={handlePublishRates} className="space-y-4 text-xs">
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {definitions
                .filter((d) => d.isActive)
                .map((def) => (
                  <div
                    key={def.id}
                    className={`p-3 rounded-xl border ${
                      def.metal === 'GOLD' && def.purity.includes('24')
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{def.metal} {def.purity}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          (Fineness: {def.fineness})
                        </span>
                      </label>
                      {def.metal === 'GOLD' && def.purity.includes('24') ? (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          Master Benchmark
                        </span>
                      ) : null}
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={dailyRates[def.id] ?? def.currentRate}
                        onChange={(e) => handleRateInputChange(def.id, e.target.value)}
                        className={`w-full font-mono text-sm font-bold pl-7 pr-3 py-2 rounded-lg border ${
                          def.metal === 'GOLD' && def.purity.includes('24')
                            ? 'border-amber-400 bg-white text-slate-950 focus:border-amber-500'
                            : 'border-slate-300 bg-white text-slate-900'
                        } focus:outline-none`}
                        required
                      />
                    </div>
                  </div>
                ))}
            </div>

            <button
              type="submit"
              disabled={isPublishing}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isPublishing ? 'Publishing Rates...' : "Publish Today's Rates"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal 1: Add Custom Metal / Purity */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-600" />
                <span>Add Metal & Purity Definition</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePurity} className="space-y-3.5 text-xs">
              {/* Metal Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Metal *</label>
                <select
                  value={addMetal}
                  onChange={(e) => setAddMetal(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-amber-500 focus:outline-none"
                >
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Platinum">Platinum</option>
                  <option value="Rose Gold">Rose Gold</option>
                  <option value="White Gold">White Gold</option>
                  <option value="Custom">+ Custom Metal</option>
                </select>
              </div>

              {addMetal === 'Custom' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Custom Metal Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Titanium / Copper"
                    value={customMetalName}
                    onChange={(e) => setCustomMetalName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    required
                  />
                </div>
              )}

              {/* Purity & Fineness Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Purity Label *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20K, 19K, 925"
                    value={addPurity}
                    onChange={(e) => {
                      setAddPurity(e.target.value);
                      // Auto populate fineness for standard presets
                      const val = e.target.value.toUpperCase();
                      if (val === '20K') setAddFineness('833');
                      else if (val === '19K') setAddFineness('792');
                      else if (val === '14K') setAddFineness('585');
                      else if (val === '10K') setAddFineness('417');
                      else if (val === '925') setAddFineness('925');
                      else if (val === '900') setAddFineness('900');
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fineness (1-1000) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="e.g. 833, 792"
                    value={addFineness}
                    onChange={(e) => setAddFineness(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Initial Rate */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Current Selling Rate (₹ / Gram) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={addRate}
                    onChange={(e) => setAddRate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
                >
                  {isAdding ? 'Saving...' : 'Save Purity Definition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Single Rate */}
      {editingDef && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <span>Update Master Rate</span>
              </h3>
              <button
                onClick={() => setEditingDef(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="text-slate-500">
                Metal / Purity:{' '}
                <b className="text-slate-900">{editingDef.metal} {editingDef.purity}</b>
              </div>
              <div className="text-slate-500">
                Fineness: <b className="text-slate-900">{editingDef.fineness}</b>
              </div>
              <div className="text-[10px] text-slate-400">
                Identity fields are immutable. To change purity, deactivate this definition and create a new one.
              </div>
            </div>

            <form onSubmit={handleUpdateSingleRate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  New Rate per Gram (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full border-2 border-amber-400 rounded-lg pl-7 pr-3 py-2 font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDef(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
                >
                  {isUpdating ? 'Updating...' : 'Update Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
