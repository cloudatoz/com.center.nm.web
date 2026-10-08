import type { LucideIcon } from 'lucide-react'
import { GraduationCap, LayoutDashboard, Presentation, UserRoundCog, Users } from 'lucide-react'

export interface NavLeafItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
  badge?: string
}

export interface NavGroupItem {
  id: string
  label: string
  icon: LucideIcon
  children: NavLeafItem[]
}

export type NavItem = NavLeafItem | NavGroupItem

export function isNavGroup(item: NavItem): item is NavGroupItem {
  return 'children' in item
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'students',
    label: 'Học Sinh',
    icon: GraduationCap,
    children: [
      {
        id: 'students-management',
        label: 'Quản lý',
        to: '/students',
        icon: Users,
      },
    ],
  },
  {
    id: 'teachers',
    label: 'Giáo Viên',
    icon: Presentation,
    children: [
      {
        id: 'teachers-management',
        label: 'Quản lý',
        to: '/teachers',
        icon: UserRoundCog,
      },
    ],
  },
]

export function getAllNavLeaves(): NavLeafItem[] {
  const leaves: NavLeafItem[] = []
  for (const item of ADMIN_NAV_ITEMS) {
    if (isNavGroup(item)) {
      leaves.push(...item.children)
    } else {
      leaves.push(item)
    }
  }
  return leaves
}

export function getPageTitle(pathname: string) {
  const leaves = getAllNavLeaves()
  return leaves.find((item) => pathname.startsWith(item.to))?.label || 'VG Admin Portal'
}
