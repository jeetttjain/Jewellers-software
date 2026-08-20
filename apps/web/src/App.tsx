import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { OwnerModeProvider } from './context/OwnerModeContext.js';
import { CartProvider } from './context/CartContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AppShell } from './components/layout/AppShell.js';

// Core Showroom Pages
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ScannerPage } from './pages/ScannerPage.js';
import { ScanResultPage } from './pages/ScanResultPage.js';
import { BillingTerminalPage } from './pages/BillingTerminalPage.js';
import { PaymentCheckoutPage } from './pages/PaymentCheckoutPage.js';
import { InvoiceConfirmationPage } from './pages/InvoiceConfirmationPage.js';
import { InvoicesDirectoryPage } from './pages/InvoicesDirectoryPage.js';
import { InventoryMasterPage } from './pages/InventoryMasterPage.js';
import { AddEditItemPage } from './pages/AddEditItemPage.js';
import { LabelPrintQueuePage } from './pages/LabelPrintQueuePage.js';
import { RatesManagerPage } from './pages/RatesManagerPage.js';
import { CustomersDirectoryPage } from './pages/CustomersDirectoryPage.js';
import { CustomerDetailPage } from './pages/CustomerDetailPage.js';
import { PaymentsRegisterPage } from './pages/PaymentsRegisterPage.js';
import { OldGoldAssayPage } from './pages/OldGoldAssayPage.js';
import { ReturnsTerminalPage } from './pages/ReturnsTerminalPage.js';
import { AuditTrailPage } from './pages/AuditTrailPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <OwnerModeProvider>
            <CartProvider>
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
          </CartProvider>
        </OwnerModeProvider>
      </AuthProvider>
    </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
