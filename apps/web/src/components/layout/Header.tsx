import React from 'react';
import { Sparkles, Wifi, Search, Menu, User, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  return (
    <header className="flex-shrink-0 z-30 bg-white border-b border-surface-200 h-14 px-4 flex items-center justify-between shadow-xs">
      {/* Left: Mobile menu toggle + Store Brand */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-surface-700 hover:bg-surface-100 lg:hidden focus:outline-none"
            aria-label="Toggle Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gold-500 rounded flex items-center justify-center font-bold text-surface-900 text-xs shadow-xs">
            KJ
          </div>
          <span className="font-bold text-sm tracking-tight text-surface-900 hidden sm:inline">
            Kamal Jewellers
          </span>
        </Link>
        <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-100 text-surface-700 border border-surface-200">
          Counter 01
        </span>
      </div>

      {/* Middle: Live Gold & Silver Board Rate Ribbon */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gold-50 border border-gold-200 rounded-md text-xs font-mono font-bold text-gold-900 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-gold-600 animate-pulse" />
          <span className="text-[11px] text-gold-700 font-sans font-medium">22K Gold:</span>
          <span>₹6,450/g</span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-surface-100 border border-surface-200 rounded-md text-xs font-mono font-bold text-surface-800">
          <span className="text-[11px] text-surface-700 font-sans font-medium">Silver:</span>
          <span>₹88.50/g</span>
        </div>
      </div>

      {/* Right: Quick Search, Online Status, User Profile */}
      <div className="flex items-center gap-2">
        <Link
          to="/scan"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 rounded-md border border-surface-200 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick Find</span>
          <kbd className="hidden lg:inline-block px-1 bg-white border border-surface-300 rounded text-[10px] font-mono text-gray-500">
            F1
          </kbd>
        </Link>

        {/* Online Network Indicator */}
        <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200">
          <Wifi className="w-3 h-3 text-emerald-600" />
          <span className="hidden md:inline">Online</span>
        </div>

        {/* User Role Pill */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-surface-200">
          <div className="w-7 h-7 bg-surface-900 text-white rounded-full flex items-center justify-center text-xs font-semibold">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-surface-900 leading-tight">Admin</div>
            <div className="text-[10px] text-surface-700 flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5 text-gold-600" />
              Owner
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
