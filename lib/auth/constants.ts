import type { AppUser } from "../db/users";

export const SESSION_COOKIE = "ct_session";
export const SESSION_KEY = "chat-tracker-session-v1";

export type SessionUser = Omit<AppUser, "password">;
