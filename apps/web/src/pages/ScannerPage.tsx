import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { QrCode, Search, Sparkles, Zap, ShieldCheck } from 'lucide-react';

export const ScannerPage: React.FC = () => {
  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleLookup = async (lookupCode: string) => {
    if (!lookupCode.trim()) return;
    setIsSearching(true);
    try {
      const clean = lookupCode.replace(/^pos:\/\/t\//, '').trim();
      const res = await api.get<any>(`/scan/lookup?code=${encodeURIComponent(clean)}`);
      navigate(`/scan/result/${res.item.itemCode}`);
    } catch (err: any) {
      addToast(err.message || 'Item barcode not found in stock catalog', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(code);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 mb-1">
          <QrCode className="w-8 h-8 animate-pulse" />
        </div>
        <h1 className="text-xl font-serif font-bold text-slate-900">
          Rapid Jewellery Tag Scanner
        </h1>
        <p className="text-xs text-slate-500">
          USB / Bluetooth 2D Handheld Scanner Ready (Auto Enter Supported)
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Scan Barcode / Micro-QR or Enter Serial Code
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. KJ-GLD-NK-001 or AH8921"
                className="w-full bg-slate-50 border-2 border-amber-400 rounded-xl pl-11 pr-4 py-3 font-mono text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSearching || !code}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <Zap className="w-4 h-4" />
            <span>{isSearching ? 'Calculating Sub-300ms Estimate...' : 'Get Live Showroom Quote'}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
            Quick Demo Catalog Shortcuts:
          </span>
          <div className="flex flex-wrap gap-2">
            {['KJ-GLD-NK-001', 'KJ-GLD-BG-002', 'KJ-GLD-RG-003', 'KJ-SLV-UT-004'].map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => { setCode(sc); handleLookup(sc); }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-900 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700 transition-colors"
              >
                {sc}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
