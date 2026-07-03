"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const COOLDOWN = 60;

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "rate-limited">("idle");
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleResend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        setStatus("rate-limited");
        startCooldown();
      } else if (res.ok) {
        setStatus("sent");
        startCooldown();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const buttonDisabled = status === "sending" || cooldown > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-feather)" }}>GED Prep</span>
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
        <div className="w-14 h-14 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-5">
          <Mail className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-feather)" }}>Check your email</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          We sent a verification link to{" "}
          {initialEmail ? (
            <strong className="text-foreground">{initialEmail}</strong>
          ) : (
            "your email address"
          )}
          . Click the link to activate your account.
        </p>

        <div className="text-left space-y-3 mb-8 text-sm text-muted-foreground bg-background rounded-xl p-4">
          <p className="font-medium text-foreground">Didn&apos;t receive it?</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>The link expires in 24 hours</li>
            <li>Make sure you used the correct email address</li>
          </ul>
        </div>

        {status === "sent" && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/25 text-sm text-green-700 dark:text-green-400">
            New verification email sent. Please check your inbox.
          </div>
        )}
        {status === "rate-limited" && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-100 dark:border-yellow-500/25 text-sm text-yellow-700 dark:text-yellow-400">
            Please wait a moment before requesting another email.
          </div>
        )}
        {status === "error" && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-sm text-red-700 dark:text-red-400">
            Something went wrong. Please try again.
          </div>
        )}

        <form onSubmit={handleResend} className="space-y-3">
          <Input
            id="resend-email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Button
            type="submit"
            size="lg"
            loading={status === "sending"}
            disabled={buttonDisabled}
            className="w-full"
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend verification email"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
