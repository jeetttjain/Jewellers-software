import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { OwnerModeProvider } from './context/OwnerModeContext.js';
import { CartProvider } from './context/CartContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AppShell } from './components/layout/AppShell.js';

// Core Authentication Page (Eagerly loaded for instant auth boot)
import { LoginPage } from './pages/LoginPage.js';

// Route Loading Placeholder
const RouteLoadingFallback: React.FC = () => (
  <div className="flex-1 h-full min-h-[50vh] flex items-center justify-center">
    <div className="flex items-center gap-3 text-surface-500 text-sm">
      <div className="w-5 h-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      <span>Loading View...</span>
    </div>
  </div>
);

// Code-Split Showroom Pages (Loaded on-demand)
const DashboardPage = lazy(() => import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })));
const ScannerPage = lazy(() => import('./pages/ScannerPage.js').then((m) => ({ default: m.ScannerPage })));
const ScanResultPage = lazy(() => import('./pages/ScanResultPage.js').then((m) => ({ default: m.ScanResultPage })));
const BillingTerminalPage = lazy(() => import('./pages/BillingTerminalPage.js').then((m) => ({ default: m.BillingTerminalPage })));
const PaymentCheckoutPage = lazy(() => import('./pages/PaymentCheckoutPage.js').then((m) => ({ default: m.PaymentCheckoutPage })));
const InvoiceConfirmationPage = lazy(() => import('./pages/InvoiceConfirmationPage.js').then((m) => ({ default: m.InvoiceConfirmationPage })));
const InvoicesDirectoryPage = lazy(() => import('./pages/InvoicesDirectoryPage.js').then((m) => ({ default: m.InvoicesDirectoryPage })));
const InventoryMasterPage = lazy(() => import('./pages/InventoryMasterPage.js').then((m) => ({ default: m.InventoryMasterPage })));
const AddEditItemPage = lazy(() => import('./pages/AddEditItemPage.js').then((m) => ({ default: m.AddEditItemPage })));
const LabelPrintQueuePage = lazy(() => import('./pages/LabelPrintQueuePage.js').then((m) => ({ default: m.LabelPrintQueuePage })));
const RatesManagerPage = lazy(() => import('./pages/RatesManagerPage.js').then((m) => ({ default: m.RatesManagerPage })));
const CustomersDirectoryPage = lazy(() => import('./pages/CustomersDirectoryPage.js').then((m) => ({ default: m.CustomersDirectoryPage })));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage.js').then((m) => ({ default: m.CustomerDetailPage })));
const SuppliersDirectoryPage = lazy(() => import('./pages/SuppliersDirectoryPage.js').then((m) => ({ default: m.SuppliersDirectoryPage })));
const SupplierDetailPage = lazy(() => import('./pages/SupplierDetailPage.js').then((m) => ({ default: m.SupplierDetailPage })));
const PaymentsRegisterPage = lazy(() => import('./pages/PaymentsRegisterPage.js').then((m) => ({ default: m.PaymentsRegisterPage })));
const OldGoldAssayPage = lazy(() => import('./pages/OldGoldAssayPage.js').then((m) => ({ default: m.OldGoldAssayPage })));
const ReturnsTerminalPage = lazy(() => import('./pages/ReturnsTerminalPage.js').then((m) => ({ default: m.ReturnsTerminalPage })));
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage.js').then((m) => ({ default: m.AuditTrailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <OwnerModeProvider>
            <CartProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  {/* Standalone Authentication Route */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Main Showroom Workspace */}
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />

                    {/* Rapid Scanner Terminal */}
                    <Route path="/scan" element={<ScannerPage />} />
                    <Route path="/scan/result/:id" element={<ScanResultPage />} />

                    {/* POS Billing & Split-Tender Settlement */}
                    <Route path="/billing/new" element={<BillingTerminalPage />} />
                    <Route path="/billing/payment" element={<PaymentCheckoutPage />} />

                    {/* Invoices Directory & Confirmation */}
                    <Route path="/bills" element={<InvoicesDirectoryPage />} />
                    <Route path="/bills/:id" element={<InvoiceConfirmationPage />} />

                    {/* Serialized Stock Inventory & 2-Inch Tag Queue */}
                    <Route path="/inventory" element={<InventoryMasterPage />} />
                    <Route path="/inventory/new" element={<AddEditItemPage />} />
                    <Route path="/inventory/labels/queue" element={<LabelPrintQueuePage />} />

                    {/* Bullion Board Rates Manager */}
                    <Route path="/rates" element={<RatesManagerPage />} />

                    {/* Customer Directory & Ledgers */}
                    <Route path="/customers" element={<CustomersDirectoryPage />} />
                    <Route path="/customers/:id" element={<CustomerDetailPage />} />

                    {/* Supplier & Karigar Master */}
                    <Route path="/suppliers" element={<SuppliersDirectoryPage />} />
                    <Route path="/suppliers/:id" element={<SupplierDetailPage />} />

                    {/* Payments Register */}
                    <Route path="/payments" element={<PaymentsRegisterPage />} />

                    {/* Old Gold Scrap Assay & Trade-In */}
                    <Route path="/old-gold/new" element={<OldGoldAssayPage />} />

                    {/* Returns & Exchanges Terminal */}
                    <Route path="/returns/new" element={<ReturnsTerminalPage />} />

                    {/* Administration & Auditing */}
                    <Route path="/audit" element={<AuditTrailPage />} />
                    <Route path="/settings" element={<SettingsPage />} />

                    {/* Wildcard Fallback */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </CartProvider>
          </OwnerModeProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
