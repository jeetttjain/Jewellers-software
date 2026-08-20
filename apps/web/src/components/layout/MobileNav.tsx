import React from 'react';
import { NavLink } from 'react-router-dom';
import { Scan, ShoppingCart, Package, Users, Menu } from 'lucide-react';

interface MobileNavProps {
  onOpenMenu: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenMenu }) => {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center flex-1 py-2 text-[10px] font-medium transition-colors ${
      isActive ? 'text-gold-600 font-bold' : 'text-surface-700 hover:text-surface-900'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-surface-200 lg:hidden shadow-lg h-14 flex items-center justify-around px-1 safe-area-bottom">
      <NavLink to="/scan" className={tabClass}>
        <div className="p-1 rounded-full bg-gold-500 text-surface-900 shadow-xs mb-0.5">
          <Scan className="w-4 h-4" />
        </div>
        <span>Scan</span>
      </NavLink>

      <NavLink to="/billing/new" className={tabClass}>
        <ShoppingCart className="w-5 h-5 mb-0.5" />
        <span>POS</span>
      </NavLink>

      <NavLink to="/inventory" className={tabClass}>
        <Package className="w-5 h-5 mb-0.5" />
        <span>Stock</span>
      </NavLink>

      <NavLink to="/customers" className={tabClass}>
        <Users className="w-5 h-5 mb-0.5" />
        <span>Customers</span>
      </NavLink>

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-2 text-[10px] font-medium text-surface-700 hover:text-surface-900 focus:outline-none"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span>More</span>
      </button>
    </nav>
  );
};
