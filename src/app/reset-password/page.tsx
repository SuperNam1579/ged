"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import AuthShell from "@/components/auth/AuthShell";
import { authItem, authStagger, stepVariants } from "@/components/auth/authMotion";
import { maskEmail } from "@/lib/mask";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

type Step = "code" | "password";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailFromQuery = searchParams.get("email") ?? "";

  const [step, setStep] = useState<Step>("code");
  const [dir, setDir] = useState(1); // slide direction for the step transition
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [shakeSignal, setShakeSignal] = useState(0);
  const [csrfToken, setCsrfToken] = useState("");

  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((data: { csrfToken?: string }) => setCsrfToken(data.csrfToken ?? ""))
      .catch(() => {});
  }, []);

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

  const rejectCode = (message: string) => {
    setError(message);
    setShakeSignal((n) => n + 1);
    setCode("");
  };

  // ── Step 1: verify the code (without consuming it) before showing the form ──
  const verifyCode = async (fullCode: string) => {
    if (verifyingRef.current) return;
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    verifyingRef.current = true;
    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });

      if (res.ok) {
        setDir(1);
        setStep("password");
        setError("");
        return;
      }

      if (res.status === 410) {
        rejectCode("This code has expired. Request a new one below.");
      } else if (res.status === 429) {
        rejectCode("Too many attempts. Please wait a moment and try again.");
      } else if (res.status === 404) {
        rejectCode("That code is incorrect or has already been used.");
      } else {
        rejectCode("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  // ── Step 2: submit the new password (the code is consumed here) ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
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
        body: JSON.stringify({ email, code, password }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/login?reset=success"), 3000);
        return;
      }

      // If the code expired or was invalidated between the two steps, slide back
      // to re-enter a fresh one.
      if (res.status === 410 || res.status === 404) {
        setDir(-1);
        setStep("code");
        rejectCode(
          res.status === 410
            ? "This code has expired. Request a new one below."
            : "That code is no longer valid. Please request a new one."
        );
      } else if (res.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok || res.status === 429) {
        setResendStatus("sent");
        startCooldown();
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    }
  };

  const handleBack = () => {
    if (step === "password") {
      setDir(-1);
      setStep("code");
      setError("");
      return;
    }
    router.push(`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`);
  };

  if (success) {
    return (
      <AuthShell>
        <SuccessState />
      </AuthShell>
    );
  }

  return (
    <AuthShell onBack={handleBack}>
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        {step === "code" ? (
          <motion.div
            key="code"
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
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
                  <strong className="text-foreground">{maskEmail(email)}</strong>
                ) : (
                  "your email"
                )}
                . It expires in 15 minutes.
              </motion.p>

              <ErrorBanner error={error} />

              {!emailFromQuery && (
                <motion.div variants={authItem} className="mb-4">
                  <Input
                    id="reset-email"
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
                  onComplete={(v) => void verifyCode(v)}
                  disabled={verifying}
                  autoFocus={!!emailFromQuery}
                  shakeSignal={shakeSignal}
                />
              </motion.div>

              <motion.p variants={authItem} className="text-center text-xs text-muted-foreground mt-3">
                {verifying ? "Checking your code…" : "Enter the 6‑digit code to continue"}
              </motion.p>

              <motion.div variants={authItem}>
                <Button
                  type="button"
                  size="lg"
                  loading={verifying}
                  disabled={code.length !== CODE_LENGTH || verifying}
                  className="w-full mt-5"
                  onClick={() => verifyCode(code)}
                >
                  Continue
                </Button>
              </motion.div>

              <motion.div variants={authItem} className="mt-6 text-center text-sm text-muted-foreground">
                {resendStatus === "sent" ? (
                  <span className="text-green-600 dark:text-green-400">
                    A new code is on its way. Check your inbox.
                  </span>
                ) : (
                  <>
                    Didn&apos;t get the code?{" "}
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
                Wrong email?{" "}
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                  className="text-primary font-medium hover:underline"
                >
                  Change it
                </Link>
              </motion.p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="password"
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <motion.div variants={authStagger} initial="hidden" animate="visible">
              <motion.h1
                variants={authItem}
                className="text-2xl font-bold text-foreground mb-1"
                style={{ fontFamily: "var(--font-feather)" }}
              >
                Set a new password
              </motion.h1>
              <motion.p variants={authItem} className="text-sm text-muted-foreground mb-6">
                Code verified. Choose a strong password of at least 8 characters.
              </motion.p>

              <ErrorBanner error={error} />

              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div variants={authItem}>
                  <Input
                    id="password"
                    label="New password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                    required
                    autoComplete="new-password"
                    hint="Use a mix of letters, numbers, and symbols for a stronger password."
                  />
                </motion.div>
                <motion.div variants={authItem}>
                  <Input
                    id="confirm-password"
                    label="Confirm new password"
                    type="password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(""); }}
                    required
                    autoComplete="new-password"
                  />
                </motion.div>
                <motion.div variants={authItem}>
                  <Button type="submit" size="lg" loading={submitting} className="w-full mt-2">
                    Reset Password
                  </Button>
                </motion.div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuccessState() {
  return (
    <div className="text-center py-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="w-14 h-14 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5"
      >
        <CheckCircle className="w-8 h-8 text-green-500" />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-bold text-foreground mb-2"
        style={{ fontFamily: "var(--font-feather)" }}
      >
        Password updated!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="text-sm text-muted-foreground mb-8 leading-relaxed"
      >
        Your password has been reset. You&apos;ll be redirected to sign in shortly.
      </motion.p>
      <Link href="/login">
        <Button size="lg" className="w-full">Go to Sign In</Button>
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
