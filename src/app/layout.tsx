import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/AppLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clienter - Freelancer Client Management',
  description: 'Manage your freelance clients, projects, and meetings in one place',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Clienter - Freelancer Client Management',
    description: 'Manage your freelance clients, projects, and meetings in one place',
    // uses the public logo for social previews
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clienter - Freelancer Client Management',
    description: 'Manage your freelance clients, projects, and meetings in one place',
    images: ['/logo.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
