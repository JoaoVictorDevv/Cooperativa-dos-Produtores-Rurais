export const roles = ["ADMIN", "OPERADOR", "CONSULTA"] as const;
export type Role = (typeof roles)[number];

export interface Identity {
  userId: string;
  email: string | null;
  accessToken: string;
}

export interface Actor extends Identity {
  organizationId: string;
  role: Role;
}

export function canWrite(role: Role): boolean {
  return role === "ADMIN" || role === "OPERADOR";
}

export function canManageMembers(role: Role): boolean {
  return role === "ADMIN";
}
