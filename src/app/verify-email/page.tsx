"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type VerifyStatus = "verifying" | "success" | "expired" | "invalid" | "already-verified";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerifyStatus>("verifying");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "rate-limited" | "error">(
    "idle"
  );

  const didVerify = useRef(false); // prevent double-invocation in React Strict Mode

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
        if (res.ok) {
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">GED Prep</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {status === "verifying" && <VerifyingState />}
        {status === "success" && <SuccessState />}
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
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
      <h1 className="text-xl font-bold text-gray-900">Verifying your email…</h1>
      <p className="text-sm text-gray-500 mt-2">Please wait a moment.</p>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="py-4">
      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h1>
      <p className="text-sm text-gray-500 mb-8 leading-relaxed">
        Your account is now active. You can sign in and start your GED prep journey.
      </p>
      <Link href="/login">
        <Button size="lg" className="w-full">
          Go to Sign In
        </Button>
      </Link>
    </div>
  );
}

function AlreadyVerifiedState() {
  return (
    <div className="py-4">
      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-blue-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Already verified</h1>
      <p className="text-sm text-gray-500 mb-8">
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
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
        {isExpired ? (
          <Clock className="w-8 h-8 text-red-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-400" />
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {isExpired ? "Link expired" : "Invalid link"}
      </h1>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        {isExpired
          ? "This verification link has expired. Verification links are valid for 24 hours."
          : "This verification link is invalid or has already been used. Try signing in, or request a new link below."}
      </p>

      {resendStatus === "sent" ? (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700 text-left">
          Verification email sent! Check your inbox.
        </div>
      ) : (
        <form onSubmit={onResend} className="space-y-3 text-left">
          <p className="text-sm font-medium text-gray-700">
            Request a new verification link:
          </p>

          {resendStatus === "rate-limited" && (
            <div className="px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-100 text-xs text-yellow-700">
              Please wait a moment before requesting another email.
            </div>
          )}

          {resendStatus === "error" && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
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

      <p className="mt-5 text-sm text-gray-500">
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
