import type { LucideIcon } from 'lucide-react'
import { GraduationCap, History, LayoutDashboard, Presentation, ReceiptText, UserRoundCog, Users, WalletCards } from 'lucide-react'

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
    label: 'Bảng Số Liệu',
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
      {
        id: 'students-history',
        label: 'Lịch sử học',
        to: '/students/history',
        icon: History,
      },
      {
        id: 'students-receipts',
        label: 'Phiếu thu',
        to: '/students/receipts',
        icon: ReceiptText,
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
      {
        id: 'teachers-history',
        label: 'Lịch sử dạy',
        to: '/teachers/history',
        icon: History,
      },
    ],
  },
  {
    id: 'costs',
    label: 'Chi phí',
    icon: WalletCards,
    children: [
      {
        id: 'costs-management',
        label: 'Quản lý',
        to: '/costs',
        icon: ReceiptText,
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
  return leaves
    .filter((item) => pathname.startsWith(item.to))
    .sort((left, right) => right.to.length - left.to.length)[0]?.label || 'VG Admin Portal'
}
