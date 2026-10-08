import { describe, expect, test } from 'bun:test'
import { getAllNavLeaves, getPageTitle } from '../src/layouts/navigation'

describe('Admin navigation helpers', () => {
  test('flattens leaf navigation items properly', () => {
    const leaves = getAllNavLeaves()
    expect(leaves.length).toBeGreaterThan(0)
    expect(leaves.some((item) => item.to === '/dashboard')).toBe(true)
  })

  test('resolves page titles based on routes', () => {
    expect(getPageTitle('/dashboard')).toBe('Dashboard')
    expect(getPageTitle('/unknown-path')).toBe('VG Admin Portal')
  })

  test('confirms dashboard route is initialized as starter scaffold', () => {
    const leaves = getAllNavLeaves()
    const dashboardItem = leaves.find((item) => item.to === '/dashboard')
    expect(dashboardItem).toBeDefined()
    expect(dashboardItem?.label).toBe('Dashboard')
  })
})
