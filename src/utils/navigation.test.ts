import { describe, expect, it } from 'vitest';
import { permissionsForRole, type Role } from '../../server/permissions';
import { allowedSections, homeForRole, type CanCheck } from './navigation';

function canFor(role: Role): CanCheck {
  const permissions = new Set(permissionsForRole(role));
  return (permission) => permissions.has(permission);
}

describe('homeForRole', () => {
  it('sends each role to its primary screen', () => {
    expect(homeForRole('admin')).toBe('dashboard');
    expect(homeForRole('manager')).toBe('dashboard');
    expect(homeForRole('waiter')).toBe('tables');
    expect(homeForRole('kitchen')).toBe('kitchen');
    expect(homeForRole('cashier')).toBe('billing');
  });

  it('falls back to the dashboard for an unknown role', () => {
    expect(homeForRole('unknown')).toBe('dashboard');
  });
});

describe('allowedSections', () => {
  it('shows the full workspace to admins', () => {
    expect(allowedSections(canFor('admin'))).toEqual([
      'dashboard',
      'tables',
      'waiter-order',
      'kitchen',
      'menu',
      'billing',
      'inventory',
      'reports',
      'users',
      'settings',
      'table-qr',
    ]);
  });

  it('gives waiters the floor, ordering and billing screens', () => {
    const sections = allowedSections(canFor('waiter'));
    expect(sections).toEqual(expect.arrayContaining(['tables', 'waiter-order', 'billing']));
    expect(sections).not.toContain('kitchen');
    expect(sections).not.toContain('settings');
    expect(sections).not.toContain('users');
  });

  it('gives kitchen staff the display, availability and stock screens', () => {
    const sections = allowedSections(canFor('kitchen'));
    expect(sections).toEqual(expect.arrayContaining(['kitchen', 'menu', 'inventory']));
    expect(sections).not.toContain('tables');
    expect(sections).not.toContain('billing');
    expect(sections).not.toContain('reports');
  });

  it('gives cashiers billing and table lookup only', () => {
    expect(allowedSections(canFor('cashier'))).toEqual(['tables', 'billing']);
  });
});
