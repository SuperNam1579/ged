import { createHash, randomBytes, randomInt } from "crypto";

/**
 * How long an email-verification OTP stays valid. Kept short — the code is only
 * 6 digits, so a narrow window (plus rate limiting) is what makes brute force
 * infeasible. Also drives the resend-cooldown math below, so change it here only.
 */
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generates a 6-digit numeric OTP for email verification.
 *
 * `code` is what we email the user; `hashed` (SHA-256 of the code) is what we
 * store in the database. Why hash a 6-digit code? Same principle as password
 * hashing — a database leak shouldn't hand an attacker live verification codes.
 *
 * `randomInt` draws uniformly from [0, 1_000_000); zero-padding keeps values
 * like 4821 rendered as "004821" so every code is exactly 6 characters.
 */
export function generateOtp(): { code: string; hashed: string } {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { code, hashed: hashVerificationToken(code) };
}

/**
 * Generates a cryptographically secure token pair (raw + hash).
 *
 * Still used for password-reset magic links: the raw token goes into the URL,
 * the hashed token is stored. If the database leaks, an attacker can't use the
 * hashes — they'd need the original 256-bit random value, never stored.
 */
export function generateVerificationToken(): { raw: string; hashed: string } {
  const raw = randomBytes(32).toString("hex"); // 64 hex chars, 256 bits of entropy
  return { raw, hashed: hashVerificationToken(raw) };
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the expiry for a freshly issued email-verification OTP. */
export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

/**
 * Expiry for a password-reset OTP. Kept to 15 minutes — a 6-digit code is far
 * more guessable than the old 256-bit link token, so the window is short and
 * rate limiting (see the "reset-password" limiter) does the rest.
 */
export function passwordResetTokenExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
}

/**
 * Rate-limit guard for the resend endpoint.
 *
 * We derive "sent at" from the stored expiry (expiry - OTP_TTL_MS) rather than
 * adding a separate sentAt column. Returns true when at least 60 s have
 * passed since the last send.
 */
export function canResendVerification(
  emailVerificationExpires: Date | null
): boolean {
  if (!emailVerificationExpires) return true;
  const issuedAt = emailVerificationExpires.getTime() - OTP_TTL_MS;
  return Date.now() - issuedAt >= 60_000;
}
