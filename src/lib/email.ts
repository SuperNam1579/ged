import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn(
    "[email] NEXT_PUBLIC_APP_URL is not set — email links will use http://localhost:3000. " +
    "In production, set NEXT_PUBLIC_APP_URL=https://www.ged-nn.com in Vercel environment variables."
  );
}
const FROM_EMAIL = process.env.EMAIL_FROM ?? "GED Prep <noreply@yourdomain.com>";

export async function sendVerificationEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Verify your GED Prep account",
    html: buildVerificationEmailHtml(name, verifyUrl),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  rawToken: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your GED Prep password",
    html: buildPasswordResetEmailHtml(name, resetUrl),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

function buildPasswordResetEmailHtml(name: string, resetUrl: string): string {
  const safeName = escapeHtml(name);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:36px;height:36px;background:#2563eb;border-radius:10px;
                                display:inline-block;text-align:center;line-height:36px;
                                font-size:18px;margin-right:10px;vertical-align:middle;">📖</div>
                    <span style="font-size:18px;font-weight:700;color:#111827;vertical-align:middle;">GED Prep</span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                Reset your password
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi ${safeName}, we received a request to reset your password.
                Click the button below to choose a new one.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td>
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:13px 28px;background:#2563eb;
                              color:#fff;font-size:15px;font-weight:600;
                              text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;color:#6b7280;word-break:break-all;">
                <a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a>
              </p>

              <div style="padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;
                          border-radius:8px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#991b1b;">
                  This link expires in <strong>1 hour</strong>.
                  If you didn't request a password reset, you can safely ignore this email —
                  your password will not be changed.
                </p>
              </div>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                GED Prep &mdash; Personalized exam preparation
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildVerificationEmailHtml(name: string, verifyUrl: string): string {
  const safeName = escapeHtml(name);
  // verifyUrl is constructed from APP_URL (env var) + hex token — safe to interpolate
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <!-- Logo -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:36px;height:36px;background:#2563eb;border-radius:10px;
                                display:inline-block;text-align:center;line-height:36px;
                                font-size:18px;margin-right:10px;vertical-align:middle;">📖</div>
                    <span style="font-size:18px;font-weight:700;color:#111827;vertical-align:middle;">
                      GED Prep
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                Verify your email address
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Hi ${safeName}, welcome to GED Prep!<br />
                Click the button below to verify your email and activate your account.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td>
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:13px 28px;background:#2563eb;
                              color:#fff;font-size:15px;font-weight:600;
                              text-decoration:none;border-radius:8px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;color:#6b7280;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#2563eb;">${verifyUrl}</a>
              </p>

              <!-- Expiry warning -->
              <div style="padding:12px 16px;background:#fefce8;border:1px solid #fef08a;
                          border-radius:8px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#854d0e;">
                  This link expires in <strong>24 hours</strong>.
                  If you didn't create this account, you can safely ignore this email.
                </p>
              </div>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                GED Prep &mdash; Personalized exam preparation
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
