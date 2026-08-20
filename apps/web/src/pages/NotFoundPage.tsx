import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full surface-card p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-gold-100 text-gold-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <span className="px-2.5 py-1 bg-surface-100 rounded text-xs font-mono font-bold text-surface-700">
            HTTP 404
          </span>
          <h1 className="text-xl font-bold text-surface-900 mt-3">Screen Not Found</h1>
          <p className="text-xs text-surface-700 mt-2">
            The requested showroom route does not exist or has been relocated.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => window.history.back()}
            className="btn-secondary w-full sm:w-auto gap-1.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
          <Link to="/dashboard" className="btn-primary w-full sm:w-auto gap-1.5 text-xs">
            <Home className="w-3.5 h-3.5" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
