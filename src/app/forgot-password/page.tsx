"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AuthShell from "@/components/auth/AuthShell";
import { authItem, authStagger } from "@/components/auth/authMotion";

type FormStatus = "idle" | "submitting" | "rate-limited" | "error";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
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

      if (!res.ok) {
        setStatus("error");
        return;
      }

      // Send everyone to the code-entry page regardless of whether the email is
      // registered — the code only arrives for real accounts, so this leaks
      // nothing (no account enumeration).
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch {
      setStatus("error");
    }
  };

  return (
    <AuthShell onBack={() => router.push("/login")}>
      <motion.div variants={authStagger} initial="hidden" animate="visible">
        <motion.h1
          variants={authItem}
          className="text-2xl font-bold text-foreground mb-1"
          style={{ fontFamily: "var(--font-feather)" }}
        >
          Forgot password?
        </motion.h1>
        <motion.p variants={authItem} className="text-sm text-muted-foreground mb-6">
          Enter the email linked to your account and we&apos;ll send a 6&#8209;digit code to reset it.
        </motion.p>

        <AnimatePresence initial={false}>
          {status === "rate-limited" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-100 dark:border-yellow-500/25 text-sm text-yellow-700 dark:text-yellow-400">
                Too many requests. Please wait a while before trying again.
              </div>
            </motion.div>
          )}
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/25 text-sm text-red-700 dark:text-red-400">
                Something went wrong. Please try again.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div variants={authItem}>
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              icon={<Mail className="w-4 h-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </motion.div>
          <motion.div variants={authItem}>
            <Button
              type="submit"
              size="lg"
              loading={status === "submitting"}
              className="w-full mt-2 gap-2"
            >
              Send Code
              {status !== "submitting" && <ArrowRight className="w-5 h-5" />}
            </Button>
          </motion.div>
        </form>

        <motion.p variants={authItem} className="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to Sign In
          </Link>
        </motion.p>
      </motion.div>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  );
}
