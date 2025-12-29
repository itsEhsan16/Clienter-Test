'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Home,
  Users,
  Calendar,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  TrendingDown,
} from 'lucide-react'
import { NotificationCenter } from '@/components/NotificationCenter'

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut, profile } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  // Get display name from profile, user metadata (OAuth), or fallback to email
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/meetings', label: 'Meetings', icon: Calendar },
    { href: '/expenses', label: 'Expenses', icon: TrendingDown },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition-colors"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-zinc-950 text-white z-40 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-gray-800 relative">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-bold">Clienter</span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" className="w-full flex justify-center">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
            </Link>
          )}

          {/* Collapse Button (Desktop Only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 hover:bg-orange-600 rounded-full items-center justify-center text-white shadow-lg transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6">
          <ul className="space-y-2 px-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`
                      flex items-center px-3 py-3 rounded-lg transition-all duration-200
                      ${
                        isActive
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
                          : 'text-gray-300 hover:bg-zinc-800 hover:text-white'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && <span className="font-medium">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-800 p-4">
          {!isCollapsed ? (
            <div className="mb-4">
              <div className="flex items-center space-x-3 px-2 py-2 rounded-lg bg-zinc-900">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex justify-center">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          <div className={`space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            <button
              onClick={() => setShowNotifications(true)}
              className={`
                w-full flex items-center px-3 py-2 rounded-lg text-gray-300 hover:bg-zinc-800 hover:text-white transition-colors
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <Bell className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span className="text-sm">Notifications</span>}
            </button>
          </div>
        </div>
      </aside>

      <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </>
  )
}
