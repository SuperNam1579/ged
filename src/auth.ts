import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import authConfig from "@/auth.config";

// ─── Type augmentation ────────────────────────────────────────────────────────
// Extend Session so session.user.id is typed without casting everywhere.
// token.sub is the standard JWT subject claim; NextAuth sets it to user.id
// automatically, so no JWT interface augmentation is needed.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// ─── Credentials input schema ─────────────────────────────────────────────────

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── NextAuth configuration ───────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,

  // JWT strategy: sessions are stored as signed cookies, not in the database.
  // The Session model in the schema satisfies the adapter interface but is not
  // written to when strategy is "jwt".
  session: { strategy: "jwt" },

  // Spread edge-safe config (providers stubs, pages).
  // Override providers below with full implementations that have db access.
  ...authConfig,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      // Always show Google's account chooser so the user consciously picks
      // which Google identity to sign in with, instead of Google silently
      // reusing whichever account the browser last used.
      authorization: { params: { prompt: "select_account" } },
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            emailVerified: true,
          },
        });

        // Reject OAuth-only accounts that have no password set.
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Email must be verified before a credentials session is issued.
        // Throwing causes NextAuth to redirect to /login?error=EMAIL_NOT_VERIFIED
        // so the frontend can show a targeted "resend verification" prompt.
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    // token.sub is set to user.id by NextAuth automatically on sign-in.
    // No custom jwt callback needed unless additional claims are required.
    jwt({ token }) {
      return token;
    },

    // Expose user id on the session object so server components and API routes
    // can read session.user.id without an extra database lookup.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },

  events: {
    // Google (with allowDangerousEmailAccountLinking) verifies the email
    // itself, including when it links onto an existing credentials-registered
    // user who never entered our verification code. Without this, that user's
    // emailVerified stays null forever even though they're actively signing
    // in — silently blocking them from ever using password login later, and
    // leaving the DB out of sync with reality. A no-op if already verified.
    async signIn({ user, account }) {
      if (account?.provider === "google" && user?.id) {
        await db.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
});
