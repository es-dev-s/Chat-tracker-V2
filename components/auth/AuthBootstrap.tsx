"use client";

import { useLayoutEffect } from "react";
import type { SessionUser } from "@/lib/auth/constants";
import { makeDisplayName } from "@/lib/utils/display-name";
import { useAuthStore } from "@/store/auth-store";

/** Seed client auth state from the server session (logout, etc.). */
export default function AuthBootstrap({ user }: { user: SessionUser }) {
  useLayoutEffect(() => {
    const hydrated = { ...user, name: makeDisplayName(user) };
    useAuthStore.setState({
      user: hydrated,
      status: "authenticated",
      loginError: null,
    });
  }, [user]);

  return null;
}
