import type { AuthenticatedUser } from "./auth-user.type";

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
};
