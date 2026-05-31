import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

/**
 * Edge-safe NextAuth config — no Node.js-only imports (no Prisma, no bcrypt).
 *
 * This file is imported by both:
 *   - src/auth.ts (full server config, adds PrismaAdapter + real authorize logic)
 *   - src/proxy.ts (edge runtime, creates a lightweight NextAuth instance
 *     purely for verifying the authjs.session-token JWT cookie)
 *
 * The `authorize` stub here is never called by the middleware — only the JWT
 * verification runs there. The real authorize lives in src/auth.ts.
 */
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Stub: real implementation in src/auth.ts overrides this.
      async authorize() {
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig;
