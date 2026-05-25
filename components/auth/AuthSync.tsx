"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/auth/routes";
import { useAuthStore } from "@/store/auth-store";

/** Background auth sync on login page only — app routes use server session + AuthBootstrap. */
export default function AuthSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== ROUTES.login) return;
    useAuthStore.getState().hydrateFromStorage();
    void useAuthStore.getState().fetchMe();
  }, [pathname]);

  return null;
}
