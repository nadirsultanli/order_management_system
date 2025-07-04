import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { WarehouseDetailPage } from './pages/WarehouseDetailPage';
import { InventoryPage } from './pages/InventoryPage';
import { PricingPage } from './pages/PricingPage';
import { PriceListDetailPage } from './pages/PriceListDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { CreateOrderPage } from './pages/CreateOrderPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrderSchedulePage } from './pages/OrderSchedulePage';
import { OrderReportsPage } from './pages/OrderReportsPage';
import { TransfersPage } from './pages/TransfersPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrucksPage } from './pages/TrucksPage';
import { TruckDetailPage } from './pages/TruckDetailPage';
import CreateTruckPage from './pages/CreateTruckPage';
import { TruckCapacityDashboard } from './pages/TruckCapacityDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="warehouses/:id" element={<WarehouseDetailPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="pricing/:id" element={<PriceListDetailPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/new" element={<CreateOrderPage />} />
            <Route path="orders/schedule" element={<OrderSchedulePage />} />
            <Route path="orders/reports" element={<OrderReportsPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="transfers" element={<TransfersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="trucks">
              <Route index element={<TrucksPage />} />
              <Route path="new" element={<CreateTruckPage />} />
              <Route path="capacity" element={<TruckCapacityDashboard />} />
              <Route path=":id" element={<TruckDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;