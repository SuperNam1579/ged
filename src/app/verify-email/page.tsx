"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import AuthShell from "@/components/auth/AuthShell";
import { authItem, authStagger } from "@/components/auth/authMotion";
import { maskEmail } from "@/lib/mask";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "success">("idle");
  const [error, setError] = useState("");
  const [shakeSignal, setShakeSignal] = useState(0);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [countdown, setCountdown] = useState(3);

  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "rate-limited" | "error"
  >("idle");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const verify = async (fullCode: string) => {
    if (submittingRef.current) return;
    if (!email) {
      setError("Please enter the email address you registered with.");
      return;
    }
    submittingRef.current = true;
    setStatus("verifying");
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setVerifiedEmail(data.email ?? email);
        setStatus("success");
        return;
      }

      setStatus("idle");
      setShakeSignal((n) => n + 1);
      setCode("");
      if (res.status === 410) {
        setError("This code has expired. Request a new one below.");
      } else if (res.status === 409) {
        setError("This email is already verified. You can sign in.");
      } else if (res.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("That code is incorrect or has already been used.");
      }
    } catch {
      setStatus("idle");
      setError("Something went wrong. Please try again.");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendStatus === "sending") return;
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setResendStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setResendStatus("rate-limited");
        startCooldown();
      } else if (res.ok) {
        setResendStatus("sent");
        startCooldown();
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    }
  };

  // Countdown → redirect to sign-in after successful verification.
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

  if (status === "success") {
    return (
      <AuthShell>
        <SuccessState countdown={countdown} />
      </AuthShell>
    );
  }

  return (
    <AuthShell onBack={() => router.push("/login")}>
      <motion.div variants={authStagger} initial="hidden" animate="visible">
        <motion.h1
          variants={authItem}
          className="text-2xl font-bold text-foreground mb-1"
          style={{ fontFamily: "var(--font-feather)" }}
        >
          Enter the code
        </motion.h1>
        <motion.p variants={authItem} className="text-sm text-muted-foreground mb-6">
          We sent a 6&#8209;digit code to{" "}
          {emailFromQuery ? (
            <strong className="text-foreground">{maskEmail(emailFromQuery)}</strong>
          ) : (
            "your email address"
          )}
          . It expires in 10 minutes.
        </motion.p>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!emailFromQuery && (
          <motion.div variants={authItem} className="mb-4 text-left">
            <Input
              id="verify-email-address"
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </motion.div>
        )}

        <motion.div variants={authItem}>
          <OtpInput
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(""); }}
            onComplete={(v) => void verify(v)}
            disabled={status === "verifying"}
            autoFocus={!!emailFromQuery}
            shakeSignal={shakeSignal}
          />
        </motion.div>

        <motion.p variants={authItem} className="text-center text-xs text-muted-foreground mt-3">
          {status === "verifying" ? "Checking your code…" : "Enter the 6‑digit code to continue"}
        </motion.p>

        <motion.div variants={authItem}>
          <Button
            type="button"
            size="lg"
            loading={status === "verifying"}
            disabled={code.length !== CODE_LENGTH || status === "verifying"}
            className="w-full mt-5"
            onClick={() => verify(code)}
          >
            Verify email
          </Button>
        </motion.div>

        <motion.div variants={authItem} className="mt-6 text-center text-sm text-muted-foreground">
          {resendStatus === "sent" ? (
            <span className="text-green-600">
              A new code is on its way. Check your inbox.
            </span>
          ) : (
            <>
              Didn&apos;t get it?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resendStatus === "sending"}
                className="text-primary font-medium hover:underline disabled:opacity-60 disabled:no-underline"
              >
                {resendStatus === "sending"
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Resend code"}
              </button>
            </>
          )}
        </motion.div>

        <motion.p variants={authItem} className="mt-2 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </motion.p>
      </motion.div>
    </AuthShell>
  );
}

function SuccessState({ countdown }: { countdown: number }) {
  return (
    <div className="py-4 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5"
      >
        <CheckCircle className="w-8 h-8 text-green-500" />
      </motion.div>
      <h1 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-feather)" }}>Email verified!</h1>
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
