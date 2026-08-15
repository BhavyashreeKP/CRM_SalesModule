'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'
import synovLogo from "../assets.png";

interface TopBarProps {
  userName?: string
  userRole?: string
  userInitials?: string
}

export function TopBar({
  userName = 'Anaya Patel',
  userRole = 'Sales · Bengaluru',
  userInitials = 'AP',
}: TopBarProps) {
  const [notificationCount] = useState(3)

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-[#374151] bg-[#1F2937] px-6">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={synovLogo}
          alt="Synov IT Services logo"
          className="h-10 w-auto object-contain"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-white">Synov IT Services</div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Bell Notification */}
        <button className="relative cursor-pointer rounded-lg p-2 transition-colors hover:bg-white/10">
          <Bell className="h-5 w-5 text-[#E5E7EB]" />
          {notificationCount > 0 && (
            <div className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
              <span className="text-xs font-bold text-white">{notificationCount}</span>
            </div>
          )}
        </button>

        {/* User Profile */}
        <div className="flex cursor-pointer items-center gap-3 border-l border-[#374151] pl-4 transition-opacity hover:opacity-80">
          <div className="text-right">
            <div className="text-sm font-medium text-white">{userName}</div>
            <div className="text-xs text-[#D1D5DB]">{userRole}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB]">
            <span className="text-sm font-semibold text-white">{userInitials}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
