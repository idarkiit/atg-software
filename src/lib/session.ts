import {SignJWT, jwtVerify} from 'jose';

export const SESSION_COOKIE = 'atg_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function secretKey() {
  // AUTH_SECRET should be set on Vercel. The fallback keeps demo deploys working.
  const secret =
    process.env.AUTH_SECRET ||
    `atg-demo-secret-${process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'local'}`;
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {uid: number; bid: number | null};

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({alg: 'HS256'})
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const {payload} = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== 'number') return null;
    return {uid: payload.uid, bid: (payload.bid as number | null) ?? null};
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  // Off only when the VPS is reached over plain http (COOKIE_SECURE=0).
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};
