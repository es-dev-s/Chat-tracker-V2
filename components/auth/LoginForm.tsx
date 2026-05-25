"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { BusyLabel } from "@/components/ui/BusySpinner";
import { loginSchema } from "@/lib/auth/schemas";
import { ROUTES } from "@/lib/auth/routes";
import { C, MONO, RAD, SPACE, TYPE } from "@/lib/design/tokens";
import { useAuthStore } from "@/store/auth-store";

export default function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loginError = useAuthStore((s) => s.loginError);
  const status = useAuthStore((s) => s.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const submitting = status === "loading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") {
          next[key] = issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    const ok = await login(parsed.data.email, parsed.data.password);
    if (ok) {
      router.replace(ROUTES.dashboard);
    }
  };

  return (
    <div
      className="ct-auth-page"
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE.pageX,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "32px 34px",
          borderRadius: RAD.lg,
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow:
            "0 4px 16px rgba(29, 78, 216, 0.06), 0 1px 0 rgba(255,255,255,0.7) inset",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            color: C.accent,
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Chat Tracker
        </div>
        <div
          style={{
            ...TYPE.bodySm,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "-0.03em",
            color: C.text,
            marginBottom: 6,
          }}
        >
          Sign in
        </div>
        <div style={{ ...TYPE.caption, color: C.muted, marginBottom: 22 }}>
          Enter the credentials supplied by your team lead.
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                ...TYPE.fieldUpper,
                color: C.muted,
                marginBottom: 8,
              }}
            >
              Email
            </div>
            <input
              className="ct-input"
              placeholder="you@company.com"
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email ? (
              <p className="ct-field-error">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div style={{ marginBottom: 14, position: "relative" }}>
            <div
              style={{
                ...TYPE.fieldUpper,
                color: C.muted,
                marginBottom: 8,
              }}
            >
              Password
            </div>
            <input
              className="ct-input"
              style={{ paddingRight: 44 }}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
            />
            <button
              type="button"
              className="ct-btn-bare ct-password-toggle"
              onClick={() => setShowPassword((s) => !s)}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.5} aria-hidden />
              ) : (
                <Eye size={18} strokeWidth={1.5} aria-hidden />
              )}
            </button>
            {fieldErrors.password ? (
              <p className="ct-field-error">{fieldErrors.password}</p>
            ) : null}
          </div>

          {loginError ? (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                ...TYPE.caption,
                color: C.red,
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: RAD.sm,
                background: "rgba(254,242,242,0.65)",
                border: "1px solid rgba(220,38,38,0.2)",
              }}
            >
              {loginError}
            </motion.div>
          ) : null}

          <button
            type="submit"
            className="ct-btn-primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
            style={{ width: "100%", minHeight: 44 }}
          >
            {submitting ? <BusyLabel label="Signing in…" /> : "Sign in"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
