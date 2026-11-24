export const ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'] as const;

export type Role = (typeof ROLES)[number];
export type UiRole = 'Admin' | 'Manager' | 'Waiter' | 'Kitchen' | 'Cashier';

/**
 * The single authorization map for the whole API. Frontend code receives the
 * resulting permission list from GET /api/auth/me and uses it only to hide or
 * disable controls; the server is always authoritative.
 */
export const PERMISSION_MAP = {
  'session:manage': ['admin', 'manager', 'waiter', 'kitchen', 'cashier'],
  'invoice-settings:read': ['admin', 'manager', 'waiter', 'kitchen', 'cashier'],

  'tables:read': ['admin', 'manager', 'waiter', 'cashier'],
  'tables:write': ['admin', 'manager'],
  'tables:qr': ['admin', 'manager'],

  'menu:read': ['admin', 'manager', 'waiter', 'kitchen', 'cashier'],
  'menu:write': ['admin', 'manager'],
  'menu:price': ['admin', 'manager'],
  'menu:availability': ['admin', 'manager', 'kitchen'],
  'recipe:read': ['admin', 'manager', 'kitchen'],
  'recipe:write': ['admin', 'manager'],

  'inventory:read': ['admin', 'manager', 'kitchen'],
  'inventory:write': ['admin', 'manager'],

  'orders:read': ['admin', 'manager', 'waiter', 'kitchen', 'cashier'],
  'orders:write': ['admin', 'manager', 'waiter'],
  'orders:transfer': ['admin', 'manager', 'waiter'],
  'orders:cancel': ['admin', 'manager'],
  'orders:override': ['admin', 'manager'],
  'orders:serve': ['admin', 'manager', 'waiter'],
  'orders:close': ['admin', 'manager'],

  'kitchen:read': ['admin', 'manager', 'kitchen'],
  'kitchen:transition': ['admin', 'manager', 'kitchen'],

  'bills:read': ['admin', 'manager', 'waiter', 'cashier'],
  'bills:request': ['admin', 'manager', 'waiter'],
  'bills:write': ['admin', 'manager', 'cashier'],
  'bills:split': ['admin', 'manager', 'cashier'],
  'bills:pay': ['admin', 'manager', 'cashier'],
  'bills:void': ['admin', 'manager'],

  'reports:read': ['admin', 'manager'],
  'users:read': ['admin'],
  'users:write': ['admin'],
  'users:delete': ['admin'],
  'settings:read': ['admin'],
  'settings:write': ['admin'],
  'audit:read': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSION_MAP;

export function permissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSION_MAP) as Permission[]).filter((permission) =>
    (PERMISSION_MAP[permission] as readonly Role[]).includes(role)
  );
}

export function roleAllows(role: Role, permission: Permission): boolean {
  return (PERMISSION_MAP[permission] as readonly Role[]).includes(role);
}

export function toUiRole(role: Role): UiRole {
  const labels: Record<Role, UiRole> = {
    admin: 'Admin',
    manager: 'Manager',
    waiter: 'Waiter',
    kitchen: 'Kitchen',
    cashier: 'Cashier',
  };
  return labels[role];
}
