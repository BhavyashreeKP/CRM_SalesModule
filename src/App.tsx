import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import LeadsPage from '@/pages/LeadsPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage'
import DCTrackingPage from '@/pages/DCTrackingPage'
import BillSalePage from '@/pages/BillSalePage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex">
        <Sidebar />
        <div className="flex-1 ml-56">
          <TopBar />
          <main className="mt-16 p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/dc-tracking" element={<DCTrackingPage />} />
              <Route path="/bill-sale" element={<BillSalePage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}