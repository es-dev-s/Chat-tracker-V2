"use client";

import { create } from "zustand";
import type { SessionUser } from "@/lib/auth/constants";
import { SESSION_KEY } from "@/lib/auth/constants";
import { makeDisplayName } from "@/lib/utils/display-name";
import { clearAllWorkspaceCaches } from "@/lib/workspace/cache";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: SessionUser | null;
  token: string | null;
  status: AuthStatus;
  loginError: string | null;
  setUser: (user: SessionUser | null) => void;
  setToken: (token: string | null) => void;
  setStatus: (status: AuthStatus) => void;
  setLoginError: (message: string | null) => void;
  hydrateFromStorage: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<boolean>;
};

function writeStoredSession(
  user: SessionUser,
  token: string | null,
): void {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        email: user.email,
        userId: user.id,
        token,
        isAdmin: user.isAdmin === true,
      }),
    );
  } catch {
    // ignore quota / privacy mode
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function readStoredSession(): {
  email: string;
  userId: unknown;
  token: string | null;
} | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const email = String(s?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return null;
    const token =
      typeof s?.token === "string" && s.token.trim() ? s.token.trim() : null;
    return { email, userId: s?.userId, token };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  status: "idle",
  loginError: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setStatus: (status) => set({ status }),
  setLoginError: (loginError) => set({ loginError }),

  hydrateFromStorage: () => {
    const stored = readStoredSession();
    if (stored?.token) {
      set({ token: stored.token, status: "loading" });
    } else {
      set({ status: "unauthenticated" });
    }
  },

  fetchMe: async () => {
    set({ status: "loading" });
    try {
      const stored = readStoredSession();
      const res = await fetch("/api/auth/me", {
        headers: stored?.token
          ? { Authorization: `Bearer ${stored.token}` }
          : undefined,
        credentials: "include",
      });
      if (!res.ok) {
        clearStoredSession();
        set({ user: null, token: null, status: "unauthenticated" });
        return false;
      }
      const data = await res.json();
      const user = data?.user;
      if (!user?.email) {
        clearStoredSession();
        set({ user: null, token: null, status: "unauthenticated" });
        return false;
      }
      const hydrated = { ...user, name: makeDisplayName(user) };
      writeStoredSession(hydrated, stored?.token ?? get().token);
      set({
        user: hydrated,
        token: stored?.token ?? get().token,
        status: "authenticated",
      });
      return true;
    } catch {
      set({ status: "unauthenticated" });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loginError: null, status: "loading" });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      let errMsg = "Invalid email or password.";
      if (res.status === 401 || res.status === 400) {
        try {
          const b = await res.json();
          if (b?.error === "INVALID_CREDENTIALS") {
            errMsg = "Invalid email or password.";
          } else if (b?.error === "EMAIL_PASSWORD_REQUIRED") {
            errMsg = "Email and password are required.";
          } else if (b?.error === "SERVER_AUTH_CONFIG") {
            errMsg =
              "Login is unavailable: set CHATTRACKER_SESSION_SECRET (16+ chars) on the API server.";
          }
        } catch {
          //
        }
        set({ loginError: errMsg, status: "unauthenticated" });
        return false;
      }

      if (!res.ok) {
        set({
          loginError: `${errMsg} The API refused the request.`,
          status: "unauthenticated",
        });
        return false;
      }

      const data = await res.json();
      const token = data?.token;
      const user = data?.user;
      if (!token || !user?.email || user?.id === undefined || user?.id === null) {
        set({
          loginError: "Unexpected login response from server.",
          status: "unauthenticated",
        });
        return false;
      }

      const hydrated = { ...user, name: makeDisplayName(user) };
      writeStoredSession(hydrated, token);
      set({
        user: hydrated,
        token,
        status: "authenticated",
        loginError: null,
      });
      return true;
    } catch {
      set({
        loginError: "Could not reach the API. Is the dev server running?",
        status: "unauthenticated",
      });
      return false;
    }
  },

  logout: async () => {
    clearStoredSession();
    clearAllWorkspaceCaches();
    // Full-page POST navigation — cookie clears server-side, no client state wipe
    // (avoids a flash of empty content while React re-renders with user=null).
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    document.body.appendChild(form);
    form.submit();
  },
}));
