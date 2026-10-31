export const ROLES = [
  "guest",
  "user",
  "moderator",
  "editor",
  "author",
  "support",
  "manager",
  "admin",
  "super_admin",
  "owner",
] as const;

export type Role = (typeof ROLES)[number];