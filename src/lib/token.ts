import { createHash, randomBytes } from "crypto";

/**
 * Generates a cryptographically secure token pair.
 *
 * The raw token goes into the verification URL.
 * The hashed token is stored in the database.
 *
 * Why hash? Same principle as password hashing: if the database is compromised,
 * an attacker cannot use the leaked hashes to verify emails — they'd need the
 * original 256-bit random value, which was never stored.
 */
export function generateVerificationToken(): { raw: string; hashed: string } {
  const raw = randomBytes(32).toString("hex"); // 64 hex chars, 256 bits of entropy
  return { raw, hashed: hashVerificationToken(raw) };
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns a Date 24 hours from now (email verification). */
export function verificationTokenExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/** Returns a Date 1 hour from now (password reset — shorter window, higher risk). */
export function passwordResetTokenExpiry(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * Rate-limit guard for the resend endpoint.
 *
 * We derive "sent at" from the stored expiry (expiry - 24 h) rather than
 * adding a separate sentAt column. Returns true when at least 60 s have
 * passed since the last send.
 */
export function canResendVerification(
  emailVerificationExpires: Date | null
): boolean {
  if (!emailVerificationExpires) return true;
  const issuedAt = emailVerificationExpires.getTime() - 24 * 60 * 60 * 1000;
  return Date.now() - issuedAt >= 60_000;
}
