import * as jose from "jose";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET environment variable is not set. " +
    "Run: openssl rand -base64 32 and add to .env.local"
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export async function verifyToken(
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function signToken(
  payload: Record<string, unknown>,
  expiresIn: string = "1d"
): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}
