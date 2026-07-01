"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle, XCircle, Clock } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// Token must be a 64-character lowercase hex string (32 random bytes)
function isValidTokenFormat(t: string): boolean {
  return t.length === 64 && /^[a-f0-9]+$/.test(t);
}

type PageState = "form" | "submitting" | "success" | "invalid" | "expired" | "error";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [pageState, setPageState] = useState<PageState>("form");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  const tokenFormatOk = isValidTokenFormat(token);

  // Pre-fetch CSRF token so it's ready when the user submits.
  // The /api/auth/csrf endpoint also sets the csrf-token cookie (non-httpOnly),
  // which checkCsrf() on the server reads to do the double-submit check.
  useEffect(() => {
    if (!tokenFormatOk) return;
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((data: { csrfToken?: string }) => setCsrfToken(data.csrfToken ?? ""))
      .catch(() => {}); // will refetch on submit if this failed
  }, [tokenFormatOk]);

  // ── Invalid token format — show error immediately, no API call needed ─────────

  if (!tokenFormatOk) {
    return (
      <PageShell>
        <InvalidState />
      </PageShell>
    );
  }

  // ── Terminal states ───────────────────────────────────────────────────────────

  if (pageState === "success") {
    return (
      <PageShell>
        <SuccessState />
      </PageShell>
    );
  }

  if (pageState === "invalid") {
    return (
      <PageShell>
        <InvalidState />
      </PageShell>
    );
  }

  if (pageState === "expired") {
    return (
      <PageShell>
        <ExpiredState />
      </PageShell>
    );
  }

  // ── Form state (also covers "submitting" and "error") ─────────────────────────

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError("");

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setPageState("submitting");

    try {
      // Guarantee we have a fresh CSRF token + cookie pair.
      // If the prefetch succeeded, this is a no-op (csrf is already set).
      let csrf = csrfToken;
      if (!csrf) {
        const csrfRes = await fetch("/api/csrf");
        const csrfData = (await csrfRes.json()) as { csrfToken?: string };
        csrf = csrfData.csrfToken ?? "";
      }

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setPageState("success");
        // Give the user time to read the success message, then redirect.
        setTimeout(() => router.push("/login?reset=success"), 3000);
        return;
      }

      // 404 → token not found or already used
      if (res.status === 404) { setPageState("invalid"); return; }

      // 410 → token expired
      if (res.status === 410) { setPageState("expired"); return; }

      setPageState("error");
    } catch {
      setPageState("error");
    }
  };

  return (
    <PageShell>
      <h1 className="text-2xl font-bold text-foreground mb-1">Set a new password</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose a strong password of at least 8 characters.
      </p>

      {pageState === "error" && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          Something went wrong. Please try again.
        </div>
      )}

      {fieldError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {fieldError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="password"
          label="New password"
          type="password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldError(""); }}
          required
          autoComplete="new-password"
          hint="Use a mix of letters, numbers, and symbols for a stronger password."
        />
        <Input
          id="confirm-password"
          label="Confirm new password"
          type="password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setFieldError(""); }}
          required
          autoComplete="new-password"
        />
        <Button
          type="submit"
          size="lg"
          loading={pageState === "submitting"}
          className="w-full mt-2"
        >
          Reset Password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </PageShell>
  );
}

// ── Terminal state components ─────────────────────────────────────────────────

function SuccessState() {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Password updated!</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Your password has been reset. You&apos;ll be redirected to sign in shortly.
      </p>
      <Link href="/login">
        <Button size="lg" className="w-full">Go to Sign In</Button>
      </Link>
    </div>
  );
}

function InvalidState() {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <XCircle className="w-8 h-8 text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Invalid link</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        This reset link is invalid or has already been used.
        Reset links can only be used once. Please request a new one.
      </p>
      <Link href="/forgot-password">
        <Button size="lg" className="w-full">Request a New Link</Button>
      </Link>
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}

function ExpiredState() {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <Clock className="w-8 h-8 text-orange-400" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Link expired</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        This reset link has expired. Links are valid for{" "}
        <strong className="text-foreground">1 hour</strong>.
        Please request a new one.
      </p>
      <Link href="/forgot-password">
        <Button size="lg" className="w-full">Request a New Link</Button>
      </Link>
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}

// ── Shared layout ─────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground">GED Prep</span>
      </div>
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8">
        {children}
      </div>
    </div>
  );
}
