'use client'

import type { ReactNode } from 'react'
import TeamMemberLayout from '@/components/TeamMemberLayout'

export default function TeammateLayout({ children }: { children: ReactNode }) {
  return <TeamMemberLayout>{children}</TeamMemberLayout>
}
