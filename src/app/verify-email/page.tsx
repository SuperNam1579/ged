"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type VerifyStatus = "verifying" | "success" | "expired" | "invalid" | "already-verified";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerifyStatus>("verifying");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "rate-limited" | "error">(
    "idle"
  );

  const didVerify = useRef(false);

  useEffect(() => {
    if (!token || didVerify.current) return;
    didVerify.current = true;

    if (token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      setStatus("invalid");
      return;
    }

    // POST — not GET — so email-scanner prefetches of this page URL don't
    // consume the single-use token before the real user clicks it.
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setVerifiedEmail(data.email ?? "");
          setStatus("success");
        } else if (res.status === 410) {
          setStatus("expired");
        } else if (res.status === 409) {
          setStatus("already-verified");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      const params = new URLSearchParams({ verified: "true" });
      if (verifiedEmail) params.set("email", verifiedEmail);
      router.push(`/login?${params.toString()}`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, verifiedEmail, router]);

  const handleResend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResendStatus("sending");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      if (res.status === 429) {
        setResendStatus("rate-limited");
      } else if (res.ok) {
        setResendStatus("sent");
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground">GED Prep</span>
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
        {status === "verifying" && <VerifyingState />}
        {status === "success" && <SuccessState countdown={countdown} />}
        {status === "already-verified" && <AlreadyVerifiedState />}
        {(status === "expired" || status === "invalid") && (
          <ExpiredOrInvalidState
            isExpired={status === "expired"}
            resendEmail={resendEmail}
            setResendEmail={setResendEmail}
            resendStatus={resendStatus}
            onResend={handleResend}
          />
        )}
      </div>
    </div>
  );
}

function VerifyingState() {
  return (
    <div className="py-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
      <h1 className="text-xl font-bold text-foreground">Verifying your email…</h1>
      <p className="text-sm text-muted-foreground mt-2">Please wait a moment.</p>
    </div>
  );
}

function SuccessState({ countdown }: { countdown: number }) {
  return (
    <div className="py-4">
      <div className="w-14 h-14 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Email verified!</h1>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Your account is now active. Redirecting you to sign in…
      </p>
      <p className="text-4xl font-bold text-primary mb-6">{countdown}</p>
      <Link href="/login">
        <Button size="lg" className="w-full">
          Go to Sign In now
        </Button>
      </Link>
    </div>
  );
}

function AlreadyVerifiedState() {
  return (
    <div className="py-4">
      <div className="w-14 h-14 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Already verified</h1>
      <p className="text-sm text-muted-foreground mb-8">
        This email address has already been verified. You can sign in normally.
      </p>
      <Link href="/login">
        <Button size="lg" className="w-full">
          Go to Sign In
        </Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

interface ExpiredOrInvalidProps {
  isExpired: boolean;
  resendEmail: string;
  setResendEmail: (v: string) => void;
  resendStatus: "idle" | "sending" | "sent" | "rate-limited" | "error";
  onResend: (e: React.FormEvent<HTMLFormElement>) => void;
}

function ExpiredOrInvalidState({
  isExpired,
  resendEmail,
  setResendEmail,
  resendStatus,
  onResend,
}: ExpiredOrInvalidProps) {
  return (
    <div className="py-4">
      <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
        {isExpired ? (
          <Clock className="w-8 h-8 text-red-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-400" />
        )}
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">
        {isExpired ? "Link expired" : "Invalid link"}
      </h1>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        {isExpired
          ? "This verification link has expired. Verification links are valid for 24 hours."
          : "This verification link is invalid or has already been used. Try signing in, or request a new link below."}
      </p>

      {resendStatus === "sent" ? (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/25 text-sm text-green-700 dark:text-green-400 text-left">
          Verification email sent! Check your inbox.
        </div>
      ) : (
        <form onSubmit={onResend} className="space-y-3 text-left">
          <p className="text-sm font-medium text-foreground">
            Request a new verification link:
          </p>

          {resendStatus === "rate-limited" && (
            <div className="px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-100 dark:border-yellow-500/25 text-xs text-yellow-700 dark:text-yellow-400">
              Please wait a moment before requesting another email.
            </div>
          )}

          {resendStatus === "error" && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-xs text-red-700 dark:text-red-400">
              Something went wrong. Please try again.
            </div>
          )}

          <Input
            id="resend-email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Button
            type="submit"
            size="lg"
            loading={resendStatus === "sending"}
            className="w-full"
          >
            Send new verification link
          </Button>
        </form>
      )}

      <p className="mt-5 text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
