"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordReset = searchParams.get("reset") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowResend(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setShowResend(true);
        }
        setError(data.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setResendStatus("error");
        setError("Please wait a moment before requesting another verification email.");
      } else {
        setResendStatus("sent");
      }
    } catch {
      setResendStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">GED Prep</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to continue your study journey.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
            <p>{error}</p>
            {showResend && resendStatus === "idle" && (
              <button
                onClick={handleResend}
                className="mt-2 font-medium underline hover:no-underline focus:outline-none"
              >
                Resend verification email
              </button>
            )}
            {showResend && resendStatus === "sending" && (
              <p className="mt-2 text-red-500">Sending…</p>
            )}
          </div>
        )}

        {passwordReset && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700">
            Password updated successfully. You can now sign in.
          </div>
        )}

        {resendStatus === "sent" && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700">
            Verification email sent. Please check your inbox.
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="w-full mt-2"
          >
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
