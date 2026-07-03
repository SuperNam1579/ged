"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type FormStatus = "idle" | "submitting" | "sent" | "rate-limited" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        setStatus("rate-limited");
        return;
      }

      // Always treat any 2xx as success. Non-2xx (other than 429) is a server error.
      if (!res.ok) {
        setStatus("error");
        return;
      }

      // Show generic success — whether or not the email is registered.
      // This prevents account enumeration.
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  // ── Sent state ────────────────────────────────────────────────────────────────

  if (status === "sent") {
    return (
      <PageShell>
        <div className="text-center">
          <div className="w-14 h-14 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-feather)" }}>Check your email</h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            If an account exists for{" "}
            <strong className="text-foreground">{email}</strong>,
            we&apos;ve sent a password reset link. The link expires in{" "}
            <strong className="text-foreground">1 hour</strong>.
          </p>

          <div className="text-left text-sm text-muted-foreground bg-background rounded-xl p-4 mb-6 space-y-1">
            <p className="font-medium text-foreground">Didn&apos;t receive it?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your spam or junk folder</li>
              <li>The link expires in 1 hour</li>
              <li>Only verified accounts receive reset emails</li>
            </ul>
          </div>

          <Link href="/login">
            <Button size="lg" className="w-full">Back to Sign In</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "var(--font-feather)" }}>Forgot your password?</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Enter your email and we&apos;ll send a reset link if your account exists.
      </p>

      {status === "rate-limited" && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-100 dark:border-yellow-500/25 text-sm text-yellow-700 dark:text-yellow-400">
          Too many requests. Please wait a while before trying again.
        </div>
      )}

      {status === "error" && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-sm text-red-700 dark:text-red-400">
          Something went wrong. Please try again.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Button
          type="submit"
          size="lg"
          loading={status === "submitting"}
          className="w-full mt-2"
        >
          Send Reset Link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </PageShell>
  );
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-feather)" }}>GED Prep</span>
      </div>
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8">
        {children}
      </div>
    </div>
  );
}
