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
  UserCog,
  CheckSquare,
  Building2,
  FolderKanban,
} from 'lucide-react'
import { NotificationCenter } from '@/components/NotificationCenter'
import { getRoleBadgeColor, getRoleLabel } from '@/lib/rbac-helpers'

import Image from 'next/image'

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut, profile, organization } = useAuth()
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

  // Check if user is owner or admin
  // If organization is null (migrations not run), assume owner for testing
  const isOwnerOrAdmin =
    organization?.role === 'owner' || organization?.role === 'admin' || !organization // Show all links if organization not loaded yet

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/meetings', label: 'Meetings', icon: Calendar },
    { href: '/expenses', label: 'Expenses', icon: TrendingDown },
    // Team management - only for owners/admins
    { href: '/team', label: 'Team', icon: UserCog },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile Menu Button (show menu icon when closed) */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

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
        {/* Mobile Close Button (inside sidebar, top-right) */}
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden absolute top-4 right-4 z-50 p-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-gray-800 relative">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 overflow-hidden rounded-md">
                <Image
                  src="/logo.png"
                  alt="Clienter Logo"
                  width={32}
                  height={32}
                  className="object-contain w-full h-full"
                />
              </div>
              <span className="text-lg sm:text-xl font-bold">Clienter</span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" className="w-full flex justify-center">
              <div className="flex items-center justify-center w-8 h-8 overflow-hidden rounded-md">
                <Image
                  src="/logo.png"
                  alt="Clienter Logo"
                  width={32}
                  height={32}
                  className="object-contain w-full h-full"
                />
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

        {/* Organization Info Banner */}
        {organization && !isCollapsed && (
          <div className="px-4 py-3 bg-zinc-900 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {organization.organizationName}
                </p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(
                    organization.role
                  )}`}
                >
                  {getRoleLabel(organization.role)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Setup Required Notice */}
        {!organization && !isCollapsed && (
          <div className="px-4 py-3 bg-yellow-900/30 border-b border-yellow-700/50">
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-yellow-200 mb-1">Setup Required</p>
                <p className="text-xs text-yellow-300/90 leading-relaxed">
                  Run database migrations to enable team features
                </p>
                <Link
                  href="/team"
                  className="inline-block mt-2 text-xs text-yellow-400 hover:text-yellow-300 underline"
                >
                  View instructions →
                </Link>
              </div>
            </div>
          </div>
        )}

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
