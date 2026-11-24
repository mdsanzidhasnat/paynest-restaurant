import type { Permission } from '../../server/permissions';
import type { NavSection } from '../types/domain';

export type CanCheck = (permission: Permission) => boolean;

export const ROLE_HOME: Record<string, NavSection> = {
  admin: 'dashboard',
  manager: 'dashboard',
  waiter: 'tables',
  kitchen: 'kitchen',
  cashier: 'billing',
};

/** Each role lands on the screen it uses most. Unknown roles use the dashboard. */
export function homeForRole(role: string): NavSection {
  return ROLE_HOME[role.trim().toLowerCase()] ?? 'dashboard';
}

/** Cosmetic navigation filter. The backend remains the authority on access. */
export function allowedSections(can: CanCheck): NavSection[] {
  const sections: NavSection[] = [];
  if (can('reports:read')) sections.push('dashboard');
  if (can('tables:read')) sections.push('tables');
  if (can('orders:write')) sections.push('waiter-order');
  if (can('kitchen:read')) sections.push('kitchen');
  if (can('menu:write') || can('menu:availability')) sections.push('menu');
  if (can('bills:read')) sections.push('billing');
  if (can('inventory:read')) sections.push('inventory');
  if (can('reports:read')) sections.push('reports');
  if (can('users:read')) sections.push('users');
  if (can('settings:read')) sections.push('settings');
  if (can('tables:qr')) sections.push('table-qr');
  return sections;
}
