'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Zap,
  Package,
  ShoppingCart,
  Truck,
  FileText,
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/leads', label: 'Leads', icon: Zap },
    { href: '/inventory', label: 'Inventory', icon: Package },
    { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/dc-tracking', label: 'DC Tracking', icon: Truck },
    { href: '/bill-sale', label: 'Bill / Sale', icon: FileText },
  ]

  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">3V</span>
          </div>
          <div>
            <div className="font-serif font-bold text-gray-900">3Vikram</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Technologies</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-6">
          <div className="text-xs font-semibold text-gray-400 uppercase px-3 mb-4 tracking-wider">
            Workspace
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* TIP Section */}
      <div className="p-4 m-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs font-semibold text-gray-600 uppercase mb-2 tracking-wider">
          Tip
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          New to 3Vikram? Click any card to see full details — no page jumps.
        </p>
      </div>
    </div>
  )
}
