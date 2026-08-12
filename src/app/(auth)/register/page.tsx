"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "motion/react";
import { clearExistingSession } from "@/lib/auth-client";
import { ArrowLeft, BookOpen } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  authFormVariants,
  authItem,
  authMascotVariants,
  authStagger,
} from "@/components/auth/authMotion";

/* ── Icons ── */
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Password strength ── */
function getStrength(pwd: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let pts = 0;
  if (pwd.length >= 8) pts++;
  if (pwd.length >= 12) pts++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) pts++;
  if (/[0-9]/.test(pwd)) pts++;
  if (/[^A-Za-z0-9]/.test(pwd)) pts++;
  if (pts <= 2) return { score: 1, label: "Weak", color: "#EF4444" };
  if (pts <= 3) return { score: 2, label: "Fair", color: "#F59E0B" };
  return { score: 3, label: "Strong", color: "#22C55E" };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {([1, 2, 3] as const).map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= score ? color : "#d8e6f7",
              transition: "background .25s",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

/* ── Date of birth picker (3 selects) ── */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SELECT_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-input bg-card text-sm text-foreground " +
  "hover:border-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring " +
  "focus:border-transparent transition-colors appearance-none";

function DobPicker({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const parts = value ? value.split("-") : ["", "", ""];
  const [year, setYear] = useState(parts[0]);
  const [month, setMonth] = useState(parts[1] ? String(parseInt(parts[1])) : "");
  const [day, setDay] = useState(parts[2] ? String(parseInt(parts[2])) : "");

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 85 }, (_, i) => currentYear - 16 - i),
    [currentYear]
  );

  const daysInMonth = useMemo(() => {
    if (!month || !year) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  }, [month, year]);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const emit = (y: string, m: string, d: string) => {
    if (y && m && d) {
      const mm = m.padStart(2, "0");
      const dd = d.padStart(2, "0");
      onChange(`${y}-${mm}-${dd}`);
    } else {
      onChange("");
    }
  };

  const handleYear = (v: string) => { setYear(v); emit(v, month, day); };
  const handleMonth = (v: string) => {
    setMonth(v);
    const maxDay = v && year ? new Date(parseInt(year), parseInt(v), 0).getDate() : 31;
    const clampedDay = day && parseInt(day) > maxDay ? "" : day;
    if (clampedDay !== day) setDay(clampedDay);
    emit(year, v, clampedDay);
  };
  const handleDay = (v: string) => { setDay(v); emit(year, month, v); };

  const selectStyle = { WebkitAppearance: "none" as const };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {/* Month */}
        <div className="relative">
          <select
            aria-label="Month"
            value={month}
            onChange={(e) => handleMonth(e.target.value)}
            onBlur={onBlur}
            className={SELECT_CLS}
            style={selectStyle}
          >
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        {/* Day */}
        <div className="relative">
          <select
            aria-label="Day"
            value={day}
            onChange={(e) => handleDay(e.target.value)}
            onBlur={onBlur}
            className={SELECT_CLS}
            style={selectStyle}
          >
            <option value="">Day</option>
            {days.map((d) => (
              <option key={d} value={String(d)}>{d}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        {/* Year */}
        <div className="relative">
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => handleYear(e.target.value)}
            onBlur={onBlur}
            className={SELECT_CLS}
            style={selectStyle}
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ── Field-level validators ── */
function validateName(v: string) {
  if (!v.trim()) return "Full name is required.";
  if (v.trim().length < 2) return "Name must be at least 2 characters.";
  return "";
}
function validateEmail(v: string) {
  if (!v) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
  return "";
}
function validatePassword(v: string) {
  if (!v) return "Password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  return "";
}
function validateDob(v: string) {
  if (!v) return "Date of birth is required.";
  const age = (Date.now() - new Date(v).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (age < 16) return "You must be at least 16 years old.";
  return "";
}

/* ── Constants ── */
const LABEL = "block text-[12px] font-bold text-foreground uppercase tracking-[0.05em] mb-1.5";

const FEATURES = [
  "Free diagnostic across all 4 subjects",
  "AI-adaptive plan built around your gaps",
  "No credit card — cancel anytime",
];

/* ── Page ── */
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", dateOfBirth: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: "" }));
  };

  const blurValidate = (field: string, value: string) => {
    const validators: Record<string, (v: string) => string> = {
      name: validateName,
      email: validateEmail,
      password: validatePassword,
      dateOfBirth: validateDob,
    };
    const err = validators[field]?.(value) ?? "";
    setFieldErrors((p) => ({ ...p, [field]: err }));
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    // Clear any existing session (auth-token + NextAuth) so Google is a fresh
    // sign-in, never linked to / shadowed by whoever is currently signed in.
    await clearExistingSession();
    // Route through /dashboard, which sends users to onboarding only when they
    // have no preferences yet. Hardcoding /onboarding here forced *returning*
    // Google users (who already onboarded) back through onboarding.
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError("");

    // Validate all fields before submit
    const errs = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      dateOfBirth: validateDob(form.dateOfBirth),
    };
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    if (!termsAccepted) {
      setGlobalError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? "Registration failed. Please try again.";
        // Route email-duplicate error to the email field
        if (res.status === 409 || msg.toLowerCase().includes("email")) {
          setFieldErrors((p) => ({ ...p, email: msg }));
        } else {
          setGlobalError(msg);
        }
        setLoading(false);
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch {
      setGlobalError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — a soft "spotlight" keeps the zone behind the mascot
           white (nam.png has a near-white backdrop baked in, so it must sit on
           white to blend), while the edges fade to light blue so the panel
           reads as designed instead of flat white. ── */}
      <div
        className="hidden lg:flex w-[54%] min-h-screen relative flex-col overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 75% 62% at 50% 38%, #FFFFFF 0%, #F5F9FF 28%, #DCE9FE 65%, #B9D2FA 100%)",
        }}
      >
        {/* dotted texture — masked out of the centre so it only shows near the
            edges, keeping it clear of the mascot */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(37,99,235,.18) 1.5px,transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 78% 70% at 50% 40%, transparent 32%, #000 76%)",
            WebkitMaskImage: "radial-gradient(ellipse 78% 70% at 50% 40%, transparent 32%, #000 76%)",
          }}
        />
        {/* soft accent orbs — give the light panel colour + depth at the edges */}
        <div
          className="absolute -bottom-24 -left-24 w-[440px] h-[440px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(37,99,235,.30) 0%,transparent 68%)" }}
        />
        <div
          className="absolute -top-16 -right-16 w-[360px] h-[360px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(56,189,248,.28) 0%,transparent 68%)" }}
        />
        <div
          className="absolute bottom-8 -right-10 w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(34,197,94,.16) 0%,transparent 70%)" }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 py-10 min-h-0 overflow-y-auto w-full">
          <div className="w-full max-w-[360px] flex flex-col items-center text-center">
          {/* Mascot — anchored during the page transition (crossfades with a
              short lift rather than sliding) so nam↔nick reads as one character
              morphing. The float keyframes live on an inner div so the CSS
              animation's transform never fights motion's. */}
          <motion.div variants={authMascotVariants} className="mb-3 flex-shrink-0">
            <div className="relative" style={{ animation: "floatA 3.6s ease-in-out infinite" }}>
              {/* White halo — guarantees the mascot's baked-in near-white backdrop
                  always sits on white, so its edge never shows as a box. */}
              <div
                className="absolute inset-0 -z-10 pointer-events-none"
                style={{
                  transform: "scale(1.4)",
                  background: "radial-gradient(ellipse at 50% 48%, #FFFFFF 0%, rgba(255,255,255,.82) 46%, transparent 72%)",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mascots/nam.png"
                alt="Nam, your study buddy"
                className="relative z-10"
                style={{
                  width: 300,
                  height: "auto",
                  display: "block",
                  filter: "drop-shadow(0 22px 34px rgba(37,99,235,.16)) drop-shadow(0 6px 12px rgba(15,23,42,.06))",
                }}
              />
            </div>
          </motion.div>
          <h2
            className="text-[30px] font-bold text-foreground leading-[1.2] mb-2.5"
            style={{ fontFamily: "var(--font-feather)" }}
          >
            Start free.<br />Pass your GED.
          </h2>
          <p className="text-sm leading-[1.65] max-w-[310px] mb-[26px] text-muted-foreground">
            Take the diagnostic and get a personalized study plan in minutes — Nam&apos;s got your back the whole way.
          </p>
          <div
            className="rounded-2xl p-5 w-full text-left bg-white/85"
            style={{ border: "1px solid rgba(37,99,235,.22)", boxShadow: "0 12px 28px -12px rgba(37,99,235,.28)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[.08em] mb-3 text-muted-foreground">What you get</p>
            <div className="flex flex-col gap-2.5">
              {FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,.20)" }}>
                    <CheckIcon />
                  </div>
                  <span className="text-[13px] font-medium text-foreground/80">{feat}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (form) — foreground layer of the page transition:
           travels furthest, in the navigation direction. ── */}
      <motion.div
        variants={authFormVariants}
        className="flex-1 flex items-center justify-center bg-background py-10 sm:py-[60px] px-6 lg:px-12"
      >
        <motion.div variants={authStagger} initial="hidden" animate="visible" className="w-full max-w-[380px]">
          {/* Logo stays the topmost brand anchor; the way out sits on the same
              row, right-aligned. A clickable logo alone isn't an affordance
              everyone recognizes, so the exit is spelled out in words. */}
          <motion.div variants={authItem} className="flex items-center justify-between gap-4 mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-[9px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label="GED Prep — back to home"
            >
              <div className="w-8 h-8 bg-primary rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ boxShadow: "0 3px 0 rgba(0,0,0,0.18)" }}>
                <BookOpen className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[17px] font-bold text-foreground" style={{ fontFamily: "var(--font-feather)" }}>GED Prep</span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 shrink-0 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </Link>
          </motion.div>

          <motion.h1 variants={authItem} className="text-[28px] font-bold text-foreground mb-1.5" style={{ fontFamily: "var(--font-feather)" }}>
            Create your account
          </motion.h1>
          <motion.p variants={authItem} className="text-sm text-muted-foreground mb-6">Free forever to start. Ready in 30 seconds.</motion.p>

          {/* Google */}
          <motion.button
            variants={authItem}
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-[11px] px-4 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Sign up with Google"}
          </motion.button>

          {/* OR divider */}
          <motion.div variants={authItem} className="flex items-center gap-3.5 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Global error */}
            {globalError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-[11px] px-3 py-[11px]"
                style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)" }}>
                <svg className="flex-shrink-0 mt-px" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-[13px] text-red-600 dark:text-red-400 font-semibold leading-[1.4]">{globalError}</span>
              </div>
            )}

            {/* Full name */}
            <motion.div variants={authItem} className="mb-3.5">
              <Input
                id="name"
                label="Full name"
                labelClassName={LABEL}
                type="text"
                placeholder="Alex Chen"
                value={form.name}
                onChange={setField("name")}
                onBlur={() => blurValidate("name", form.name)}
                required
                autoComplete="name"
                error={fieldErrors.name}
              />
            </motion.div>

            {/* Email */}
            <motion.div variants={authItem} className="mb-3.5">
              <Input
                id="email"
                label="Email"
                labelClassName={LABEL}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={setField("email")}
                onBlur={() => blurValidate("email", form.email)}
                required
                autoComplete="email"
                error={fieldErrors.email}
              />
            </motion.div>

            {/* Date of birth */}
            <motion.div variants={authItem} className="mb-3.5">
              <label className={LABEL}>Date of birth</label>
              <DobPicker
                value={form.dateOfBirth}
                onChange={(v) => {
                  setForm((p) => ({ ...p, dateOfBirth: v }));
                  if (fieldErrors.dateOfBirth) setFieldErrors((p) => ({ ...p, dateOfBirth: "" }));
                }}
                onBlur={() => blurValidate("dateOfBirth", form.dateOfBirth)}
                error={fieldErrors.dateOfBirth}
              />
            </motion.div>

            {/* Password — Input's built-in show/hide toggle replaces the old
                hand-rolled eye icon */}
            <motion.div variants={authItem} className="mb-2">
              <Input
                id="password"
                label="Password"
                labelClassName={LABEL}
                type="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => {
                  setForm((p) => ({ ...p, password: e.target.value }));
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" }));
                }}
                onBlur={() => blurValidate("password", form.password)}
                required
                autoComplete="new-password"
                error={fieldErrors.password}
              />
              {/* Strength meter — only show when typing, no field error */}
              {!fieldErrors.password && <PasswordStrengthMeter password={form.password} />}
            </motion.div>

            {/* Terms checkbox */}
            <motion.label variants={authItem} className="flex items-start gap-[9px] my-4 cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={termsAccepted}
                onClick={() => setTermsAccepted((v) => !v)}
                className="mt-0.5 w-[18px] h-[18px] rounded-[4px] border border-border flex items-center justify-center flex-shrink-0 transition-colors"
                style={termsAccepted ? { background: "var(--primary)", borderColor: "var(--primary)" } : {}}
              >
                {termsAccepted && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <span className="text-[12.5px] text-muted-foreground leading-[1.5]">
                I agree to the{" "}
                <Link href="/terms" className="text-primary font-semibold hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-primary font-semibold hover:underline">Privacy Policy</Link>
              </span>
            </motion.label>

            <motion.div variants={authItem}>
              <Button type="submit" size="lg" loading={loading} disabled={loading} className="w-full rounded-xl">
                Create Free Account
              </Button>
            </motion.div>
          </form>

          <motion.p variants={authItem} className="text-center text-[13px] text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
