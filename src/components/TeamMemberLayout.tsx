'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  LogOut,
  Menu,
  X,
  Building2,
  Users,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'

import Image from 'next/image'

interface TeamMemberLayoutProps {
  children: React.ReactNode
}

export default function TeamMemberLayout({ children }: TeamMemberLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, organization } = useAuth()
  // Sidebar is open by default; toggle works for both desktop and mobile
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logged out successfully')
      router.push('/team-login')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }

  const navigation = [
    {
      name: 'Dashboard',
      href: '/teammate/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'My Tasks',
      href: '/teammate/tasks',
      icon: CheckSquare,
    },
    {
      name: 'My Projects',
      href: '/teammate/projects',
      icon: Briefcase,
    },
    {
      name: 'Team',
      href: '/teammate/team',
      icon: Users,
    },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Toggle (always visible) */}
      <button
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="fixed top-4 left-4 z-50 p-3 rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out z-50 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image src="/logo.png" alt="Clienter Logo" width={40} height={40} className='rounded-md' />
              <div>
                <h1 className="text-xl font-bold">Clienter</h1>
                <p className="text-xs text-gray-400">Team Member</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Organization Info */}
        {organization && (
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center space-x-3 bg-gray-800 rounded-lg p-3">
              <Building2 className="w-5 h-5 text-orange-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {organization.organizationName}
                </p>
                <p className="text-xs text-gray-400 capitalize">{organization.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </button>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div>
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6 text-gray-900" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <span className="font-bold text-gray-900">Clienter</span>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page Content */}
        {/* Keep desktop content offset stable to avoid layout jumps when toggling */}
        <main className="transition-all duration-300 lg:pl-64">{children}</main>
      </div>
    </div>
  )
}
