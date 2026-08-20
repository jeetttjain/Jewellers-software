import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Scan,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  CreditCard,
  Scale,
  RotateCcw,
  LayoutDashboard,
  TrendingUp,
  Tag,
  Shield,
  Settings,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-surface-900 text-white font-semibold shadow-xs'
        : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full w-full bg-white border-r border-surface-200 min-h-0 overflow-hidden">
      {/* Navigation Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 space-y-6">
        {/* Primary Action Button: Rapid Scanner */}
        <div>
          <NavLink
            to="/scan"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-gold-500 hover:bg-gold-600 text-surface-900 font-bold rounded-md shadow-xs text-xs transition-colors"
          >
            <Scan className="w-4 h-4" />
            <span>⚡ Rapid Tag Scanner</span>
            <kbd className="px-1.5 py-0.5 bg-black/10 rounded text-[10px] font-mono">F2</kbd>
          </NavLink>
        </div>

        {/* Group 1: Counter Operations */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-surface-700">
            POS & Operations
          </div>
          <nav className="space-y-1">
            <NavLink to="/billing/new" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-surface-700" />
                <span>POS Billing</span>
              </div>
              <kbd className="text-[10px] text-surface-700 font-mono">F3</kbd>
            </NavLink>
            <NavLink to="/bills" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4 text-surface-700" />
                <span>Invoices & Bills</span>
              </div>
            </NavLink>
            <NavLink to="/inventory" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-surface-700" />
                <span>Jewellery Stock</span>
              </div>
            </NavLink>
            <NavLink to="/customers" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-surface-700" />
                <span>Customers & Dues</span>
              </div>
            </NavLink>
            <NavLink to="/payments" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-surface-700" />
                <span>Payment Register</span>
              </div>
            </NavLink>
            <NavLink to="/old-gold/new" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4 text-surface-700" />
                <span>Old Gold Assay</span>
              </div>
            </NavLink>
            <NavLink to="/returns/new" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-surface-700" />
                <span>Returns & Exchange</span>
              </div>
            </NavLink>
          </nav>
        </div>

        {/* Group 2: Management & Rates */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-surface-700">
            Showroom Management
          </div>
          <nav className="space-y-1">
            <NavLink to="/dashboard" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-surface-700" />
                <span>Dashboard</span>
              </div>
            </NavLink>
            <NavLink to="/rates" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-surface-700" />
                <span>Daily Board Rates</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </NavLink>
            <NavLink to="/inventory/labels/queue" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-surface-700" />
                <span>Label Print Queue</span>
              </div>
            </NavLink>
          </nav>
        </div>

        {/* Group 3: System & Security */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-surface-700">
            Administration
          </div>
          <nav className="space-y-1">
            <NavLink to="/audit" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-surface-700" />
                <span>Security Audit Log</span>
              </div>
            </NavLink>
            <NavLink to="/settings" onClick={onClose} className={navItemClass}>
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-surface-700" />
                <span>Store Settings</span>
              </div>
            </NavLink>
          </nav>
        </div>
      </div>

      {/* Footer: User profile & Logout */}
      <div className="flex-shrink-0 p-3 border-t border-surface-200 bg-white">
        <NavLink
          to="/login"
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit / Lock Terminal</span>
        </NavLink>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Independent Scroll Container) */}
      <aside className="hidden lg:flex flex-col h-full w-64 flex-shrink-0 min-h-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Drawer (Overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full h-full bg-white z-50 animate-in slide-in-from-left duration-200 overflow-hidden">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
