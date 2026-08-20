import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Layers, ArrowRight, ShieldAlert } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  phase?: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({
  title,
  phase = 'Phase Placeholder',
  description = 'This screen is architectural scaffold in Phase 0. Implementation begins in designated phase upon approval.'
}) => {
  const location = useLocation();

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Location tracker */}
      <div className="flex items-center gap-2 text-xs text-surface-700">
        <span>App</span>
        <span>/</span>
        <span className="font-mono text-surface-900 font-medium">{location.pathname}</span>
      </div>

      {/* Surface Card Container */}
      <div className="surface-card p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold-100 text-gold-800 mb-2">
              <Layers className="w-3.5 h-3.5" />
              {phase}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-surface-900 tracking-tight">
              {title}
            </h1>
            <p className="text-xs md:text-sm text-surface-700 mt-1 max-w-2xl">
              {description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-100 text-xs font-mono text-surface-700 border border-surface-200">
              <ShieldAlert className="w-3.5 h-3.5 text-gold-600" />
              Phase 0 Scaffold
            </span>
          </div>
        </div>

        {/* Diagnostic Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
            <div className="text-[11px] font-semibold text-surface-700 uppercase tracking-wider">
              Route Path
            </div>
            <div className="mt-1 font-mono text-xs font-bold text-surface-900">
              {location.pathname}
            </div>
          </div>
          <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
            <div className="text-[11px] font-semibold text-surface-700 uppercase tracking-wider">
              Architecture Status
            </div>
            <div className="mt-1 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Specification Frozen
            </div>
          </div>
          <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
            <div className="text-[11px] font-semibold text-surface-700 uppercase tracking-wider">
              Quick Action
            </div>
            <Link
              to="/scan"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-600 hover:text-gold-700"
            >
              Go to Rapid Scanner <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
