/**
 * Masks the local part of an email for display, e.g.
 *   "chonlasit@gmail.com" → "ch••••••@gmail.com"
 *
 * Keeps the first 2 characters and the full domain; the middle is replaced with
 * a fixed run of bullets (not the real length) so the mask doesn't leak how long
 * the address is. Falls back to returning the input unchanged if it isn't a
 * recognisable email.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(6)}@${domain}`;
}
