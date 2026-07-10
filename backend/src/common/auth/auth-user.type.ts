import type { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
};
