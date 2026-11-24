export const ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'] as const;

export type Role = (typeof ROLES)[number];
export type UiRole = 'Admin' | 'Manager' | 'Waiter' | 'Kitchen' | 'Cashier';

/**
 * The single authorization map for the whole API. Frontend code receives the
 * resulting permission list from GET /api/auth/me and uses it only to hide or
 * disable controls; the server is always authoritative.
 */
export const PERMISSION_MAP = {
  'dashboard:read': ['admin', 'manager'],
  'users:read': ['admin'],
  'users:write': ['admin'],
  'users:delete': ['admin'],
  'settings:read': ['admin'],
  'settings:write': ['admin'],
  'invoice-settings:read': ['admin', 'manager', 'cashier'],
  'products:read': ['admin', 'manager', 'cashier'],
  'products:write': ['admin', 'manager'],
  'products:delete': ['admin'],
  'categories:read': ['admin', 'manager'],
  'categories:write': ['admin', 'manager'],
  'categories:delete': ['admin'],
  'inventory:read': ['admin', 'manager'],
  'inventory:write': ['admin', 'manager'],
  'customers:read': ['admin', 'manager', 'cashier'],
  'customers:write': ['admin', 'manager'],
  'customers:delete': ['admin'],
  'suppliers:read': ['admin', 'manager'],
  'suppliers:write': ['admin', 'manager'],
  'suppliers:delete': ['admin'],
  'purchases:read': ['admin', 'manager'],
  'purchases:write': ['admin', 'manager'],
  'purchases:delete': ['admin'],
  'sales:create': ['admin', 'manager', 'cashier'],
  'sales:read': ['admin', 'manager'],
  'sales:delete': ['admin'],
  'dues:read': ['admin', 'manager', 'cashier'],
  'dues:write': ['admin', 'manager', 'cashier'],
  'reports:read': ['admin', 'manager'],
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
