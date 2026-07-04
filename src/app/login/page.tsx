"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { BookOpen } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/* ── Error map for NextAuth query params ── */
const NEXTAUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in. Check your inbox for the verification link.",
  OAuthSignin: "Could not sign in with Google. Please try again.",
  OAuthCallback: "Could not sign in with Google. Please try again.",
  Default: "Something went wrong. Please try again.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

/* ── Safe redirect — only allow same-origin relative URLs ── */
function safeRedirect(url: string | null, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return fallback;
}

/* ── Label constants ── */
const LABEL = "block text-[12px] font-bold text-foreground uppercase tracking-[0.05em] mb-1.5";
const LABEL_BARE = "text-[12px] font-bold text-foreground uppercase tracking-[0.05em]";

/* ── Focus-visible ring shared class for interactive non-input elements ── */
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const passwordReset = searchParams.get("reset") === "success";
  const emailVerified = searchParams.get("verified") === "true";
  const nextAuthError = searchParams.get("error");
  const nextAuthErrorMessage = nextAuthError
    ? (NEXTAUTH_ERRORS[nextAuthError] ?? NEXTAUTH_ERRORS.Default)
    : null;

  const callbackUrl = safeRedirect(searchParams.get("callbackUrl"), "");

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /* Per-field errors — #4 #6 */
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  /* Global error (NextAuth param errors, OAuth errors, unexpected) */
  const [globalError, setGlobalError] = useState("");

  /* ── Blur validators ── */
  const validateEmailFormat = (v: string) => {
    if (!v) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
    return "";
  };

  const handleEmailBlur = () => {
    const err = validateEmailFormat(email);
    setFieldErrors((p) => ({ ...p, email: err }));
  };

  const handlePasswordBlur = () => {
    if (!password) setFieldErrors((p) => ({ ...p, password: "Password is required." }));
    else setFieldErrors((p) => ({ ...p, password: "" }));
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError("");

    // Validate both fields before hitting the API
    const emailErr = validateEmailFormat(email);
    const pwdErr = !password ? "Password is required." : "";
    if (emailErr || pwdErr) {
      setFieldErrors({ email: emailErr, password: pwdErr });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? "Sign in failed. Please try again.";
        // Credential errors (wrong email/password) go to the password field
        // so the user knows to look there — but we intentionally keep the
        // message ambiguous ("Invalid email or password") for security.
        if (res.status === 401 || msg.toLowerCase().includes("invalid")) {
          setFieldErrors((p) => ({ ...p, password: msg }));
        } else {
          setGlobalError(msg);
        }
        setLoading(false);
        return;
      }

      // #8 — honour callbackUrl, then fall back to prefs-based redirect
      if (callbackUrl) {
        router.push(callbackUrl);
        return;
      }
      const prefsRes = await fetch("/api/user/preferences");
      const prefsData = await prefsRes.json();
      router.push(prefsData.preferences ? "/dashboard" : "/onboarding");
    } catch {
      setGlobalError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: callbackUrl || "/dashboard" });
  };

  /* Combine NextAuth param error with any local global error */
  const topError = globalError || nextAuthErrorMessage;

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex w-[54%] min-h-screen relative flex-col overflow-hidden"
        style={{ background: "linear-gradient(145deg,#030C1A 0%,#050E1D 50%,#071530 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(rgba(37,99,235,.2) 1.5px,transparent 1.5px)", backgroundSize: "28px 28px" }}
        />
        <div
          className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(37,99,235,.12) 0%,transparent 70%)" }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 py-10 min-h-0 overflow-y-auto w-full">
          <div className="w-full max-w-[360px] flex flex-col items-center text-center">
          <div className="mb-3 flex-shrink-0" style={{
            animation: "floatB 4s ease-in-out infinite",
            background: "radial-gradient(ellipse at 50% 55%, rgba(255,255,255,.18) 0%, rgba(56,189,248,.14) 40%, transparent 72%)"
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascots/nick.png"
              alt="Nick, your GED mentor"
              style={{ width: 300, height: "auto", display: "block", filter: "brightness(1.25) drop-shadow(0 0 20px rgba(56,189,248,.4)) drop-shadow(0 14px 24px rgba(37,99,235,.28))" }}
            />
          </div>
          <h2 className="text-[30px] font-bold text-white leading-[1.2] mb-2.5" style={{ fontFamily: "var(--font-feather)" }}>
            Your GED journey<br />continues here.
          </h2>
          <p className="text-sm leading-[1.65] max-w-[300px] mb-7" style={{ color: "rgba(255,255,255,.42)" }}>
            Pick up right where you left off — your plan is waiting.
          </p>
          <div className="rounded-2xl p-5 w-full text-left" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
            <p className="text-[11px] font-bold uppercase tracking-[.08em] mb-3" style={{ color: "rgba(255,255,255,.4)" }}>What you get</p>
            <div className="flex flex-col gap-2.5">
              {[
                "AI study plan that adapts to your progress",
                "All 4 GED subjects covered end-to-end",
                "Practice questions in real exam format",
                "Daily sessions that fit your schedule",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,.16)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,.72)" }}>{feat}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center bg-background py-[60px] px-6 lg:px-12">
        <div className="w-full max-w-[380px]">
          {/* Logo */}
          <div className="flex items-center gap-[9px] mb-9">
            <div className="w-8 h-8 bg-primary rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.18)" }}>
              <BookOpen className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[17px] font-bold text-foreground" style={{ fontFamily: "var(--font-feather)" }}>GED Prep</span>
          </div>

          <h1 className="text-[28px] font-bold text-foreground mb-1.5" style={{ fontFamily: "var(--font-feather)" }}>Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-6">Sign in to continue your study journey.</p>

          {/* Success banners */}
          {emailVerified && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/25 text-sm text-green-700 dark:text-green-400">
              Email verified! Sign in to set up your study plan.
            </div>
          )}
          {passwordReset && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/25 text-sm text-green-700 dark:text-green-400">
              Password updated successfully. You can now sign in.
            </div>
          )}

          {/* Global error (OAuth errors, unexpected server errors) */}
          {topError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-[11px] px-3 py-[11px]"
              style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)" }}>
              <svg className="flex-shrink-0 mt-px" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[13px] text-red-600 dark:text-red-400 font-semibold leading-[1.4]">{topError}</span>
            </div>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className={`w-full flex items-center justify-center gap-2.5 py-[11px] px-4 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS_RING}`}
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* OR divider */}
          <div className="flex items-center gap-3.5 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Email — #9 autoFocus */}
            <div className="mb-4">
              <Input
                id="email"
                label="Email"
                labelClassName={LABEL}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" }));
                }}
                onBlur={handleEmailBlur}
                required
                autoComplete="email"
                autoFocus
                error={fieldErrors.email}
              />
            </div>

            {/* Password */}
            <div className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className={LABEL_BARE}>Password</label>
                <Link href="/forgot-password" className={`text-[12px] text-primary font-bold hover:underline rounded ${FOCUS_RING}`}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" }));
                  }}
                  onBlur={handlePasswordBlur}
                  required
                  autoComplete="current-password"
                  className={[
                    "w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm transition-colors bg-card text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                    fieldErrors.password ? "border-danger bg-danger/10 focus:ring-danger" : "border-input hover:border-muted-foreground",
                  ].join(" ")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={`absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors rounded ${FOCUS_RING}`}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-danger">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe((v) => !v)}
                className={`w-[18px] h-[18px] rounded-[4px] border border-border flex items-center justify-center flex-shrink-0 transition-colors ${FOCUS_RING}`}
                style={rememberMe ? { background: "var(--primary)", borderColor: "var(--primary)" } : {}}
              >
                {rememberMe && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-foreground">Remember me for 30 days</span>
            </label>

            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={loading}
              className="w-full rounded-xl"
            >
              Sign In
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            No account?{" "}
            <Link href="/register" className={`text-primary font-semibold hover:underline rounded ${FOCUS_RING}`}>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
