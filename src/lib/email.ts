import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "GED Prep <noreply@yourdomain.com>";

export async function sendVerificationEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${code} is your GED Prep verification code`,
    html: buildVerificationEmailHtml(name, code),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${code} is your GED Prep password reset code`,
    html: buildPasswordResetEmailHtml(name, code),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

function buildPasswordResetEmailHtml(name: string, code: string): string {
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
                Enter the 6-digit code below to choose a new one.
              </p>

              <!-- OTP code -->
              <div style="margin-bottom:24px;padding:20px;background:#f3f6fd;
                          border:1px solid #dbe4f7;border-radius:12px;text-align:center;">
                <div style="font-size:34px;font-weight:700;letter-spacing:10px;
                            color:#111827;font-family:'Courier New',Courier,monospace;">
                  ${code}
                </div>
              </div>

              <div style="padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;
                          border-radius:8px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#991b1b;">
                  This code expires in <strong>15 minutes</strong>.
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

function buildVerificationEmailHtml(name: string, code: string): string {
  const safeName = escapeHtml(name);
  // `code` is a 6-digit numeric string generated server-side — safe to interpolate.
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
                Enter the 6-digit code below to verify your email and activate your account.
              </p>

              <!-- OTP code -->
              <div style="margin-bottom:24px;padding:20px;background:#f3f6fd;
                          border:1px solid #dbe4f7;border-radius:12px;text-align:center;">
                <div style="font-size:34px;font-weight:700;letter-spacing:10px;
                            color:#111827;font-family:'Courier New',Courier,monospace;">
                  ${code}
                </div>
              </div>

              <!-- Expiry warning -->
              <div style="padding:12px 16px;background:#fefce8;border:1px solid #fef08a;
                          border-radius:8px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#854d0e;">
                  This code expires in <strong>10 minutes</strong>.
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
