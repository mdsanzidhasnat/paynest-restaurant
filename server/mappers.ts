import { permissionsForRole, toUiRole, type Role } from './permissions.ts';

// better-sqlite3 returns untyped rows; all values are validated before mapping.
type Row = any;

export function mapUser(row: Row) {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    role: toUiRole(row.role as Role),
    active: Boolean(row.active),
    avatar: row.avatar ?? undefined,
    lastActive: row.last_active as string,
    permissions: permissionsForRole(row.role as Role),
  };
}
