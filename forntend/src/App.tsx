import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import ModuleSelectPage from '@/pages/ModuleSelectPage'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import LeadsPage from '@/pages/LeadsPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage'
import DCTrackingPage from '@/pages/DCTrackingPage'
import BillSalePage from '@/pages/BillSalePage'
import PlaceholderPage from '@/pages/PlaceholderPage'

function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 ml-56">
        <TopBar />
        <main className="mt-16 p-8">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing: choose a module */}
        <Route path="/" element={<ModuleSelectPage />} />

        {/* Sales module — full CRM lives here */}
        <Route
          path="/sales"
          element={
            <SalesLayout>
              <Navigate to="/sales/dashboard" replace />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/dashboard"
          element={
            <SalesLayout>
              <DashboardPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/customers"
          element={
            <SalesLayout>
              <CustomersPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/leads"
          element={
            <SalesLayout>
              <LeadsPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/inventory"
          element={
            <SalesLayout>
              <InventoryPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/purchase-orders"
          element={
            <SalesLayout>
              <PurchaseOrdersPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/dc-tracking"
          element={
            <SalesLayout>
              <DCTrackingPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/bill-sale"
          element={
            <SalesLayout>
              <BillSalePage />
            </SalesLayout>
          }
        />

        {/* Inventory module (placeholder) */}
        <Route
          path="/inventory"
          element={<PlaceholderPage module="Inventory" />}
        />

        {/* Accounts module (placeholder) */}
        <Route
          path="/accounts"
          element={<PlaceholderPage module="Accounts" />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}